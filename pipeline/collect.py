#!/usr/bin/env python3
"""Сбор находок: поиск через Perplexity по темам и чтение RSS/Atom-лент.

    python3 collect.py                 # обычный прогон, запись в pipe_findings
    python3 collect.py --dry-run       # одна тема и до трёх лент, без записи
    python3 collect.py --dry-run --topic "синдром Кесслера"
    python3 collect.py --no-rss        # только поиск
    python3 collect.py --no-search     # только ленты

Источники двух родов:
  - search: темы из pipe_settings.topics (каждая тема заводится строкой
    pipe_sources kind=search при первом прогоне, чтобы у находки был source_id);
  - rss: строки pipe_sources kind=rss (заполняет seed_sources.py).

Дубли сводятся по нормализованному url (без utm и якорей) и по близости
заголовков с находками последних 30 дней. Такие пишутся с verdict=duplicate,
чтобы судья их не тратил и чтобы в админке было видно, что источник уже
приходил другим путём.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import prompts  # noqa: E402
from common import (Run, chat, citations_of, cursor, dump, normalize_url,  # noqa: E402
                    parse_date, titles_close)

STAGE = "collect"


# ---------------------------------------------------------------------------
# Поиск
# ---------------------------------------------------------------------------

def search_topic(run: Run, topic: str) -> list[dict[str, Any]]:
    cfg = run.settings
    n = int(cfg["limits"]["search_results_per_topic"])
    days = int(cfg["limits"]["max_age_days"])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    res = chat(
        cfg["models"]["search"],
        [{"role": "system", "content": prompts.SEARCH_SYSTEM},
         {"role": "user", "content": prompts.SEARCH_USER.format(
             n=n, days=days, today=today, topic=topic,
             project_short="«Экология Космоса» (космический мусор, артсайклинг, наука и искусство)")}],
        run=run, purpose=f"search:{topic[:40]}", temperature=0.1, max_tokens=3000,
        timeout=240,
    )
    try:
        data = res.json()
        items = data.get("items") if isinstance(data, dict) else data
    except Exception as e:  # noqa: BLE001
        run.log("тема «%s»: ответ не JSON (%s), беру ссылки из citations", topic, e)
        items = []
    items = [i for i in (items or []) if isinstance(i, dict) and i.get("url")]
    # Страховка: ссылки, которые Perplexity дал как citations, но не вписал в
    # список, добавляем как голые находки, их дооценит судья.
    known = {normalize_url(i["url"]) for i in items}
    for u in citations_of(res):
        if normalize_url(u) not in known:
            items.append({"url": u, "title": "", "summary": "", "published_at": None,
                          "source_name": "", "language": "", "from_citations": True})
    for i in items:
        i["topic"] = topic
        i["via"] = "search"
    run.log("тема «%s»: %d находок, $%.4f", topic, len(items), res.cost)
    return items


# ---------------------------------------------------------------------------
# Ленты
# ---------------------------------------------------------------------------

def read_feed(run: Run, source: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        import feedparser  # pip install feedparser
    except ImportError:
        run.log("feedparser не установлен, ленты пропущены")
        return []
    import requests

    url = source["query_or_url"]
    try:
        r = requests.get(url, timeout=30, headers={"User-Agent": "cosmos-ecology-pipeline/1.0"})
        r.raise_for_status()
        feed = feedparser.parse(r.content)
    except Exception as e:  # noqa: BLE001
        run.log("лента %s: ошибка %s", source.get("name") or url, e)
        source["_error"] = str(e)[:300]
        return []
    max_age = timedelta(days=int(run.settings["limits"]["max_age_days"]))
    now = datetime.now(timezone.utc)
    items: list[dict[str, Any]] = []
    for e in feed.entries[:50]:
        link = e.get("link") or ""
        if not link:
            continue
        published = None
        for key in ("published_parsed", "updated_parsed"):
            if e.get(key):
                published = datetime(*e[key][:6], tzinfo=timezone.utc)
                break
        if published and now - published > max_age:
            continue
        summary = (e.get("summary") or e.get("description") or "")
        summary = _strip_html(summary)[:1200]
        items.append({
            "url": link,
            "title": (e.get("title") or "").strip(),
            "summary": summary,
            "published_at": published.isoformat() if published else None,
            "source_name": source.get("name") or feed.feed.get("title", ""),
            "language": source.get("language") or "",
            "topic": source.get("topic") or source.get("category") or "",
            "via": "rss",
            "source_id": source["id"],
        })
    run.log("лента %s: %d записей за период", source.get("name") or url, len(items))
    return items


def _strip_html(text: str) -> str:
    import re
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"&nbsp;|&#160;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Сведение и запись
# ---------------------------------------------------------------------------

def dedupe(items: list[dict[str, Any]], recent: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Помечает дубли внутри партии и относительно последних находок.
    Возвращает тот же список, у дублей verdict=duplicate и duplicate_of."""
    seen_urls: dict[str, str] = {r["url"]: r["url"] for r in recent}
    seen_titles: list[tuple[str, str]] = [(r["title"], r["url"]) for r in recent if r.get("title")]
    out: list[dict[str, Any]] = []
    for it in items:
        nurl = normalize_url(it["url"])
        if not nurl:
            continue
        it["url_raw"] = it["url"]
        it["url"] = nurl
        dup_of = seen_urls.get(nurl)
        if not dup_of and it.get("title"):
            for t, u in seen_titles:
                if titles_close(it["title"], t):
                    dup_of = u
                    break
        if dup_of and dup_of != nurl:
            it["verdict"] = "duplicate"
            it["verdict_reason"] = f"дубль {dup_of}"
        elif dup_of == nurl:
            it["verdict"] = "skip"  # уже есть в базе ровно по этому url
        else:
            it["verdict"] = "new"
            seen_urls[nurl] = nurl
            if it.get("title"):
                seen_titles.append((it["title"], nurl))
        out.append(it)
    return out


