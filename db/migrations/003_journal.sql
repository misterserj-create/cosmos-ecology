-- 003_journal.sql
--
-- Раздел «Журнал»: публикации, перенесённые из Telegram-канала, и всё, что
-- будет писаться дальше прямо в админке.
--
-- Устройство повторяет работы и события (см. 002_translations.sql):
--
--   1. Русский текст живёт в journal_posts и остаётся источником истины.
--      В journal_post_translations строк с lang='ru' нет, CHECK это
--      запрещает физически.
--
--   2. Адрес (slug) у каждого языка свой. Английская публикация живёт по
--      /en/journal/night-talk-in-the-studio, а не по транслиту русского:
--      транслит в англоязычной выдаче выглядит как мусор. Пока перевод
--      адреса не задан, на языке открывается русский slug - витрина ищет
--      по обоим.
--
--   3. source_hash - отпечаток русского оригинала (title, excerpt, body
--      через 0x1F, порядок задан JOURNAL_TRANSLATABLE в lib/translations.ts)
--      на момент перевода. Не совпал с текущим - админка показывает
--      «перевод устарел».
--
-- Медиа лежат в MinIO в том же бакете cosmos-ecology, в папке journal/
-- (journal/originals, journal/thumbs, journal/video). В базе - только
-- публичные адреса.

BEGIN;

CREATE TABLE IF NOT EXISTS journal_posts (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  published     BOOLEAN NOT NULL DEFAULT false,
  published_at  DATE,
  title         TEXT NOT NULL DEFAULT '',
  excerpt       TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  cover_url     TEXT NOT NULL DEFAULT '',
  gallery_urls  TEXT[] NOT NULL DEFAULT '{}',
  video_urls    TEXT[] NOT NULL DEFAULT '{}',
  source_links  TEXT[] NOT NULL DEFAULT '{}',
  source_tg_id  INT,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Лента просит «опубликованное, свежее сверху» - под это и индекс.
CREATE INDEX IF NOT EXISTS journal_posts_published_idx
  ON journal_posts (published, published_at DESC);

-- Повторный запуск скрипта загрузки из Telegram не должен плодить дубли.
CREATE UNIQUE INDEX IF NOT EXISTS journal_posts_source_tg_id_idx
  ON journal_posts (source_tg_id) WHERE source_tg_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS journal_post_translations (
  post_id      INT  NOT NULL REFERENCES journal_posts(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL CHECK (lang IN ('en','es','zh','fr','de','ja')),
  title        TEXT NOT NULL DEFAULT '',
  excerpt      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  slug         TEXT NOT NULL DEFAULT '',
  source_hash  TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, lang)
);

CREATE INDEX IF NOT EXISTS journal_post_translations_lang_idx
  ON journal_post_translations (lang);

-- Адрес на одном языке не может вести на две публикации. Пустой slug
-- («адрес ещё не переведён») под ограничение не попадает.
CREATE UNIQUE INDEX IF NOT EXISTS journal_post_translations_slug_idx
  ON journal_post_translations (lang, slug) WHERE slug <> '';

COMMENT ON COLUMN journal_posts.body IS
  'Текст публикации, абзацы разделены пустой строкой';
COMMENT ON COLUMN journal_posts.source_tg_id IS
  'id сообщения в Telegram-канале, откуда перенесена публикация';
COMMENT ON COLUMN journal_post_translations.slug IS
  'Адрес публикации на этом языке; пустой - открывается по русскому slug';
COMMENT ON COLUMN journal_post_translations.source_hash IS
  'sha256 русского оригинала (title, excerpt, body через 0x1F) на момент перевода';

COMMIT;
