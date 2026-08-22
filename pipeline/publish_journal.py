#!/usr/bin/env python3
"""
Публикация готовых записей журнала (journal_posts) в ВК и Telegram с фото.

Отличается от publish.py: тот работает с черновиками тракта и шлёт текст,
а здесь - уже вышедшие в журнале публикации с обложкой и галереей. Нужен
для первичного наполнения группы ВК и для ручного «продублируй в соцсети».

    python3 publish_journal.py --vk 10            # десять свежих в ВК
    python3 publish_journal.py --tg 3             # три свежих в Telegram
    python3 publish_journal.py --vk 10 --tg 3
    python3 publish_journal.py --ids 4,7 --vk 2   # конкретные
    python3 publish_journal.py --vk 10 --dry-run

Что уже ушло, помечается в journal_posts.tags ('vk:<post_id>', 'tg:<msg_id>'),
повторно не отправляется. Картинки берутся из хранилища по cover_url и
gallery_urls, до 10 штук в ВК и в альбом Telegram.
"""
from __future__ import annotations

import argparse
import io
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import db, env, fix_long_dash  # noqa: E402
from publish import VK_API, VK_VERSION, _tg_call, _vk_check, tg_post_url, vk_token  # noqa: E402

SITE = "https://cosmosecology.ru"
TG_CAPTION_MAX = 1024
TG_TEXT_MAX = 4096
VK_MAX_PHOTOS = 10


