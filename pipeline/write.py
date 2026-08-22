#!/usr/bin/env python3
"""Написание постов по принятым находкам.

    python3 write.py                      # все accepted без черновика + запросы на переписывание
    python3 write.py --finding 42         # только эта находка
    python3 write.py --dry-run --finding 42   # написать и показать, не сохранять

Цепочка на один пост:
  1. автор (Claude) пишет пост по-русски в голосе канала;
  2. проверка на длинное тире: если модель его всё же поставила, заменяем на
     «–» и записываем это в quality.dash_fixed;
  3. фактчек (Perplexity) сверяет пост с источником; при расхождениях
     severity=high пост один раз возвращается автору на правку;
  4. два судьи (Grok и Gemini) независимо оценивают язык, штампы, связность,
     голос; среднее ниже thresholds.quality_min отправляет на переписывание
     (limits.rewrite_rounds раз), после чего пост сохраняется как есть с
     пометкой quality.passed=false;
  5. черновик сохраняется со status=review (прошёл) или draft (не прошёл).
     Одобряет человек в админке; в режиме publish.mode=auto publish.py берёт
     и review-посты тоже.

Переписывание по кнопке из админки: черновик со status=draft и
quality.rewrite_requested=true проходит ту же цепочку заново, текст
заменяется, история предыдущих версий копится в quality.history.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import prompts  # noqa: E402
from common import Run, chat, cursor, dump, fetch_article, fix_long_dash, has_long_dash, word_count  # noqa: E402

STAGE = "write"
QUALITY_KEYS = ("language", "cliches", "coherence", "voice")


def _writer_messages(run: Run, f: dict[str, Any], fix_block: str) -> list[dict[str, str]]:
    voice = run.settings["voice"]
    raw = f.get("raw") or {}
    judge = raw.get("judge") or {}
    return [
        {"role": "system", "content": prompts.WRITER_SYSTEM.format(
            words_min=voice["words_min"], words_max=voice["words_max"])},
        {"role": "user", "content": prompts.WRITER_USER.format(
            title=f.get("title") or "(без заголовка)",
            source_name=f.get("source_name") or raw.get("source_name") or "источник",
            published_at=f.get("published_at") or "дата неизвестна",
            url=f["url"], summary=f.get("summary") or "(краткого содержания нет)",
            article=f.get("_article") or "(статью открыть не удалось - есть только анонс выше; "
                                          "пиши коротко и только то, что в нём есть)",
            angle=judge.get("angle") or "на усмотрение автора", fix_block=fix_block)},
    ]


def write_post(run: Run, f: dict[str, Any], fix_block: str = "") -> tuple[str, dict[str, Any]]:
    if "_article" not in f:
        f["_article"] = fetch_article(f["url"])
        run.log("статья: %s", f"{len(f['_article'])} знаков" if f["_article"] else "не открылась, только анонс")
    res = chat(run.settings["models"]["writer"], _writer_messages(run, f, fix_block),
               run=run, purpose="writer", temperature=0.6, max_tokens=1500)
    text = res.text.strip().strip('"')
    # Первая строка ответа - русский заголовок, дальше пустая строка и пост.
    title_ru = ""
    if "\n" in text:
        first, rest = text.split("\n", 1)
        first = first.strip().lstrip("#").strip()
        if 10 <= len(first) <= 120 and not first.endswith((".", ":")):
            title_ru, text = first, rest.strip()
    f["_title_ru"] = fix_long_dash(title_ru)
    body = text
    meta = {"model": res.raw.get("model"), "cost": round(res.cost, 6), "words": word_count(body),
            "dash_fixed": has_long_dash(body)}
    body = fix_long_dash(body)
    if not body.rstrip().endswith(f["url"]) and "Источник:" not in body:
        body = body.rstrip() + f"\n\nИсточник: {f['url']}"
    return body, meta


def fact_check(run: Run, f: dict[str, Any], body: str) -> dict[str, Any]:
    res = chat(run.settings["models"]["factcheck"],
               [{"role": "system", "content": prompts.FACTCHECK_SYSTEM},
                {"role": "user", "content": prompts.FACTCHECK_USER.format(
                    url=f["url"], summary=(f.get("_article") or f.get("summary") or "(нет)"), body=body)}],
               run=run, purpose="factcheck", temperature=0.1, max_tokens=1500, timeout=240)
    try:
        data = res.json()
    except Exception as e:  # noqa: BLE001
        data = {"issues": [], "verdict": "ok", "note": f"ответ фактчекера не разобран: {e}", "raw": res.text[:800]}
    data["model"] = res.raw.get("model")
    data["cost"] = round(res.cost, 6)
    issues = [i for i in data.get("issues") or [] if isinstance(i, dict)]
    data["issues"] = issues
    data["verdict"] = "fix" if any(i.get("severity") == "high" for i in issues) else "ok"
    return data


def quality_judges(run: Run, body: str) -> dict[str, Any]:
    cfg = run.settings
    out: dict[str, Any] = {"judges": {}}
    scores: list[float] = []
    for key in ("judge_a", "judge_b"):
        model = cfg["models"][key]
        try:
            res = chat(model, [{"role": "system", "content": prompts.QUALITY_SYSTEM},
                               {"role": "user", "content": prompts.QUALITY_USER.format(body=body)}],
                       run=run, purpose=f"quality:{key}", temperature=0.1, max_tokens=800, json_mode=True)
            j = res.json()
            vals = [float(j.get(k, 0)) for k in QUALITY_KEYS]
            avg = round(sum(vals) / len(vals), 2)
            out["judges"][model] = {**{k: j.get(k) for k in QUALITY_KEYS}, "avg": avg,
                                    "comments": j.get("comments") or [], "cost": round(res.cost, 6)}
            scores.append(avg)
        except Exception as e:  # noqa: BLE001
            out["judges"][model] = {"error": str(e)[:300]}
    out["avg"] = round(sum(scores) / len(scores), 2) if scores else None
    out["min"] = float(cfg["thresholds"]["quality_min"])
    out["passed"] = out["avg"] is not None and out["avg"] >= out["min"]
    return out


def produce(run: Run, f: dict[str, Any], previous: str | None = None) -> dict[str, Any]:
    """Вся цепочка. Возвращает словарь для записи в pipe_drafts."""
    cfg = run.settings
    history: list[dict[str, Any]] = []
    cost0 = run.cost

    fix_block = ""
    if previous:
        fix_block = prompts.WRITER_REWRITE_BLOCK.format(previous=previous, issues="- переписать по просьбе редактора")
    body, meta = write_post(run, f, fix_block)
    run.log("автор: %d слов, $%.4f%s", meta["words"], meta["cost"], ", длинное тире заменено" if meta["dash_fixed"] else "")

    fc = fact_check(run, f, body)
    run.log("фактчек: %s, расхождений %d", fc["verdict"], len(fc["issues"]))
    if fc["verdict"] == "fix":
        history.append({"step": "factcheck", "body": body, "issues": fc["issues"]})
        issues_text = "\n".join(f"- {i.get('claim')}: {i.get('problem')}" for i in fc["issues"])
        body, meta2 = write_post(run, f, prompts.WRITER_FIX_BLOCK.format(previous=body, issues=issues_text))
        meta["dash_fixed"] = meta["dash_fixed"] or meta2["dash_fixed"]
        meta["words"] = meta2["words"]
        fc_after = fact_check(run, f, body)
        fc = {"first": fc, **fc_after, "rounds": 1}
        run.log("фактчек после правки: %s, расхождений %d", fc["verdict"], len(fc["issues"]))

    q = quality_judges(run, body)
    run.log("качество: %s (порог %.1f)", q["avg"], q["min"])
    rounds = 0
    while not q["passed"] and rounds < int(cfg["limits"]["rewrite_rounds"]):
        rounds += 1
        comments = []
        for m, j in q["judges"].items():
            for c in j.get("comments") or []:
                comments.append(f"- {c}")
        history.append({"step": f"rewrite{rounds}", "body": body, "quality": q})
        body, meta3 = write_post(run, f, prompts.WRITER_REWRITE_BLOCK.format(
            previous=body, issues="\n".join(comments) or "- текст ниже порога качества"))
        meta["dash_fixed"] = meta["dash_fixed"] or meta3["dash_fixed"]
        meta["words"] = meta3["words"]
        q = quality_judges(run, body)
        run.log("качество после переписывания %d: %s", rounds, q["avg"])

    quality = {**q, "writer": meta, "dash_fixed": meta["dash_fixed"], "rewrite_rounds": rounds,
               "history": history}
    return {
        "body": body,
        "title": (f.get("_title_ru") or f.get("title") or "")[:300],
        "status": "review" if q["passed"] else "draft",
        "quality": quality,
        "fact_check": fc,
        "created_by": meta["model"] or cfg["models"]["writer"],
        "cost": round(run.cost - cost0, 6),
    }


def load_finding(conn, finding_id: int) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute("SELECT f.*, s.name AS source_name FROM pipe_findings f LEFT JOIN pipe_sources s ON s.id = f.source_id "
                    "WHERE f.id = %s", (finding_id,))
        row = cur.fetchone()
    return dict(row) if row else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--finding", type=int, help="id находки")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    with Run(STAGE, dry_run=args.dry_run) as run:
        from common import db
        conn = run.conn if run.conn is not None else db()
        cfg = run.settings
        limit = args.limit or int(cfg["limits"]["max_posts_per_run"])

        todo: list[tuple[dict[str, Any], dict[str, Any] | None]] = []  # (находка, черновик на переписывание)
        if args.finding:
            f = load_finding(conn, args.finding)
            if not f:
                raise RuntimeError(f"находка {args.finding} не найдена")
            todo.append((f, None))
        else:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT f.*, s.name AS source_name FROM pipe_findings f LEFT JOIN pipe_sources s ON s.id = f.source_id "
                    "WHERE f.verdict = 'accepted' AND NOT EXISTS (SELECT 1 FROM pipe_drafts d WHERE d.finding_id = f.id AND d.lang = 'ru') "
                    "ORDER BY f.score DESC NULLS LAST, f.found_at DESC LIMIT %s", (limit,))
                for r in cur.fetchall():
                    todo.append((dict(r), None))
                cur.execute(
                    "SELECT d.* FROM pipe_drafts d WHERE d.lang = 'ru' AND d.status = 'draft' "
                    "AND d.quality->>'rewrite_requested' = 'true' ORDER BY d.updated_at LIMIT %s", (limit,))
                for d in cur.fetchall():
                    d = dict(d)
                    f = load_finding(conn, d["finding_id"]) if d.get("finding_id") else None
                    if f:
                        todo.append((f, d))
        run.items_in = len(todo)
        run.log("к написанию: %d", len(todo))

        for f, draft in todo:
            run.log("находка %s: %s", f.get("id"), (f.get("title") or f["url"])[:90])
            try:
                result = produce(run, f, previous=draft["body"] if draft else None)
            except Exception as e:  # noqa: BLE001
                run.log("находка %s: цепочка упала (%s)", f.get("id"), e)
                continue
            if run.conn is None:
                print("\n=== DRY-RUN: черновик (не сохранён) ===")
                print(result["body"])
                dump({k: v for k, v in result.items() if k != "body"})
                continue
            with cursor(run) as cur:
                if draft:
                    old_quality = draft.get("quality") or {}
                    result["quality"]["history"] = (old_quality.get("history") or []) + [
                        {"step": "before_rewrite", "body": draft["body"], "quality": {k: old_quality.get(k) for k in ("avg", "judges")}}
                    ] + result["quality"]["history"]
                    cur.execute(
                        "UPDATE pipe_drafts SET body = %s, status = %s, quality = %s::jsonb, fact_check = %s::jsonb, "
                        "created_by = %s, model_cost = model_cost + %s, reviewed_by = NULL, reviewed_at = NULL WHERE id = %s",
                        (result["body"], result["status"], json.dumps(result["quality"], ensure_ascii=False, default=str),
                         json.dumps(result["fact_check"], ensure_ascii=False, default=str), result["created_by"],
                         result["cost"], draft["id"]))
                    # переводы прежней версии больше не актуальны
                    cur.execute("DELETE FROM pipe_drafts WHERE parent_id = %s", (draft["id"],))
                else:
                    cur.execute(
                        "INSERT INTO pipe_drafts (finding_id, lang, title, body, status, quality, fact_check, created_by, model_cost) "
                        "VALUES (%s, 'ru', %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)",
                        (f["id"], result["title"], result["body"], result["status"],
                         json.dumps(result["quality"], ensure_ascii=False, default=str),
                         json.dumps(result["fact_check"], ensure_ascii=False, default=str), result["created_by"], result["cost"]))
                cur.execute("UPDATE pipe_findings SET model_cost = model_cost + %s WHERE id = %s", (result["cost"], f["id"]))
            run.conn.commit()
            run.items_out += 1
        if run.conn is None:
            conn.close()


if __name__ == "__main__":
    main()
