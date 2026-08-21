#!/usr/bin/env python3
"""
Перенос постов Telegram-канала в раздел «Журнал».

Читает tg_posts.json (разобранный экспорт канала), кладёт фото и видео в
MinIO и вставляет публикации в journal_posts. Повторный запуск безопасен:
вставка идёт через ON CONFLICT по source_tg_id, уже существующие посты
обновляются, а не дублируются.

Режимы:

  python3 journal_from_tg.py                 # сухой прогон: SQL на экран,
                                             # в MinIO и базу ничего не пишет
  python3 journal_from_tg.py --sql out.sql   # SQL в файл (тоже сухой прогон)
  python3 journal_from_tg.py --apply         # загрузка в MinIO и запись в базу

Окружение для --apply (то же, что у сайта, см. DEPLOY.md):

  DATABASE_URL        postgresql://user:pass@host:5432/cosmos_ecology
  MINIO_ENDPOINT      http://127.0.0.1:9002
  MINIO_PUBLIC_URL    https://media.185-125-103-160.sslip.io  (попадает в базу)
  MINIO_ACCESS_KEY, MINIO_SECRET_KEY

Зависимости: boto3 (MinIO), Pillow (превью), psycopg2 - если его нет,
SQL выполняется через psql из PATH.

Медиа берутся из папки экспорта Telegram (--media), пути в json относительны
ей. В MinIO файлы ложатся в бакет cosmos-ecology, папка journal/:
journal/originals/<имя>, journal/thumbs/<имя> (превью 400px, как у работ)
и journal/video/<имя>.

Правила текста:
  - заголовок: первый абзац без эмодзи; если он длиннее 160 знаков,
    обрезается по концу предложения, двоеточию или запятой;
  - excerpt: второй абзац, body: всё остальное;
  - длинное тире «—» заменяется средним «–» (канон сайта);
  - хвост из реакций (строки из одних эмодзи и цифр) отбрасывается.
"""

import argparse
import json
import mimetypes
import os
import re
import subprocess
import sys
from io import BytesIO
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUCKET = "cosmos-ecology"
PREFIX = "journal"

# ── Текст ────────────────────────────────────────────────────────────────

EMOJI_RE = re.compile(
    "["
    "\U0001F000-\U0001FAFF"  # пиктограммы, смайлы, транспорт, флаги
    "\U00002600-\U000027BF"  # разные символы и дингбаты (☀ ✔ ❤ ⚡ и т.п.)
    "\U00002B00-\U00002BFF"  # стрелки и звёзды (⭐)
    "\U0001F1E6-\U0001F1FF"  # флаги
    "‍️⃣"     # соединители и селекторы начертания
    "]+"
)

REACTION_LINE_RE = re.compile(r"^[\s\d\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍]*$")


def strip_emoji(s: str) -> str:
    s = EMOJI_RE.sub("", s)
    return re.sub(r"[ \t]{2,}", " ", s).strip()


def normalise_dashes(s: str) -> str:
    # Фразовое тире на сайте среднее «–». Телеграм ставит длинное «—».
    return s.replace("—", "–")


def clean_text(raw: str) -> str:
    raw = normalise_dashes(raw.replace("\r\n", "\n"))
    lines = [ln.rstrip() for ln in raw.split("\n")]
    # Хвост из реакций: экспорт Telegram дописывает после текста строки
    # вроде «⚡», «1», «❤», «1». Срезаем с конца всё, что состоит только из
    # эмодзи, цифр и пробелов.
    while lines and REACTION_LINE_RE.match(lines[-1]):
        lines.pop()
    return "\n".join(lines).strip()


def paragraphs(text: str) -> list[str]:
    parts = re.split(r"\n\s*\n", text)
    out = []
    for p in parts:
        p = " ".join(ln.strip() for ln in p.split("\n") if ln.strip())
        if p:
            out.append(p)
    return out


