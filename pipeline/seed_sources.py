#!/usr/bin/env python3
"""Заполнение pipe_sources из реестра источников sources.json.

    python3 seed_sources.py sources.json
    python3 seed_sources.py sources.json --dry-run     # показать, что записалось бы
    python3 seed_sources.py --example --dry-run        # проверка на трёх примерах

Формат записи реестра (массив объектов):
  name, organization, url, feed_url, feed_kind (rss|atom|api|page|null),
  language, category, authority (1-5), freshness, notes

Правила:
  - в pipe_sources попадают все записи; kind=rss у тех, где feed_kind rss или
    atom и есть feed_url (их читает collect.py); остальные kind=manual, active
    =false: они лежат как справочник для судьи и для ручного добавления;
  - query_or_url = feed_url для лент, иначе url;
  - повторный запуск обновляет имя, организацию, авторитетность и заметки по
    ключу (kind, query_or_url), ничего не дублируя; active у существующих
    строк не трогается, чтобы не включить обратно то, что выключили в админке.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import db, dump  # noqa: E402

EXAMPLE = [
    {"name": "пример: ESA Space Debris news", "organization": "ESA", "url": "https://www.esa.int/Space_Safety/Space_Debris",
     "feed_url": "https://www.esa.int/rssfeed/Our_Activities/Space_Safety", "feed_kind": "rss", "language": "en",
     "category": "debris", "authority": 5, "freshness": "daily", "notes": "пример записи, не реальный реестр"},
    {"name": "пример: arXiv astro-ph.IM", "organization": "arXiv", "url": "https://arxiv.org/list/astro-ph.IM/recent",
     "feed_url": "https://rss.arxiv.org/rss/astro-ph.IM", "feed_kind": "atom", "language": "en",
     "category": "science", "authority": 4, "freshness": "daily", "notes": "пример записи"},
    {"name": "пример: UNOOSA", "organization": "UNOOSA", "url": "https://www.unoosa.org/oosa/en/ourwork/topics/space-debris/index.html",
     "feed_url": None, "feed_kind": "page", "language": "en", "category": "law", "authority": 5,
     "freshness": "monthly", "notes": "пример записи: ленты нет, только страница"},
]


def to_row(s: dict[str, Any]) -> dict[str, Any] | None:
    feed_kind = (s.get("feed_kind") or "").lower() or None
    feed_url = (s.get("feed_url") or "").strip()
    url = (s.get("url") or "").strip()
    is_feed = feed_kind in ("rss", "atom") and bool(feed_url)
    target = feed_url if is_feed else url
    if not target:
        return None
    try:
        authority = max(0, min(5, int(s.get("authority") or 0)))
    except (TypeError, ValueError):
        authority = 0
    return {
        "kind": "rss" if is_feed else "manual",
        "query_or_url": target,
        "topic": s.get("category") or "",
        "name": s.get("name") or s.get("organization") or target,
        "organization": s.get("organization") or "",
        "language": s.get("language") or "",
        "category": s.get("category") or "",
        "feed_kind": feed_kind,
        "authority": authority,
        "notes": " | ".join(x for x in (s.get("notes"), f"freshness: {s.get('freshness')}" if s.get("freshness") else "",
                                         f"site: {url}" if is_feed and url else "") if x),
        "active": is_feed,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", nargs="?", help="sources.json")
    ap.add_argument("--example", action="store_true", help="использовать встроенные примеры")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.example:
        sources = EXAMPLE
    elif args.path:
        sources = json.loads(Path(args.path).read_text(encoding="utf-8"))
    else:
        ap.error("укажи путь к sources.json или --example")
    if isinstance(sources, dict):
        sources = sources.get("sources") or sources.get("items") or []

    rows = [r for r in (to_row(s) for s in sources) if r]
    skipped = len(sources) - len(rows)
    print(f"записей: {len(sources)}, к загрузке: {len(rows)} (лент {sum(1 for r in rows if r['kind'] == 'rss')}), "
          f"пропущено без адреса: {skipped}")
    if args.dry_run:
        dump(rows)
        return

    conn = db()
    inserted = updated = 0
    with conn.cursor() as cur:
        for r in rows:
            cur.execute(
                "INSERT INTO pipe_sources (kind, query_or_url, topic, name, organization, language, category, feed_kind, "
                "authority, notes, active) VALUES (%(kind)s, %(query_or_url)s, %(topic)s, %(name)s, %(organization)s, "
                "%(language)s, %(category)s, %(feed_kind)s, %(authority)s, %(notes)s, %(active)s) "
                "ON CONFLICT (kind, query_or_url) DO UPDATE SET topic = EXCLUDED.topic, name = EXCLUDED.name, "
                "organization = EXCLUDED.organization, language = EXCLUDED.language, category = EXCLUDED.category, "
                "feed_kind = EXCLUDED.feed_kind, authority = EXCLUDED.authority, notes = EXCLUDED.notes "
                "RETURNING (xmax = 0) AS inserted", r)
            if cur.fetchone()["inserted"]:
                inserted += 1
            else:
                updated += 1
    conn.commit()
    conn.close()
    print(f"добавлено {inserted}, обновлено {updated}")


if __name__ == "__main__":
    main()
