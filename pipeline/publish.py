#!/usr/bin/env python3
"""Публикация одобренных русских постов в Telegram, ВКонтакте и журнал сайта.

    python3 publish.py                 # крон: берёт approved, публикует, молчит, если нечего
    python3 publish.py --draft 7       # только этот черновик (кнопка «Опубликовать сейчас»)
    python3 publish.py --dry-run       # показать, что ушло бы, никуда не постить

Режим из pipe_settings.publish.mode:
  manual (по умолчанию) - публикуются только status=approved (одобрил человек);
  auto                  - ещё и status=review (прошли судей качества без человека).

Каналы: telegram_chat_id, vk_group_id, x_account и site_enabled из
pipe_settings.publish (пустое или false = канал выключен). Журнал сайта
(site) заводит запись в journal_posts из русского черновика и строки в
journal_post_translations из его переводов; повторно тот же черновик записи
не плодит - он помечен в tags как 'pipeline:<id>'. Токены из .env: COSMOS_TG_BOT_TOKEN (свой бот канала, НЕ TELEGRAM_BOT_TOKEN - тот общий, инфраструктурный, для алертов common.py.alert()), VK_USER_ACCESS_TOKEN.

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
"url": ..}, "vk": {...}, "site": {"ok": true, "post_id": .., "url": ..}}.
Если один канал прошёл, а второй нет, черновик
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

from common import Run, cursor, dump, env, fix_long_dash, has_long_dash, slugify  # noqa: E402

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
    token = env("COSMOS_TG_BOT_TOKEN")
    if not token:
        raise RuntimeError("COSMOS_TG_BOT_TOKEN не задан")
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

# ---------------------------------------------------------------------------
# X (Twitter)
# ---------------------------------------------------------------------------
# Аккаунт @cosmosecology, тариф Pay Per Use. В X уходит английская версия
# поста: заголовок перевода, первые фразы до лимита в 280 знаков и ссылка на
# источник, картинка вложением. Ключи OAuth 1.0a в .env: X_API_KEY,
# X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (Access Token должен быть
# выпущен с правами Read and write).

X_TWEET_MAX = 280
X_URL_LEN = 23          # любая ссылка в X считается за 23 знака


def _x_session():
    from requests_oauthlib import OAuth1Session  # noqa: WPS433
    keys = [env(k) for k in ("X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET")]
    if not all(keys):
        raise RuntimeError("ключи X не заданы в .env (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)")
    return OAuth1Session(keys[0], client_secret=keys[1], resource_owner_key=keys[2], resource_owner_secret=keys[3])


def compose_tweet(title: str, body: str, source_url: str) -> str:
    """Заголовок + сколько влезет фраз + ссылка, в 280 знаков."""
    import re as _re
    text = (body or "").strip()
    text = _re.sub(r"\n+Source:.*$", "", text, flags=_re.S).strip()
    budget = X_TWEET_MAX - (X_URL_LEN + 2 if source_url else 0)
    head = (title or "").strip()
    out = head
    sentences = _re.split(r"(?<=[.!?])\s+", text)
    for sent in sentences:
        candidate = f"{out}\n\n{sent}" if out and not out.endswith(sent) else sent
        if len(candidate) > budget:
            break
        out = candidate
    if len(out) > budget:
        out = out[:budget - 1].rstrip() + "…"
    return f"{out}\n\n{source_url}" if source_url else out


def publish_x(title: str, body: str, source_url: str, image_url: str | None = None) -> dict[str, Any]:
    sess = _x_session()
    t0 = time.time()
    media_ids: list[str] = []
    if image_url:
        try:
            img = requests.get(image_url, timeout=60)
            img.raise_for_status()
            up = sess.post("https://upload.twitter.com/1.1/media/upload.json",
                           files={"media": ("image.jpg", img.content, "image/jpeg")}, timeout=60)
            if up.status_code == 200:
                media_ids = [str(up.json()["media_id"])]
            else:
                print(f"x: картинка не загрузилась ({up.status_code}): {up.text[:200]}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"x: картинка пропущена: {e}", flush=True)
    payload: dict[str, Any] = {"text": compose_tweet(title, body, source_url)}
    if media_ids:
        payload["media"] = {"media_ids": media_ids}
    r = sess.post("https://api.twitter.com/2/tweets", json=payload, timeout=30)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"x: {r.status_code} {r.text[:300]}")
    tweet_id = r.json()["data"]["id"]
    return {"ok": True, "tweet_id": tweet_id, "url": f"https://x.com/cosmosecology/status/{tweet_id}",
            "duration_ms": int((time.time() - t0) * 1000),
            "published_at": datetime.now(timezone.utc).isoformat()}


def english_version(conn, draft_id: int) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute("SELECT title, body FROM pipe_drafts WHERE parent_id = %s AND lang = 'en' ORDER BY id DESC LIMIT 1",
                    (draft_id,))
        row = cur.fetchone()
    if not row:
        return None
    return dict(row) if isinstance(row, dict) else {"title": row[0], "body": row[1]}


# ---------------------------------------------------------------------------
# Журнал сайта
# ---------------------------------------------------------------------------
# Третий канал. В соцсети уходит текст, а в журнал на cosmosecology.ru -
# запись: русский оригинал в journal_posts и все переводы, что успели
# появиться у черновика, в journal_post_translations. Схема журнала описана
# в db/migrations/003_journal.sql: русский текст - источник истины, у
# перевода свой адрес, пустой адрес значит «открывается по русскому».
#
# Что запись пришла из тракта, видно по метке в tags ('pipeline:<id>
# черновика') - тем же приёмом, каким publish_journal.py помечает уже
# отправленное в соцсети ('vk:<id>', 'tg:<id>'). По этой метке ловится и
# повторная публикация: дубль записи не создаётся.

SITE_URL = "https://cosmosecology.ru"
SITE_TAG_PREFIX = "pipeline:"
EXCERPT_LIMIT = 200
# Адрес перевода имеет смысл только там, где заголовок пишется латиницей.
# Из китайского и японского транслит даёт пустоту, и такой перевод живёт по
# русскому адресу - витрина ищет и по нему (lib/db.ts, dbJournalBySlug).
SLUG_LANGS = ("en", "es", "fr", "de")
# Хвост «Источник: <url>» (в переводе - на своём языке) в теле записи не
# нужен: у журнала для этого есть source_links.
SOURCE_LINE = re.compile(r"^[^\n]{0,60}?(https?://\S+)\s*$")
JOURNAL_LANGS = ("en", "es", "zh", "fr", "de", "ja")


def site_tag(draft_id: int) -> str:
    return f"{SITE_TAG_PREFIX}{draft_id}"


def split_source(body: str) -> tuple[str, list[str]]:
    """Отрезает от текста завершающие строки со ссылкой на источник."""
    lines = (body or "").rstrip().split("\n")
    links: list[str] = []
    while lines:
        m = SOURCE_LINE.match(lines[-1].strip())
        if not m:
            break
        links.insert(0, m.group(1).rstrip(".,;)"))
        lines.pop()
        while lines and not lines[-1].strip():
            lines.pop()
    return "\n".join(lines).strip(), links


def make_excerpt(body: str, limit: int = EXCERPT_LIMIT) -> str:
    """Первый абзац целиком, если он короткий, иначе начало по границе
    предложения. Многоточие остаётся крайним случаем: обрубок на середине
    фразы в анонсе ленты читается хуже, чем лишние пара слов."""
    first = re.sub(r"\s+", " ", (body or "").strip().split("\n\n")[0]).strip()
    if len(first) <= limit:
        return first
    window = first[:limit + 40]
    ends = list(re.finditer(r"[.!?…](\s|$)", window))
    if ends:
        return window[:ends[-1].start() + 1].strip()
    return window[:limit].rsplit(" ", 1)[0].rstrip(" ,;:-–") + "…"


def journal_hash(title: str, excerpt: str, body: str) -> str:
    """Отпечаток русского оригинала так, как его считает сайт: sha256 от
    title, excerpt, body через 0x1F (JOURNAL_TRANSLATABLE в lib/translations.ts).
    Не совпал с текущим - админка покажет «перевод устарел»."""
    import hashlib  # noqa: WPS433
    return hashlib.sha256("\x1f".join([title, excerpt, body]).encode("utf-8")).hexdigest()


def unique_slug(conn, title: str, lang: str = "ru") -> str:
    """Свободный адрес: у journal_posts.slug и у пары (lang, slug) переводов
    ограничение на уникальность, повтор заголовка развели бы падением."""
    base = slugify(title)
    with conn.cursor() as cur:
        for n in range(1, 50):
            candidate = base if n == 1 else f"{base}-{n}"
            if lang == "ru":
                cur.execute("SELECT 1 FROM public.journal_posts WHERE slug = %s", (candidate,))
            else:
                cur.execute("SELECT 1 FROM public.journal_post_translations WHERE lang = %s AND slug = %s",
                            (lang, candidate))
            if not cur.fetchone():
                return candidate
    return f"{base}-{int(time.time())}"


def translations_of(conn, draft_id: int) -> list[dict[str, Any]]:
    """Переводы черновика, по одному свежему на язык."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT ON (lang) lang, title, body FROM pipe_drafts "
            "WHERE parent_id = %s AND lang <> 'ru' AND lang = ANY(%s) "
            "ORDER BY lang, id DESC", (draft_id, list(JOURNAL_LANGS)))
        return [dict(r) for r in cur.fetchall()]