def load_settings(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute("SELECT value FROM pipeline.pipe_settings WHERE key='publish'")
        row = cur.fetchone()
    # Курсор в common.db() отдаёт словари.
    v = (row["value"] if isinstance(row, dict) else row[0]) if row else {}
    return {"tg": str(v.get("telegram_chat_id") or ""), "vk": str(v.get("vk_group_id") or "")}


def fetch_posts(conn, ids: list[int] | None, channel: str, limit: int) -> list[dict[str, Any]]:
    tag_prefix = f"{channel}:"
    with conn.cursor() as cur:
        if ids:
            cur.execute("""SELECT id, slug, title, excerpt, body, cover_url, gallery_urls, published_at, tags
                           FROM journal_posts WHERE id = ANY(%s) ORDER BY published_at DESC""", (ids,))
        else:
            cur.execute("""SELECT id, slug, title, excerpt, body, cover_url, gallery_urls, published_at, tags
                           FROM journal_posts WHERE published ORDER BY published_at DESC""")
        rows = [dict(r) for r in cur.fetchall()]
    out = []
    for r in rows:
        if any(str(t).startswith(tag_prefix) for t in (r.get("tags") or [])):
            continue
        out.append(r)
        if len(out) >= limit:
            break
    return out


def mark(conn, post_id: int, tag: str) -> None:
    with conn.cursor() as cur:
        cur.execute("UPDATE journal_posts SET tags = array_append(COALESCE(tags,'{}'), %s) WHERE id=%s", (tag, post_id))
    conn.commit()


def compose(p: dict[str, Any], with_link: bool = True) -> str:
    parts = [p["title"].strip()]
    text = (p.get("body") or "").strip()
    if p.get("excerpt") and p["excerpt"].strip() and p["excerpt"].strip() not in text:
        text = p["excerpt"].strip() + ("\n\n" + text if text else "")
    if text:
        parts.append(text)
    if with_link:
        parts.append(f"Подробнее: {SITE}/journal/{p['slug']}")
    return fix_long_dash(re.sub(r"\n{3,}", "\n\n", "\n\n".join(parts)))


def photos_of(p: dict[str, Any], limit: int) -> list[str]:
    urls: list[str] = []
    for u in [p.get("cover_url")] + list(p.get("gallery_urls") or []):
        if u and u not in urls:
            urls.append(u)
    # Обложка - уменьшенная копия из thumbs; в пост лучше оригинал, если есть.
    urls = [u.replace("/journal/thumbs/", "/journal/originals/") for u in urls]
    return urls[:limit]


def download(url: str) -> bytes:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.content


# ---------------------------------------------------------------------------
# ВК
# ---------------------------------------------------------------------------

def vk_upload_photos(token: str, gid: int, urls: list[str]) -> list[str]:
    atts = []
    for u in urls:
        r = requests.post(f"{VK_API}/photos.getWallUploadServer",
                          data={"group_id": gid, "access_token": token, "v": VK_VERSION}, timeout=15)
        upload_url = _vk_check(r)["upload_url"]
        data = download(u)
        for attempt in range(3):
            up = requests.post(upload_url, files={"photo": ("photo.jpg", io.BytesIO(data), "image/jpeg")}, timeout=60)
            try:
                j = up.json()
                if j.get("photo") and j.get("photo") != "[]":
                    break
            except ValueError:
                pass
            time.sleep(3 + attempt * 3)
        else:
            raise RuntimeError(f"vk: фото не загрузилось после 3 попыток: {u}")
        r = requests.post(f"{VK_API}/photos.saveWallPhoto", data={
            "group_id": gid, "server": j["server"], "hash": j["hash"], "photo": j["photo"],
            "access_token": token, "v": VK_VERSION}, timeout=15)
        saved = _vk_check(r)[0]
        atts.append(f"photo{saved['owner_id']}_{saved['id']}")
        time.sleep(0.4)
    return atts


def publish_vk_post(p: dict[str, Any], group_id: str, dry: bool) -> dict[str, Any]:
    gid = int(str(group_id).lstrip("-"))
    text = compose(p)
    urls = photos_of(p, VK_MAX_PHOTOS)
    if dry:
        return {"dry": True, "chars": len(text), "photos": len(urls)}
    token = vk_token()
    atts = vk_upload_photos(token, gid, urls) if urls else []
    r = requests.post(f"{VK_API}/wall.post", data={
        "owner_id": -gid, "from_group": 1, "message": text[:16000],
        "attachments": ",".join(atts), "access_token": token, "v": VK_VERSION}, timeout=20)
    post_id = _vk_check(r)["post_id"]
    return {"post_id": post_id, "url": f"https://vk.com/wall-{gid}_{post_id}", "photos": len(atts)}


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

def publish_tg_post(p: dict[str, Any], chat_id: str, dry: bool) -> dict[str, Any]:
    token = env("TELEGRAM_BOT_TOKEN")
    text = compose(p)
    urls = photos_of(p, 10)
    if dry:
        return {"dry": True, "chars": len(text), "photos": len(urls)}
    if not urls:
        res = _tg_call(token, "sendMessage", {"chat_id": chat_id, "text": text[:TG_TEXT_MAX]})
        return {"message_id": res["message_id"], "url": tg_post_url(chat_id, res["message_id"]), "photos": 0}
    # Короткий текст помещается в подпись к альбому; длинный уходит отдельным
    # сообщением сразу после альбома.
    caption_fits = len(text) <= TG_CAPTION_MAX
    media = [{"type": "photo", "media": u} for u in urls]
    if caption_fits:
        media[0]["caption"] = text
    res = _tg_call(token, "sendMediaGroup", {"chat_id": chat_id, "media": __import__("json").dumps(media)})
    first = res[0]["message_id"] if isinstance(res, list) else res["message_id"]
    if not caption_fits:
        _tg_call(token, "sendMessage", {"chat_id": chat_id, "text": text[:TG_TEXT_MAX],
                                        "disable_web_page_preview": True})
    return {"message_id": first, "url": tg_post_url(chat_id, first), "photos": len(urls)}


# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vk", type=int, default=0, help="сколько публикаций отправить в ВК")
    ap.add_argument("--tg", type=int, default=0, help="сколько публикаций отправить в Telegram")
    ap.add_argument("--ids", help="конкретные id через запятую")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--pause", type=float, default=20.0, help="пауза между постами, сек")
    args = ap.parse_args()
    ids = [int(x) for x in args.ids.split(",")] if args.ids else None

    conn = db()
    chans = load_settings(conn)
    for ch, n, fn in (("vk", args.vk, publish_vk_post), ("tg", args.tg, publish_tg_post)):
        if not n:
            continue
        if not chans[ch]:
            print(f"{ch}: адрес назначения не задан в настройках", flush=True)
            continue
        posts = fetch_posts(conn, ids, ch, n)
        print(f"{ch}: к отправке {len(posts)}", flush=True)
        # Старые сверху, чтобы в ленте группы порядок совпал с хронологией.
        for p in reversed(posts):
            try:
                res = fn(p, chans[ch], args.dry_run)
            except Exception as e:  # noqa: BLE001
                print(f"  {ch} #{p['id']} ОШИБКА: {e}", flush=True)
                continue
            print(f"  {ch} #{p['id']} {p['title'][:50]!r}: {res}", flush=True)
            if not args.dry_run:
                mark(conn, p["id"], f"{ch}:{res.get('post_id') or res.get('message_id')}")
                time.sleep(args.pause)


if __name__ == "__main__":
    main()