def ensure_search_sources(run: Run, topics: list[str]) -> dict[str, int]:
    ids: dict[str, int] = {}
    with cursor(run) as cur:
        for t in topics:
            cur.execute(
                "INSERT INTO pipe_sources (kind, query_or_url, topic, name) VALUES ('search', %s, %s, %s) "
                "ON CONFLICT (kind, query_or_url) DO UPDATE SET topic = EXCLUDED.topic RETURNING id",
                (t, t, f"поиск: {t}"),
            )
            ids[t] = cur.fetchone()["id"]
    run.conn.commit()
    return ids


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="без записи в базу; одна тема, до трёх лент")
    ap.add_argument("--topic", help="только эта тема (в dry-run по умолчанию первая)")
    ap.add_argument("--no-rss", action="store_true")
    ap.add_argument("--no-search", action="store_true")
    ap.add_argument("--out", help="dry-run: сохранить находки в JSON для judge.py --dry-run --input")
    args = ap.parse_args()

    with Run(STAGE, dry_run=args.dry_run) as run:
        cfg = run.settings
        topics: list[str] = list(cfg["topics"])
        if args.topic:
            topics = [args.topic]
        elif args.dry_run:
            topics = topics[:1]

        items: list[dict[str, Any]] = []

        # Ленты
        feeds: list[dict[str, Any]] = []
        if not args.no_rss:
            if run.conn is not None:
                with cursor(run) as cur:
                    cur.execute("SELECT * FROM pipe_sources WHERE kind = 'rss' AND active ORDER BY authority DESC, id")
                    feeds = [dict(r) for r in cur.fetchall()]
            else:
                # dry-run без базы: ленты из sources.json рядом, если есть
                sample = Path(__file__).resolve().parent / "sources.json"
                if sample.exists():
                    for i, s in enumerate(json.loads(sample.read_text(encoding="utf-8"))):
                        if s.get("feed_url") and s.get("feed_kind") in ("rss", "atom"):
                            feeds.append({"id": -1 - i, "query_or_url": s["feed_url"], "name": s.get("name"),
                                          "language": s.get("language"), "topic": s.get("category"),
                                          "authority": s.get("authority", 0)})
            if args.dry_run:
                feeds = feeds[:3]
            for f in feeds:
                got = read_feed(run, f)
                run.items_in += len(got)
                items.extend(got)
                if run.conn is not None:
                    with cursor(run) as cur:
                        cur.execute("UPDATE pipe_sources SET last_run_at = NOW(), last_error = %s WHERE id = %s",
                                    (f.get("_error"), f["id"]))
                    run.conn.commit()

        # Поиск
        source_ids: dict[str, int] = {}
        if not args.no_search:
            if run.conn is not None:
                source_ids = ensure_search_sources(run, topics)
            for t in topics:
                got = search_topic(run, t)
                run.items_in += len(got)
                for g in got:
                    g["source_id"] = source_ids.get(t)
                items.extend(got)
                if run.conn is not None and t in source_ids:
                    with cursor(run) as cur:
                        cur.execute("UPDATE pipe_sources SET last_run_at = NOW() WHERE id = %s", (source_ids[t],))
                    run.conn.commit()

        # Дубли
        recent: list[dict[str, Any]] = []
        if run.conn is not None:
            with cursor(run) as cur:
                cur.execute("SELECT url, title FROM pipe_findings WHERE found_at > NOW() - INTERVAL '30 days'")
                recent = [dict(r) for r in cur.fetchall()]
        items = dedupe(items, recent)
        limit = int(cfg["limits"]["max_findings_per_run"])
        fresh = [i for i in items if i["verdict"] == "new"][:limit]
        dups = [i for i in items if i["verdict"] == "duplicate"]
        skipped = sum(1 for i in items if i["verdict"] == "skip")
        run.log("новых %d, дублей %d, уже в базе %d", len(fresh), len(dups), skipped)

        if run.conn is None:
            print("\n=== DRY-RUN: находки (в базу не записаны) ===")
            dump([{k: v for k, v in i.items() if k != "raw"} for i in fresh + dups])
            if args.out:
                Path(args.out).write_text(json.dumps(fresh, ensure_ascii=False, indent=2, default=str),
                                          encoding="utf-8")
                run.log("находки сохранены в %s (для judge.py --dry-run --input)", args.out)
            run.items_out = len(fresh)
            return

        with cursor(run) as cur:
            for it in fresh + dups:
                raw = {k: v for k, v in it.items()
                       if k not in ("url", "title", "summary", "published_at", "source_id", "verdict", "verdict_reason")}
                cur.execute(
                    "INSERT INTO pipe_findings (source_id, url, title, summary, published_at, raw, verdict, verdict_reason) "
                    "VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s) ON CONFLICT (url) DO NOTHING RETURNING id",
                    (it.get("source_id"), it["url"], (it.get("title") or "")[:500], it.get("summary") or "",
                     parse_date(it.get("published_at")), json.dumps(raw, ensure_ascii=False, default=str),
                     it["verdict"], it.get("verdict_reason", "")),
                )
                if cur.fetchone() is not None and it["verdict"] == "new":
                    run.items_out += 1
        run.conn.commit()


if __name__ == "__main__":
    main()