def existing_site_post(conn, draft_id: int) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute("SELECT id, slug FROM public.journal_posts WHERE %s = ANY(tags) LIMIT 1",
                    (site_tag(draft_id),))
        row = cur.fetchone()
    return dict(row) if row else None


def site_payload(conn, draft: dict[str, Any], tz_name: str = "Europe/Moscow") -> dict[str, Any]:
    """Что именно ляжет в журнал. Ничего не пишет: тем же вызовом
    пользуется dry-run."""
    body, links = split_source(fix_long_dash(draft.get("body") or ""))
    title = fix_long_dash((draft.get("title") or "").strip()) or make_excerpt(body, 120)
    excerpt = make_excerpt(body)
    when = draft.get("published_at") or _now_local(tz_name)
    translations = []
    for t in translations_of(conn, draft["id"]):
        t_body, _ = split_source(fix_long_dash(t.get("body") or ""))
        t_title = fix_long_dash((t.get("title") or "").strip()) or make_excerpt(t_body, 120)
        t_slug = ""
        # Заголовок без латинских букв даёт адрес вроде «11-60»: такой
        # перевод лучше оставить на русском адресе.
        if t["lang"] in SLUG_LANGS and re.search(r"[a-z]{3}", slugify(t_title)):
            t_slug = unique_slug(conn, t_title, t["lang"])
        translations.append({"lang": t["lang"], "title": t_title, "excerpt": make_excerpt(t_body),
                             "body": t_body, "slug": t_slug})
    return {
        "slug": unique_slug(conn, title),
        "published_at": when.date() if hasattr(when, "date") else when,
        "title": title,
        "excerpt": excerpt,
        "body": body,
        "cover_url": draft.get("image_url") or "",
        "source_links": links,
        "tags": [site_tag(draft["id"])],
        "translations": translations,
    }