def make_title(first: str) -> str:
    t = strip_emoji(first)
    t = t.strip(" .:;,-–")
    if len(t) > 160:
        # Сначала конец предложения, потом двоеточие, потом запятая -
        # чтобы не резать посреди мысли. Окно чуть шире лимита: вопрос
        # длиной 175 знаков лучше лишних трёх слов с многоточием.
        head = t[:200]
        m = (re.search(r"[.!?…](\s|$)", head)
             or re.search(r":\s", head[:160])
             or re.search(r",\s", head[:160]))
        if m:
            t = t[: m.start() + 1].rstrip(".:,")
        else:
            t = t[:157].rsplit(" ", 1)[0] + "…"
    return t


# ── Slug ─────────────────────────────────────────────────────────────────

TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya",
}


def slugify(title: str, limit: int = 60) -> str:
    s = title.lower()
    s = "".join(TRANSLIT.get(ch, ch) for ch in s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if len(s) > limit:
        s = s[:limit].rsplit("-", 1)[0]
    return s or "post"


# ── SQL ──────────────────────────────────────────────────────────────────

def q(v) -> str:
    """Литерал для SQL: строка, NULL, число, дата или массив строк."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, (list, tuple)):
        if not v:
            return "'{}'::text[]"
        return "ARRAY[" + ", ".join(q(x) for x in v) + "]::text[]"
    s = str(v).replace("\\", "\\\\").replace("'", "''")
    return "E'" + s.replace("\n", "\\n") + "'"


def insert_sql(p: dict) -> str:
    cols = [
        "slug", "published", "published_at", "title", "excerpt", "body",
        "cover_url", "gallery_urls", "video_urls", "source_links",
        "source_tg_id", "tags",
    ]
    vals = [q(p[c]) for c in cols]
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "source_tg_id")
    return (
        f"INSERT INTO journal_posts ({', '.join(cols)})\n"
        f"VALUES ({', '.join(vals)})\n"
        f"ON CONFLICT (source_tg_id) WHERE source_tg_id IS NOT NULL\n"
        f"DO UPDATE SET {updates}, updated_at = NOW();\n"
    )


# ── MinIO ────────────────────────────────────────────────────────────────

class Store:
    def __init__(self, apply: bool):
        self.apply = apply
        self.public = os.environ.get("MINIO_PUBLIC_URL") or os.environ.get("MINIO_ENDPOINT") or "http://127.0.0.1:9002"
        self.public = self.public.rstrip("/")
        self.client = None
        if apply:
            import boto3  # noqa: WPS433
            self.client = boto3.client(
                "s3",
                endpoint_url=os.environ.get("MINIO_ENDPOINT", "http://127.0.0.1:9002"),
                aws_access_key_id=os.environ.get("MINIO_ACCESS_KEY", ""),
                aws_secret_access_key=os.environ.get("MINIO_SECRET_KEY", ""),
                region_name="us-east-1",
            )

    def url(self, key: str) -> str:
        return f"{self.public}/{BUCKET}/{key}"

    def put(self, key: str, body: bytes, content_type: str):
        if not self.apply:
            return
        self.client.put_object(
            Bucket=BUCKET, Key=key, Body=body, ContentType=content_type, ACL="public-read"
        )

    @staticmethod
    def safe_name(path: str) -> str:
        # Тот же приём, что в lib/storage.ts: всё кроме букв, цифр и точки в «_».
        return re.sub(r"[^a-z0-9.]", "_", Path(path).name, flags=re.I)

    def photo(self, media_dir: Path, rel: str) -> tuple[str, str]:
        name = self.safe_name(rel)
        src = media_dir / rel
        data = src.read_bytes()
        ctype = mimetypes.guess_type(src.name)[0] or "image/jpeg"
        self.put(f"{PREFIX}/originals/{name}", data, ctype)
        try:
            from PIL import Image
            im = Image.open(BytesIO(data))
            im = im.convert("RGB")
            im.thumbnail((400, 10_000))
            buf = BytesIO()
            im.save(buf, "JPEG", quality=80)
            self.put(f"{PREFIX}/thumbs/{name}", buf.getvalue(), "image/jpeg")
        except ImportError:
            print("  Pillow не установлен, превью пропущено:", name, file=sys.stderr)
        return self.url(f"{PREFIX}/originals/{name}"), self.url(f"{PREFIX}/thumbs/{name}")

    def video(self, media_dir: Path, rel: str) -> str:
        name = self.safe_name(rel)
        src = media_dir / rel
        ctype = mimetypes.guess_type(src.name)[0] or "video/mp4"
        self.put(f"{PREFIX}/video/{name}", src.read_bytes(), ctype)
        return self.url(f"{PREFIX}/video/{name}")


# ── Основной ход ─────────────────────────────────────────────────────────

def build_post(raw: dict, store: Store, media_dir: Path) -> dict:
    text = clean_text(raw["text"])
    paras = paragraphs(text)
    if not paras:
        raise ValueError(f"пост {raw['id']} без текста")
    title = make_title(paras[0])
    excerpt = paras[1] if len(paras) > 1 else ""
    body = "\n\n".join(paras[2:])

    gallery, videos = [], []
    for rel in raw.get("photos", []):
        if not (media_dir / rel).exists():
            print(f"  нет файла {rel}, пропущен", file=sys.stderr)
            continue
        full, _thumb = store.photo(media_dir, rel)
        gallery.append(full)
    for rel in raw.get("videos", []):
        if not (media_dir / rel).exists():
            print(f"  нет файла {rel}, пропущен", file=sys.stderr)
            continue
        videos.append(store.video(media_dir, rel))

    links = []
    for l in raw.get("links", []):
        if l not in links:
            links.append(l)

    tags = re.findall(r"#([\w\d_]+)", text)

    return {
        "slug": slugify(title),
        "published": True,
        "published_at": raw["date"][:10],
        "title": title,
        "excerpt": excerpt,
        "body": body,
        "cover_url": gallery[0] if gallery else "",
        "gallery_urls": gallery,
        "video_urls": videos,
        "source_links": links,
        "source_tg_id": int(raw["id"]),
        "tags": tags,
    }


def run_sql(sql: str):
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL не задан")
    try:
        import psycopg2  # noqa: WPS433
    except ImportError:
        psycopg2 = None
    if psycopg2:
        conn = psycopg2.connect(dsn)
        with conn, conn.cursor() as cur:
            cur.execute(sql)
        conn.close()
        return
    subprocess.run(["psql", dsn, "-v", "ON_ERROR_STOP=1"], input=sql.encode(), check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--posts", default=str(HERE / "tg_posts.json"), help="разобранные посты (json)")
    ap.add_argument("--media", default=os.environ.get("TG_EXPORT_DIR", ""), help="папка экспорта Telegram с photos/ и video_files/")
    ap.add_argument("--sql", default="", help="записать SQL в файл вместо экрана")
    ap.add_argument("--apply", action="store_true", help="загрузить медиа в MinIO и выполнить SQL")
    args = ap.parse_args()

    posts = json.loads(Path(args.posts).read_text("utf-8"))
    media_dir = Path(args.media) if args.media else Path(args.posts).parent
    store = Store(apply=args.apply)

    # Одинаковые slug у разных постов разводим суффиксом.
    seen: dict[str, int] = {}
    statements = ["BEGIN;\n"]
    for raw in sorted(posts, key=lambda r: (r["date"], r["id"])):
        p = build_post(raw, store, media_dir)
        base = p["slug"]
        if base in seen:
            seen[base] += 1
            p["slug"] = f"{base}-{seen[base]}"
        else:
            seen[base] = 1
        print(f"{p['published_at']}  tg#{p['source_tg_id']:<3} /journal/{p['slug']}  «{p['title']}»"
              f"  фото {len(p['gallery_urls'])}, видео {len(p['video_urls'])}", file=sys.stderr)
        statements.append(insert_sql(p))
    statements.append("COMMIT;\n")
    sql = "\n".join(statements)

    if args.sql:
        Path(args.sql).write_text(sql, "utf-8")
        print(f"SQL записан в {args.sql}", file=sys.stderr)
    elif not args.apply:
        sys.stdout.write(sql)

    if args.apply:
        run_sql(sql)
        print(f"Готово: {len(posts)} публикаций", file=sys.stderr)
    else:
        print("Сухой прогон: в MinIO и базу ничего не записано. Для записи добавьте --apply.", file=sys.stderr)


if __name__ == "__main__":
    main()
