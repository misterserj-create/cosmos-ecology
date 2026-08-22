#!/usr/bin/env python3
"""Отбор находок: модель-судья (GPT-5.6) оценивает каждую новую находку.

    python3 judge.py                          # все находки с verdict=new
    python3 judge.py --limit 10
    python3 judge.py --dry-run --input found.json   # находки из файла, без записи
    python3 judge.py --dry-run --limit 3            # первые новые из базы, без записи

Итоговая оценка 0-10: взвешенная сумма пяти критериев плюс бонус за
авторитетный источник из реестра (authority 4-5 = +1.0, 3 = +0.5). Вердикт
accepted при score >= thresholds.judge_accept, иначе rejected; если модель
указала duplicate_of среди принятых, verdict=duplicate. Объяснение модели
хранится в verdict_reason, полный ответ в raw.judge.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import prompts  # noqa: E402
from common import Run, chat, cursor, dump  # noqa: E402

STAGE = "judge"

WEIGHTS = {"credibility": 0.25, "freshness": 0.15, "relevance": 0.3, "interest": 0.2, "novelty": 0.1}


def authority_bonus(authority: int) -> float:
    if authority >= 4:
        return 1.0
    if authority == 3:
        return 0.5
    return 0.0


def score_of(j: dict[str, Any], authority: int) -> float:
    total = 0.0
    for k, w in WEIGHTS.items():
        try:
            total += w * max(0.0, min(10.0, float(j.get(k, 0))))
        except (TypeError, ValueError):
            pass
    # Связь с темой - не один из критериев, а ворота. Первый живой прогон
    # пропустил 36 находок из 40, и в верхушке оказались «Уэбб открывает
    # сокровищницу», солнечное затмение и жара в Европе: авторитетный источник
    # и свежесть перевешивали то, что к орбитальному мусору это не относится.
    # Ниже 5 по relevance находка не проходит, какой бы ни была остальная сумма,
    # а бонус за источник даётся только тому, что по теме.
    try:
        relevance = float(j.get("relevance", 0))
    except (TypeError, ValueError):
        relevance = 0.0
    if relevance < 5:
        return round(min(total, 4.9), 2)
    return round(min(10.0, total + authority_bonus(authority)), 2)


def prefilter(run: Run, f: dict[str, Any]) -> tuple[bool, str]:
    """Дешёвый вопрос «это вообще про нашу тему?» перед дорогим судьёй.

    Полный отбор на GPT-5.6 стоил 0.6 цента за находку и съедал треть
    расхода тракта, при том что 4 из 5 находок он же и отвергал - чаще
    всего за нерелевантность. Gemini отвечает на тот же вопрос в шесть
    раз дешевле; к GPT идут только прошедшие.
    """
    cfg = run.settings
    model = cfg["models"].get("prefilter") or cfg["models"].get("judge_b") or "google/gemini-3.7-flash"
    res = chat(model,
               [{"role": "system", "content": prompts.PREFILTER_SYSTEM},
                {"role": "user", "content": prompts.PREFILTER_USER.format(
                    title=f.get("title") or "(без заголовка)", summary=(f.get("summary") or "(нет)")[:800])}],
               run=run, purpose="prefilter", temperature=0.0, max_tokens=120, json_mode=True)
    try:
        j = res.json()
    except Exception:  # noqa: BLE001
        return True, "предфильтр не разобран, пропускаю к судье"
    if not isinstance(j, dict):
        return True, "предфильтр не словарь, пропускаю к судье"
    return bool(j.get("on_topic")), str(j.get("reason") or "")


def judge_one(run: Run, f: dict[str, Any], accepted: list[dict[str, Any]]) -> dict[str, Any]:
    cfg = run.settings
    on_topic, why = prefilter(run, f)
    if not on_topic:
        reason = f"предфильтр: {why}"
        return {"verdict": "rejected", "score": 0.0, "reason": reason, "cost": 0.0,
                "judge": {"prefilter_only": True, "reason": reason, "relevance": 0,
                          "credibility": 0, "freshness": 0, "interest": 0, "novelty": 0}}
    accepted_text = "\n".join(f"- {a['title'] or a['url']} ({a['url']})" for a in accepted) or "- пока ничего"
    raw = f.get("raw") or {}
    res = chat(
        cfg["models"]["judge"],
        [{"role": "system", "content": prompts.JUDGE_SYSTEM},
         {"role": "user", "content": prompts.JUDGE_USER.format(
             today=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
             project=prompts.PROJECT, accepted=accepted_text, url=f["url"], title=f.get("title") or "(без заголовка)",
             published_at=f.get("published_at") or "неизвестна",
             source_name=f.get("source_name") or raw.get("source_name") or "неизвестен",
             authority=int(f.get("authority") or 0), summary=f.get("summary") or "(нет)")}],
        run=run, purpose="judge", temperature=0.1, max_tokens=700, json_mode=True,
    )
    j = res.json()
    authority = int(f.get("authority") or 0)
    score = score_of(j, authority)
    threshold = float(cfg["thresholds"]["judge_accept"])
    dup = j.get("duplicate_of")
    if dup and any(dup == a["url"] for a in accepted):
        verdict = "duplicate"
    elif score >= threshold:
        verdict = "accepted"
    else:
        verdict = "rejected"
    j["score"] = score
    j["authority_bonus"] = authority_bonus(authority)
    j["threshold"] = threshold
    j["model"] = res.raw.get("model")
    j["cost"] = round(res.cost, 6)
    return {"verdict": verdict, "score": score, "reason": str(j.get("reason") or ""), "judge": j, "cost": res.cost}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--input", help="dry-run: JSON с находками от collect.py --dry-run --out")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    with Run(STAGE, dry_run=args.dry_run) as run:
        accepted: list[dict[str, Any]] = []
        findings: list[dict[str, Any]] = []

        if args.input:
            findings = json.loads(Path(args.input).read_text(encoding="utf-8"))
            for f in findings:
                f.setdefault("raw", {"source_name": f.get("source_name")})
        else:
            if run.conn is None:
                # dry-run из базы: только чтение
                from common import db
                conn = db()
            else:
                conn = run.conn
            with conn.cursor() as cur:
                cur.execute("SELECT url, title FROM pipe_findings WHERE verdict = 'accepted' "
                            "AND found_at > NOW() - INTERVAL '45 days' ORDER BY found_at DESC LIMIT 60")
                accepted = [dict(r) for r in cur.fetchall()]
                cur.execute(
                    "SELECT f.*, COALESCE(s.authority, 0) AS authority, s.name AS source_name "
                    "FROM pipe_findings f LEFT JOIN pipe_sources s ON s.id = f.source_id "
                    "WHERE f.verdict = 'new' ORDER BY f.found_at DESC" + (f" LIMIT {int(args.limit)}" if args.limit else ""))
                findings = [dict(r) for r in cur.fetchall()]
            if run.conn is None:
                conn.close()
        if args.limit and args.input:
            findings = findings[:args.limit]

        run.items_in = len(findings)
        run.log("к оценке: %d находок, принятых ранее: %d", len(findings), len(accepted))

        results: list[dict[str, Any]] = []
        for f in findings:
            try:
                r = judge_one(run, f, accepted)
            except Exception as e:  # noqa: BLE001
                run.log("находка %s: судья не ответил (%s)", f["url"], e)
                continue
            run.log("%s %.1f %s: %s", r["verdict"], r["score"], f["url"][:80], r["reason"][:120])
            if r["verdict"] == "accepted":
                accepted.append({"url": f["url"], "title": f.get("title")})
                run.items_out += 1
            results.append({"url": f["url"], "title": f.get("title"), **r})
            if run.conn is not None:
                raw = dict(f.get("raw") or {})
                raw["judge"] = r["judge"]
                with cursor(run) as cur:
                    cur.execute(
                        "UPDATE pipe_findings SET score = %s, verdict = %s, verdict_reason = %s, judged_at = NOW(), "
                        "raw = %s::jsonb, model_cost = model_cost + %s WHERE id = %s",
                        (r["score"], r["verdict"], r["reason"], json.dumps(raw, ensure_ascii=False, default=str),
                         round(r["cost"], 6), f["id"]),
                    )
                run.conn.commit()

        if run.conn is None:
            print("\n=== DRY-RUN: вердикты (в базу не записаны) ===")
            dump([{k: v for k, v in r.items() if k != "judge"} | {"scores": {k: r["judge"].get(k) for k in WEIGHTS}}
                  for r in results])


if __name__ == "__main__":
    main()