def publish_site(conn, draft: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    """Заводит запись журнала и переводы к ней. Пишет в то же соединение,
    что и главный цикл, и не коммитит: запись и отметка в published_to
    закрываются одной транзакцией."""
    t0 = time.time()
    exists = existing_site_post(conn, draft["id"])
    if exists:
        return {"ok": True, "post_id": exists["id"], "url": f"{SITE_URL}/journal/{exists['slug']}",
                "existing": True, "published_at": datetime.now(timezone.utc).isoformat()}
    src_hash = journal_hash(payload["title"], payload["excerpt"], payload["body"])
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO public.journal_posts (slug, published, published_at, title, excerpt, body, "
            "cover_url, source_links, tags) VALUES (%s, true, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (payload["slug"], payload["published_at"], payload["title"], payload["excerpt"],
             payload["body"], payload["cover_url"], payload["source_links"], payload["tags"]))
        row = cur.fetchone()
        post_id = row["id"] if isinstance(row, dict) else row[0]
        for tr in payload["translations"]:
            cur.execute(
                "INSERT INTO public.journal_post_translations (post_id, lang, title, excerpt, body, slug, source_hash) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (post_id, lang) DO UPDATE SET "
                "title = EXCLUDED.title, excerpt = EXCLUDED.excerpt, body = EXCLUDED.body, "
                "slug = EXCLUDED.slug, source_hash = EXCLUDED.source_hash, updated_at = NOW()",
                (post_id, tr["lang"], tr["title"], tr["excerpt"], tr["body"], tr["slug"], src_hash))
    return {"ok": True, "post_id": post_id, "url": f"{SITE_URL}/journal/{payload['slug']}",
            "langs": [t["lang"] for t in payload["translations"]],
            "duration_ms": int((time.time() - t0) * 1000),
            "published_at": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# Очередь автопубликации
# ---------------------------------------------------------------------------

def _now_local(tz_name: str) -> datetime:
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(tz_name))
    except Exception:  # noqa: BLE001
        return datetime.now(timezone.utc)


