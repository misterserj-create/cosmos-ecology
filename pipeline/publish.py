#!/usr/bin/env python3
"""Публикация одобренных русских постов в Telegram и ВКонтакте.

    python3 publish.py                 # крон: берёт approved, публикует, молчит, если нечего
    python3 publish.py --draft 7       # только этот черновик (кнопка «Опубликовать сейчас»)
    python3 publish.py --dry-run       # показать, что ушло бы, никуда не постить

Режим из pipe_settings.publish.mode:
  manual (по умолчанию) - публикуются только status=approved (одобрил человек);
  auto                  - ещё и status=review (прошли судей качества без человека).

Каналы: telegram_chat_id и vk_group_id из pipe_settings.publish (пустое =
канал выключен). Токены из .env: TELEGRAM_BOT_TOKEN, VK_USER_ACCESS_TOKEN.

Транспорт повторяет resonance_publish Резонанса (tg.py, vk.py), но на
requests. Семантика ошибок сохранена: обрыв до отправки - повтор безопасен;
обрыв после отправки - возможен дубль, пост помечается ошибкой и НЕ
переотправляется автоматически, решает человек.

Картинка (pipe_drafts.image_url, ставит illustrate.py) - необязательна: без
неё каналы получают тот же текстовый пост, что раньше. С картинкой в
Telegram уходит sendPhoto: если текст умещается в подпись (1024 знака) -
одним сообщением, иначе фото без подписи и отдельным sendMessage полный
текст следом. В ВК фото грузится через vk_upload_photos (из
publish_journal.py, тот же приём, что для журнала) и прикладывается к
wall.post.

Результат пишется в published_to: {"tg": {"ok": true, "message_id": ..,
"url": ..}, "vk": {...}}. Если один канал прошёл, а второй нет, черновик
остаётся approved с частичным published_to, и следующий прогон доотправит
только недостающий канал.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import Run, cursor, dump, env, has_long_dash  # noqa: E402

STAGE = "publish"
TG_TEXT_LIMIT = 4096
TG_CAPTION_LIMIT = 1024
VK_API = "https://api.vk.com/method"
VK_VERSION = "5.131"


class SendTimeout(RuntimeError):
    """Запрос ушёл и оборвался: сообщение могло быть принято, повтор = дубль."""


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

def _tg_call(token: str, method: str, payload: dict[str, Any], timeout: float = 30) -> Any:
    url = f"https://api.telegram.org/bot{token}/{method}"
    try:
        r = requests.post(url, json=payload, timeout=timeout)
    except (requests.ConnectionError, requests.exceptions.ConnectTimeout) as e:
        raise RuntimeError(f"tg: соединение не установлено (повтор безопасен): {e}")
    except (requests.Timeout, OSError) as e:
        raise SendTimeout(f"tg: запрос ушёл и оборвался (возможен дубль): {e}")
    try:
        data = r.json()
    except ValueError:
        raise RuntimeError(f"tg: не JSON {r.status_code} {r.text[:200]}")
    if not data.get("ok"):
        raise RuntimeError(f"tg: {r.status_code} {str(data)[:300]}")
    return data["result"]


def _text_chunks(text: str, limit: int = TG_TEXT_LIMIT) -> list[str]:
    """Режет по границам абзацев, не по середине слова (как в Резонансе)."""
    if len(text) <= limit:
        return [text]
    chunks, current = [], ""
    for para in text.split("\n\n"):
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            chunks.append(current)
            current = ""
        while len(para) > limit:
            cut = para.rfind("\n", 0, limit)
            if cut <= 0:
                cut = para.rfind(" ", 0, limit)
            if cut <= 0:
                cut = limit
            chunks.append(para[:cut])
            para = para[cut:].lstrip()
        current = para
    if current:
        chunks.append(current)
    return chunks


def tg_post_url(chat_id: str, message_id: int) -> str:
    s = str(chat_id)
    if s.startswith("@"):
        return f"https://t.me/{s[1:]}/{message_id}"
    if s.startswith("-100"):
        return f"https://t.me/c/{s[4:]}/{message_id}"
    return ""


def publish_telegram(text: str, chat_id: str, image_url: str | None = None) -> dict[str, Any]:
    token = env("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN не задан")
    t0 = time.time()
    if not image_url:
        first_id = None
        for i, chunk in enumerate(_text_chunks(text)):
            res = _tg_call(token, "sendMessage", {"chat_id": chat_id, "text": chunk,
                                                  "disable_web_page_preview": i > 0})
            if first_id is None:
                first_id = res["message_id"]
    elif len(text) <= TG_CAPTION_LIMIT:
        res = _tg_call(token, "sendPhoto", {"chat_id": chat_id, "photo": image_url, "caption": text})
        first_id = res["message_id"]
    else:
        res = _tg_call(token, "sendPhoto", {"chat_id": chat_id, "photo": image_url})
        first_id = res["message_id"]
        for i, chunk in enumerate(_text_chunks(text)):
            _tg_call(token, "sendMessage", {"chat_id": chat_id, "text": chunk,
                                            "disable_web_page_preview": i > 0})
    return {"ok": True, "message_id": first_id, "url": tg_post_url(chat_id, first_id),
            "duration_ms": int((time.time() - t0) * 1000),
            "published_at": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# ВКонтакте
# ---------------------------------------------------------------------------

def vk_token() -> str:
    """Токен из .env. Если задан RESONANCE_DSN, свежий токен читается из
    vk_tokens Резонанса (его обновляет wf_vk_token_refresh.py каждые 45 мин),
    а .env остаётся запасным."""
    dsn = env("RESONANCE_DSN")
    if dsn:
        try:
            import psycopg2
            with psycopg2.connect(dsn, connect_timeout=5) as conn, conn.cursor() as cur:
                cur.execute("SELECT access_token FROM vk_tokens WHERE service = 'vk' AND expires_at > NOW() LIMIT 1")
                row = cur.fetchone()
                if row and row[0]:
                    return row[0]
        except Exception as e:  # noqa: BLE001
            print(f"vk: токен из Резонанса не прочитан ({e}), беру из .env", flush=True)
    return env("VK_USER_ACCESS_TOKEN") or env("VK_GROUP_TOKEN")


def _vk_check(r: requests.Response) -> dict[str, Any]:
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"vk: {data['error'].get('error_msg', str(data['error'])[:200])}")
    if "response" not in data:
        raise RuntimeError(f"vk: неожиданный ответ {str(data)[:200]}")
    return data["response"]


def publish_vk(text: str, group_id: str, image_url: str | None = None) -> dict[str, Any]:
    token = vk_token()
    if not token:
        raise RuntimeError("VK_USER_ACCESS_TOKEN не задан")
    gid = int(str(group_id).lstrip("-"))
    t0 = time.time()
    attachments = ""
    if image_url:
        # publish_journal.py решает ту же задачу для журнала - переиспользуем
        # её загрузку фото, а не копируем логику сюда.
        from publish_journal import vk_upload_photos  # noqa: WPS433 (ленивый импорт против цикла)
        attachments = ",".join(vk_upload_photos(token, gid, [image_url]))
    try:
        r = requests.post(f"{VK_API}/wall.post", data={
            "owner_id": -gid, "from_group": 1, "message": text[:16000], "attachments": attachments,
            "access_token": token, "v": VK_VERSION}, timeout=15)
    except (requests.ConnectionError, requests.exceptions.ConnectTimeout) as e:
        raise RuntimeError(f"vk: соединение не установлено: {e}")
    except (requests.Timeout, OSError) as e:
        raise SendTimeout(f"vk: запрос ушёл и оборвался (возможен дубль): {e}")
    post_id = _vk_check(r)["post_id"]
    return {"ok": True, "post_id": post_id, "url": f"https://vk.com/wall-{gid}_{post_id}",
            "duration_ms": int((time.time() - t0) * 1000),
            "published_at": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# Прогон
# ---------------------------------------------------------------------------

def prepare_text(body: str, signature: str) -> str:
    text = (body or "").strip()
    if signature:
        text = f"{text}\n\n{signature.strip()}"
    return re.sub(r"\n{3,}", "\n\n", text)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--draft", type=int)
    ap.add_argument("--force", action="store_true", help="с --draft: публиковать даже status=draft/review")
    args = ap.parse_args()

    with Run(STAGE, dry_run=args.dry_run) as run:
        from common import db
        conn = run.conn if run.conn is not None else db()
        pub = run.settings["publish"]
        channels = {k: v for k, v in (("tg", pub.get("telegram_chat_id")), ("vk", pub.get("vk_group_id"))) if v}
        if not channels:
            run.log("каналы не настроены (pipe_settings.publish), нечего делать")
            return
        statuses = ("approved",) if pub.get("mode") != "auto" else ("approved", "review")
        with conn.cursor() as cur:
            if args.draft:
                cur.execute("SELECT * FROM pipe_drafts WHERE id = %s AND lang = 'ru'", (args.draft,))
                drafts = [dict(r) for r in cur.fetchall()]
                if drafts and drafts[0]["status"] not in statuses and not args.force:
                    raise RuntimeError(f"черновик {args.draft} в статусе {drafts[0]['status']}, нужен --force")
            else:
                cur.execute("SELECT * FROM pipe_drafts WHERE lang = 'ru' AND status = ANY(%s) ORDER BY reviewed_at NULLS LAST, id",
                            (list(statuses),))
                drafts = [dict(r) for r in cur.fetchall()]
        run.items_in = len(drafts)
        if not drafts:
            run.log("нечего публиковать (режим %s)", pub.get("mode"))
            return

        failures: list[str] = []
        for d in drafts:
            if has_long_dash(d["body"]):
                run.log("черновик %s: длинное тире в тексте, пропускаю до правки", d["id"])
                continue
            text = prepare_text(d["body"], run.settings["voice"].get("signature", ""))
            published = dict(d.get("published_to") or {})
            if run.conn is None:
                print(f"\n=== DRY-RUN: черновик {d['id']} ушёл бы в {', '.join(channels)} ===")
                print(text)
                continue
            for ch, target in channels.items():
                if published.get(ch, {}).get("ok"):
                    continue
                try:
                    image_url = d.get("image_url")
                    res = (publish_telegram(text, str(target), image_url) if ch == "tg"
                          else publish_vk(text, str(target), image_url))
                    published[ch] = res
                    run.log("черновик %s -> %s: %s", d["id"], ch, res.get("url") or res)
                except SendTimeout as e:
                    published[ch] = {"ok": False, "error": str(e)[:300], "needs_check": True,
                                     "at": datetime.now(timezone.utc).isoformat()}
                    run.log("черновик %s -> %s: %s", d["id"], ch, e)
                except Exception as e:  # noqa: BLE001
                    published[ch] = {"ok": False, "error": str(e)[:300],
                                     "at": datetime.now(timezone.utc).isoformat()}
                    run.log("черновик %s -> %s: ошибка %s", d["id"], ch, e)
            all_ok = all(published.get(ch, {}).get("ok") for ch in channels)
            with cursor(run) as cur:
                if all_ok:
                    cur.execute("UPDATE pipe_drafts SET status = 'published', published_at = NOW(), published_to = %s::jsonb WHERE id = %s",
                                (json.dumps(published, ensure_ascii=False), d["id"]))
                    run.items_out += 1
                else:
                    cur.execute("UPDATE pipe_drafts SET published_to = %s::jsonb WHERE id = %s",
                                (json.dumps(published, ensure_ascii=False), d["id"]))
            run.conn.commit()
            if not all_ok:
                failed = {ch: v.get("error") for ch, v in published.items() if not v.get("ok")}
                failures.append(f"черновик {d['id']}: не ушёл в {failed}")
        if run.conn is None:
            conn.close()
        if failures:
            raise RuntimeError("; ".join(failures))


if __name__ == "__main__":
    main()
