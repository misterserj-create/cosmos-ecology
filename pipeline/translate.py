#!/usr/bin/env python3
"""Переводы одобренных русских постов на en, es, fr, de, zh, ja.

    python3 translate.py                    # все approved ru-посты без переводов
    python3 translate.py --draft 7 --langs en,ja
    python3 translate.py --dry-run --draft 7 --langs en

Для каждого языка: переводит модель-автор (та же, что пишет посты), потом
модель-носитель оценивает перевод 0-10 (Gemini для zh/ja, GPT для остальных);
при среднем ниже thresholds.translation_min перевод делается заново с
замечаниями, один раз. Результат - строка pipe_drafts с lang и parent_id,
статус approved (родитель уже одобрен), оценка в quality.

Глоссарий берётся из словарей сайта i18n/dictionaries/*.json: имена
участников, название проекта, термин «артсайклинг». Путь к словарям -
DICTIONARIES_DIR в .env, по умолчанию ../i18n/dictionaries относительно
пакета (так лежит в репозитории).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import prompts  # noqa: E402
from common import (TRANSLATION_LANGS, Run, chat, cursor, dump, env, fix_long_dash,  # noqa: E402
                    has_long_dash)

STAGE = "translate"
NATIVE_KEYS = ("accuracy", "fluency", "terminology")

# Термин метода: в словарях сайта он везде латиницей, в zh/ja с пояснением.
ARTCYCLING = {"en": "artcycling", "es": "artcycling", "fr": "artcycling", "de": "Artcycling",
              "zh": "艺术再造（artcycling）", "ja": "アートサイクリング（artcycling）"}


def dictionaries_dir() -> Path:
    return Path(env("DICTIONARIES_DIR") or (Path(__file__).resolve().parent.parent / "i18n" / "dictionaries"))


def glossary_for(lang: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = [("артсайклинг", ARTCYCLING.get(lang, "artcycling"))]
    d = dictionaries_dir()
    try:
        ru = json.loads((d / "ru.json").read_text(encoding="utf-8"))
        tgt = json.loads((d / f"{lang}.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return pairs
    try:
        pairs.append((ru["nav"]["brand"], tgt["nav"]["brand"]))
    except KeyError:
        pass
    try:
        for a, b in zip(ru["team"]["members"], tgt["team"]["members"]):
            pairs.append((a["name"], b["name"]))
    except (KeyError, TypeError):
        pass
    return pairs


def glossary_text(lang: str) -> str:
    return "\n".join(f"{a} = {b}" for a, b in glossary_for(lang))


def translate_once(run: Run, body: str, lang: str, fix_block: str = "") -> tuple[str, dict[str, Any]]:
    res = chat(run.settings["models"]["translator"],
               [{"role": "system", "content": prompts.TRANSLATOR_SYSTEM.format(
                   lang_name=prompts.LANG_NAMES[lang], glossary=glossary_text(lang))},
                {"role": "user", "content": prompts.TRANSLATOR_USER.format(body=body, fix_block=fix_block)}],
               run=run, purpose=f"translate:{lang}", temperature=0.3, max_tokens=2500)
    text = res.text.strip()
    meta = {"model": res.raw.get("model"), "cost": round(res.cost, 6), "dash_fixed": has_long_dash(text)}
    return fix_long_dash(text), meta


def native_review(run: Run, source: str, translation: str, lang: str) -> dict[str, Any]:
    model = run.settings["models"]["native_cjk" if lang in ("zh", "ja") else "native_eu"]
    res = chat(model, [{"role": "system", "content": prompts.NATIVE_SYSTEM.format(lang_name=prompts.LANG_NAMES[lang])},
                       {"role": "user", "content": prompts.NATIVE_USER.format(
                           glossary=glossary_text(lang), source=source, translation=translation)}],
               run=run, purpose=f"native:{lang}", temperature=0.1, max_tokens=800, json_mode=True)
    j = res.json()
    vals = [float(j.get(k, 0)) for k in NATIVE_KEYS]
    return {**{k: j.get(k) for k in NATIVE_KEYS}, "avg": round(sum(vals) / len(vals), 2),
            "comments": j.get("comments") or [], "model": res.raw.get("model"), "cost": round(res.cost, 6)}


def translate_lang(run: Run, body: str, lang: str) -> dict[str, Any]:
    cost0 = run.cost
    threshold = float(run.settings["thresholds"]["translation_min"])
    text, meta = translate_once(run, body, lang)
    review = native_review(run, body, text, lang)
    run.log("%s: перевод, оценка носителя %.1f", lang, review["avg"])
    history: list[dict[str, Any]] = []
    if review["avg"] < threshold:
        history.append({"body": text, "review": review})
        issues = "\n".join(f"- {c}" for c in review["comments"]) or "- ниже порога"
        text, meta2 = translate_once(run, body, lang, prompts.TRANSLATOR_FIX_BLOCK.format(previous=text, issues=issues))
        meta["dash_fixed"] = meta["dash_fixed"] or meta2["dash_fixed"]
        review = native_review(run, body, text, lang)
        run.log("%s: повторный перевод, оценка %.1f", lang, review["avg"])
    return {"body": text, "quality": {"native": review, "translator": meta, "min": threshold,
                                      "passed": review["avg"] >= threshold, "history": history},
            "created_by": meta["model"] or run.settings["models"]["translator"],
            "cost": round(run.cost - cost0, 6)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--draft", type=int, help="id русского черновика")
    ap.add_argument("--langs", default=",".join(TRANSLATION_LANGS))
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    langs = [l.strip() for l in args.langs.split(",") if l.strip() in TRANSLATION_LANGS]

    with Run(STAGE, dry_run=args.dry_run) as run:
        from common import db
        conn = run.conn if run.conn is not None else db()
        limit = args.limit or int(run.settings["limits"]["max_posts_per_run"])
        with conn.cursor() as cur:
            if args.draft:
                cur.execute("SELECT * FROM pipe_drafts WHERE id = %s AND lang = 'ru'", (args.draft,))
            else:
                cur.execute(
                    "SELECT d.* FROM pipe_drafts d WHERE d.lang = 'ru' AND d.status IN ('approved', 'published') "
                    "AND (SELECT count(*) FROM pipe_drafts c WHERE c.parent_id = d.id) < %s "
                    "ORDER BY d.reviewed_at DESC NULLS LAST LIMIT %s", (len(TRANSLATION_LANGS), limit))
            drafts = [dict(r) for r in cur.fetchall()]
            done: dict[int, set[str]] = {}
            for d in drafts:
                cur.execute("SELECT lang FROM pipe_drafts WHERE parent_id = %s", (d["id"],))
                done[d["id"]] = {r["lang"] for r in cur.fetchall()}
        run.items_in = len(drafts)
        run.log("к переводу: %d постов, языки %s", len(drafts), ",".join(langs))

        for d in drafts:
            for lang in langs:
                if lang in done.get(d["id"], set()) and not args.dry_run:
                    continue
                try:
                    r = translate_lang(run, d["body"], lang)
                except Exception as e:  # noqa: BLE001
                    run.log("черновик %s, %s: ошибка %s", d["id"], lang, e)
                    continue
                if run.conn is None:
                    print(f"\n=== DRY-RUN: перевод {lang} черновика {d['id']} (не сохранён) ===")
                    print(r["body"])
                    dump(r["quality"]["native"])
                    continue
                with cursor(run) as cur:
                    cur.execute(
                        "INSERT INTO pipe_drafts (finding_id, parent_id, lang, title, body, status, quality, created_by, model_cost) "
                        "VALUES (%s, %s, %s, %s, %s, 'approved', %s::jsonb, %s, %s)",
                        (d.get("finding_id"), d["id"], lang, d.get("title") or "", r["body"],
                         json.dumps(r["quality"], ensure_ascii=False, default=str), r["created_by"], r["cost"]))
                    cur.execute("UPDATE pipe_drafts SET model_cost = model_cost + %s WHERE id = %s", (r["cost"], d["id"]))
                run.conn.commit()
                run.items_out += 1
        if run.conn is None:
            conn.close()


if __name__ == "__main__":
    main()
