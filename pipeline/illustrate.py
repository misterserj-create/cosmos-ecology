#!/usr/bin/env python3
"""Иллюстрация к посту: промпт через Claude, картинка через kie.ai, проверка зрением.

    python3 illustrate.py                  # все ru review/approved без image_url
    python3 illustrate.py --draft 7         # только этот черновик
    python3 illustrate.py --dry-run --draft 7   # промпт и картинка, без записи в базу и MinIO

Цепочка на один черновик:
  1. автор (модель писателя, тот же Claude, что пишет текст) составляет промпт
     для картинки на английском по правилам prompts.ILLUSTRATOR_SYSTEM: только
     орбита и материя, никакого текста/цифр/флагов/лиц;
  2. kie.ai (модель nano-banana-2) генерирует кадр 16:9, jpg;
  3. модель со зрением (google/gemini-3.7-flash через OpenRouter) смотрит на
     готовую картинку и ищет запрещённые элементы;
  4. если нашла - промпт и картинка перегенерируются, максимум ещё одна
     попытка (всего 2). Если и вторая не прошла, image_url не пишется,
     причина - в лог прогона;
  5. картинка, что прошла проверку, скачивается и кладётся в MinIO тем же
     способом, что db/seed/journal_from_tg.py (тот же бакет, тот же клиент),
     в pipeline/images/; url и промпт пишутся в pipe_drafts.

Стоимость берётся из ответа recordInfo (creditsConsumed, 1 кредит = $0.005);
если поля нет - запасная константа IMAGE_COST_USD. Пишется в pipe_api_calls тем
же способом, что и стоимость вызовов моделей (common._record_call), чтобы
расход был виден в одном месте в админке.

Черновики со status=draft/rejected/published не трогаются: картинка нужна
только тому, что дошло до обзора или уже одобрено человеком.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import time
from io import BytesIO
from pathlib import Path
from typing import Any

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

import prompts  # noqa: E402
from common import Run, chat, cursor, env  # noqa: E402
from common import _record_call  # noqa: E402  (тот же механизм учёта, что у chat())

STAGE = "illustrate"

KIE_BASE = "https://api.kie.ai/api/v1"
KIE_MODEL = "nano-banana-2"
# Запасная цена кадра, если в ответе нет creditsConsumed (22.08.2026: 8 кредитов).
IMAGE_COST_USD = 0.04
KIE_CREDIT_USD = 0.005
POLL_INTERVAL_S = 5
POLL_TIMEOUT_S = 180
MAX_ATTEMPTS = 3  # исходная попытка + два повтора после проверки зрением

MINIO_BUCKET = "cosmos-ecology"
MINIO_PREFIX = "pipeline/images"


# ---------------------------------------------------------------------------
# kie.ai
# ---------------------------------------------------------------------------

def _kie_headers() -> dict[str, str]:
    key = env("KIE_API_KEY")
    if not key:
        raise RuntimeError("KIE_API_KEY не задан в .env тракта")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def kie_create_task(prompt_text: str) -> str:
    r = requests.post(
        f"{KIE_BASE}/jobs/createTask",
        headers=_kie_headers(),
        json={"model": KIE_MODEL, "input": {"prompt": prompt_text, "aspect_ratio": "16:9",
                                            "output_format": "jpg"}},
        timeout=30,
    )
    data = r.json()
    if r.status_code >= 400 or not (data.get("data") or {}).get("taskId"):
        raise RuntimeError(f"kie.ai createTask {r.status_code}: {str(data)[:400]}")
    return data["data"]["taskId"]


def kie_wait_result(task_id: str) -> tuple[str, float]:
    """Опрашивает recordInfo, пока state не станет success/fail. Возвращает
    первый URL из resultUrls и стоимость в долларах."""
    deadline = time.time() + POLL_TIMEOUT_S
    while time.time() < deadline:
        r = requests.get(f"{KIE_BASE}/jobs/recordInfo", headers=_kie_headers(),
                         params={"taskId": task_id}, timeout=30)
        data = r.json()
        d = data.get("data") or {}
        state = d.get("state")
        if state == "success":
            result_json = d.get("resultJson")
            if not result_json:
                raise RuntimeError(f"kie.ai: success без resultJson: {str(d)[:400]}")
            parsed = json.loads(result_json) if isinstance(result_json, str) else result_json
            urls = parsed.get("resultUrls") or []
            if not urls:
                raise RuntimeError(f"kie.ai: resultJson без resultUrls: {str(parsed)[:400]}")
            credits = d.get("creditsConsumed")
            cost = float(credits) * KIE_CREDIT_USD if credits is not None else IMAGE_COST_USD
            return urls[0], cost
        if state == "fail":
            raise RuntimeError(f"kie.ai: задача упала: {d.get('failMsg') or str(d)[:300]}")
        time.sleep(POLL_INTERVAL_S)
    raise RuntimeError(f"kie.ai: не дождались результата за {POLL_TIMEOUT_S} с (taskId={task_id})")


def kie_generate(run: Run, prompt_text: str) -> tuple[bytes, str]:
    """Полный цикл создать задачу -> дождаться -> скачать. Стоимость пишется
    в pipe_api_calls независимо от исхода."""
    ok, err, cost = True, None, 0.0
    try:
        task_id = kie_create_task(prompt_text)
        url, cost = kie_wait_result(task_id)
        img = requests.get(url, timeout=60)
        img.raise_for_status()
        return img.content, url
    except Exception as e:  # noqa: BLE001
        ok, err = False, str(e)[:500]
        raise
    finally:
        _record_call(run, "illustrate:kie", KIE_MODEL, {}, cost if ok else 0.0, ok, err)


# ---------------------------------------------------------------------------
# Проверка зрением (OpenRouter, изображение по data URL)
# ---------------------------------------------------------------------------

def vision_check(run: Run, model: str, image_bytes: bytes, content_type: str) -> dict[str, Any]:
    import base64
    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{content_type};base64,{b64}"
    messages = [
        {"role": "system", "content": prompts.VISION_CHECK_SYSTEM},
        {"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": prompts.VISION_CHECK_USER},
        ]},
    ]
    res = chat(model, messages, run=run, purpose="illustrate:vision", temperature=0.0,
              max_tokens=300, json_mode=True, timeout=90)
    try:
        return res.json()
    except Exception as e:  # noqa: BLE001
        # Не разобрали ответ - считаем это отказом проверки, картинку не пропускаем.
        return {"has_forbidden": True, "reason": f"ответ проверки не разобран: {e}"}


# ---------------------------------------------------------------------------
# MinIO (тот же приём, что db/seed/journal_from_tg.py: Store.put)
# ---------------------------------------------------------------------------

def minio_client():
    import boto3  # noqa: WPS433
    return boto3.client(
        "s3",
        endpoint_url=env("MINIO_ENDPOINT", "http://127.0.0.1:9002"),
        aws_access_key_id=env("MINIO_ACCESS_KEY"),
        aws_secret_access_key=env("MINIO_SECRET_KEY"),
        region_name="us-east-1",
    )


def minio_public_base() -> str:
    base = env("MINIO_PUBLIC_URL") or env("MINIO_ENDPOINT") or "http://127.0.0.1:9002"
    return base.rstrip("/")


def upload_image(draft_id: int, image_bytes: bytes) -> str:
    key = f"{MINIO_PREFIX}/draft-{draft_id}-{int(time.time())}.jpg"
    ctype = mimetypes.guess_type(key)[0] or "image/jpeg"
    minio_client().put_object(Bucket=MINIO_BUCKET, Key=key, Body=image_bytes,
                              ContentType=ctype, ACL="public-read")
    return f"{minio_public_base()}/{MINIO_BUCKET}/{key}"


# ---------------------------------------------------------------------------
# Промпт для картинки
# ---------------------------------------------------------------------------

def make_prompt(run: Run, d: dict[str, Any], fix_block: str = "") -> str:
    model = run.settings["models"]["writer"]
    res = chat(model, [
        {"role": "system", "content": prompts.ILLUSTRATOR_SYSTEM},
        {"role": "user", "content": prompts.ILLUSTRATOR_USER.format(
            title=d.get("title") or "(без заголовка)", body=d["body"], fix_block=fix_block)},
    ], run=run, purpose="illustrate:prompt", temperature=0.6, max_tokens=400)
    return res.text.strip().strip('"')


# ---------------------------------------------------------------------------
# Цепочка на один черновик
# ---------------------------------------------------------------------------

def illustrate_draft(run: Run, d: dict[str, Any]) -> dict[str, Any] | None:
    """Возвращает {"image_url", "image_prompt", "cost"} при успехе, иначе None
    (причина уже в run.log)."""
    vision_model = run.settings["models"]["judge_b"]
    fix_block = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        prompt_text = make_prompt(run, d, fix_block)
        run.log("черновик %s, попытка %d: промпт %r", d["id"], attempt, prompt_text[:120])
        try:
            image_bytes, source_url = kie_generate(run, prompt_text)
        except Exception as e:  # noqa: BLE001
            run.log("черновик %s: генерация не удалась (%s)", d["id"], e)
            if attempt >= MAX_ATTEMPTS:
                return None
            continue
        check = vision_check(run, vision_model, image_bytes, "image/jpeg")
        if not check.get("has_forbidden"):
            return {"prompt": prompt_text, "bytes": image_bytes, "source_url": source_url}
        reason = check.get("reason") or "не указано"
        run.log("черновик %s: проверка зрением нашла запрещённое (%s), попытка %d/%d",
                d["id"], reason, attempt, MAX_ATTEMPTS)
        fix_block = prompts.ILLUSTRATOR_FIX_BLOCK.format(reason=reason)
    run.log("черновик %s: %d попытки не прошли проверку, image_url не записан", d["id"], MAX_ATTEMPTS)
    return None


def load_drafts(conn, draft_id: int | None, limit: int) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        if draft_id:
            cur.execute("SELECT id, title, body, status, image_url FROM pipe_drafts WHERE id = %s AND lang = 'ru'",
                        (draft_id,))
        else:
            cur.execute(
                "SELECT id, title, body, status, image_url FROM pipe_drafts "
                "WHERE lang = 'ru' AND status IN ('review','approved') AND image_url IS NULL "
                "ORDER BY status = 'approved' DESC, updated_at LIMIT %s", (limit,))
        return [dict(r) for r in cur.fetchall()]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--draft", type=int, help="id черновика (ru)")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    with Run(STAGE, dry_run=args.dry_run) as run:
        from common import db
        conn = run.conn if run.conn is not None else db()
        limit = args.limit or int(run.settings["limits"]["max_posts_per_run"])

        drafts = load_drafts(conn, args.draft, limit)
        if args.draft and drafts and drafts[0].get("image_url") and not args.dry_run:
            run.log("черновик %s: image_url уже заполнен, для перегенерации сбросьте его сначала", args.draft)
            drafts = []
        run.items_in = len(drafts)
        run.log("к иллюстрации: %d", len(drafts))

        for d in drafts:
            result = illustrate_draft(run, d)
            if result is None:
                continue
            if run.conn is None:
                print(f"\n=== DRY-RUN: черновик {d['id']} ===")
                print("промпт:", result["prompt"])
                print("источник kie.ai:", result["source_url"])
                print("картинка:", len(result["bytes"]), "байт (в MinIO не загружена)")
                continue
            try:
                image_url = upload_image(d["id"], result["bytes"])
            except Exception as e:  # noqa: BLE001
                run.log("черновик %s: загрузка в MinIO не удалась (%s)", d["id"], e)
                continue
            with cursor(run) as cur:
                cur.execute(
                    "UPDATE pipe_drafts SET image_url = %s, image_prompt = %s, image_cost = %s WHERE id = %s",
                    (image_url, result["prompt"], IMAGE_COST_USD, d["id"]))
            run.conn.commit()
            run.items_out += 1
            run.log("черновик %s: картинка %s", d["id"], image_url)
        if run.conn is None:
            conn.close()


if __name__ == "__main__":
    main()