def pick_for_slot(run: Run, conn, drafts: list[dict[str, Any]], pub: dict[str, Any]) -> list[dict[str, Any]]:
    """Из очереди выбирает, что публиковать в этот прогон.

    Слот открыт, если сегодня один из дней schedule.days и текущий час не
    раньше schedule.hour (по schedule.tz). В слот уходит один пост - самый
    ранний из тех, кто пролежал не меньше hold_hours. Если сегодня уже что-то
    публиковалось - слот занят. Явно одобренные человеком (approved) идут
    вне очереди, как и раньше.
    """
    sched = pub.get("schedule") or {}
    days = [int(x) for x in (sched.get("days") or [1, 3, 5])]          # 1=пн ... 7=вс
    hour = int(sched.get("hour", 11))
    hold_hours = float(pub.get("hold_hours", 6))
    tz_name = sched.get("tz") or "Europe/Moscow"
    now = _now_local(tz_name)

    approved = [d for d in drafts if d["status"] == "approved"]
    queued = [d for d in drafts if d["status"] == "review"]

    if now.isoweekday() not in days or now.hour < hour:
        run.log("очередь: слот закрыт (%s %02d:%02d, дни %s, час %s), в очереди %s",
                now.strftime("%a"), now.hour, now.minute, days, hour, len(queued))
        return approved

    with conn.cursor() as cur:
        cur.execute("""SELECT count(*) AS n FROM pipe_drafts
                        WHERE lang='ru' AND status='published'
                          AND published_at >= (now() AT TIME ZONE %s)::date""", (tz_name,))
        row = cur.fetchone()
        today = (row["n"] if isinstance(row, dict) else row[0]) if row else 0
    if today:
        run.log("очередь: сегодня уже опубликовано %s, слот занят; в очереди %s", today, len(queued))
        return approved

    ready = []
    for d in queued:
        created = d.get("created_at")
        if created is None:
            ready.append(d); continue
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_h = (datetime.now(timezone.utc) - created.astimezone(timezone.utc)).total_seconds() / 3600
        if age_h >= hold_hours:
            ready.append(d)
    ready.sort(key=lambda d: (d.get("created_at") or datetime.min.replace(tzinfo=timezone.utc), d["id"]))
    chosen = ready[:1]
    run.log("очередь: слот открыт, выдержали %s ч: %s из %s, берём %s",
            hold_hours, len(ready), len(queued), [d["id"] for d in chosen])
    return approved + chosen


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
        # Журнал сайта идёт последним: сетевые каналы могут упасть, а он
        # пишет в ту же транзакцию, что и отметка published_to.
        channels = {k: v for k, v in (("tg", pub.get("telegram_chat_id")), ("vk", pub.get("vk_group_id")),
                                      ("x", pub.get("x_account")), ("site", pub.get("site_enabled"))) if v}
        if not channels:
            run.log("каналы не настроены (pipe_settings.publish), нечего делать")
            return
        # Режимы:
        #   manual - публикуется только то, что человек одобрил;
        #   auto   - очередь. Пост, прошедший проверки (review), сам идёт в
        #            публикацию, но не сразу и не всё подряд: по расписанию
        #            (дни недели и час из pipe_settings.publish.schedule), по
        #            одному за слот, и только если пролежал в очереди не
        #            меньше hold_hours - это окно, в котором человек может
        #            зайти и снять или поправить пост. Что отклонено руками
        #            (rejected), не уходит никогда.
        auto = pub.get("mode") == "auto"
        statuses = ("approved", "review") if auto else ("approved",)
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

        if auto and not args.draft:
            drafts = pick_for_slot(run, conn, drafts, pub)
        run.items_in = len(drafts)
        if not drafts:
            run.log("нечего публиковать (режим %s)", pub.get("mode"))
            return

        # Дата записи в журнале - календарная, по часовому поясу проекта.
        tz_name = ((pub.get("schedule") or {}).get("tz")
                   or run.settings["schedule"].get("tz") or "Europe/Moscow")
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
                if "site" in channels:
                    payload = site_payload(conn, d, tz_name)
                    exists = existing_site_post(conn, d["id"])
                    print("\n--- журнал сайта ---")
                    if exists or published.get("site", {}).get("ok"):
                        print(f"запись уже есть (post_id={(exists or {}).get('id')}), "
                              f"дубль не создаётся")
                    dump({k: v for k, v in payload.items() if k != "translations"})
                    print(f"переводов: {len(payload['translations'])} "
                          f"({', '.join(t['lang'] for t in payload['translations']) or 'нет'})")
                    for t in payload["translations"]:
                        print(f"  {t['lang']}: slug={t['slug'] or '(русский)'} "
                              f"«{t['title'][:60]}» / {t['excerpt'][:80]}")
                continue
            for ch, target in channels.items():
                if published.get(ch, {}).get("ok"):
                    continue
                try:
                    image_url = d.get("image_url")
                    if ch == "x":
                        en = english_version(conn, d["id"])
                        if not en:
                            # Перевод появляется после одобрения; без него X
                            # ждёт следующего прогона, остальные каналы не держим.
                            run.log("черновик %s -> x: английского перевода ещё нет, отложено", d["id"])
                            continue
                        source = ""
                        m = re.search(r"Источник:\s*(\S+)", d.get("body") or "")
                        if m:
                            source = m.group(1)
                        res = publish_x(en["title"], en["body"], source, image_url)
                    elif ch == "site":
                        res = publish_site(conn, d, site_payload(conn, d, tz_name))
                    else:
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
