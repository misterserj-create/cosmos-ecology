-- 002_translations.sql
--
-- Переводы текстов работ и событий.
--
-- Каталога миграций до этой правки в проекте не было: первой миграцией
-- считается scripts/schema.sql (создание artworks и events) - она и есть
-- условная 001. Дальше нумеруем подряд, файлы применяются по возрастанию.
--
-- Три решения, которые здесь зашиты:
--
--   1. Русский остаётся в artworks и events. Строки с lang='ru' в таблицах
--      переводов нет и быть не должно: иначе русский текст пришлось бы
--      держать в двух местах и следить, какое из них правдивее. Проверка
--      CHECK на список языков это запрещает физически.
--
--   2. Переводятся только свободные тексты. Техника, статус, категория и
--      тип события - короткие перечисления с десятком значений на всю базу;
--      их переводы лежат в коде (lib/site.ts), а не строками в базе, иначе
--      одно и то же слово «Артсайклинг» переводилось бы по 49 раз.
--
--   3. source_hash - отпечаток русского оригинала на момент перевода.
--      Считается в коде (lib/translations.ts): sha256 от переводимых полей
--      русской строки, склеенных через символ 0x1F (разделитель единиц).
--      Порядок полей задан там же константами ARTWORK_TRANSLATABLE и
--      EVENT_TRANSLATABLE и менять его нельзя - иначе все переводы разом
--      станут «устаревшими». Если отпечаток не совпал с текущим русским
--      текстом, значит русский поправили после перевода, и админка
--      показывает пометку «перевод устарел».

BEGIN;

CREATE TABLE IF NOT EXISTS artwork_translations (
  artwork_id   INT  NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL CHECK (lang IN ('en','es','zh','fr','de','ja')),
  title        TEXT NOT NULL DEFAULT '',
  materials    TEXT NOT NULL DEFAULT '',
  desc_short   TEXT NOT NULL DEFAULT '',
  curator_text TEXT NOT NULL DEFAULT '',
  source_hash  TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (artwork_id, lang)
);

CREATE TABLE IF NOT EXISTS event_translations (
  event_id     INT  NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL CHECK (lang IN ('en','es','zh','fr','de','ja')),
  title        TEXT NOT NULL DEFAULT '',
  place        TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  source_hash  TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, lang)
);

-- Витрина всегда просит один язык разом: «все работы по-английски».
-- Первичный ключ начинается с id сущности и такому запросу не помогает.
CREATE INDEX IF NOT EXISTS artwork_translations_lang_idx ON artwork_translations (lang);
CREATE INDEX IF NOT EXISTS event_translations_lang_idx   ON event_translations (lang);

COMMENT ON COLUMN artwork_translations.source_hash IS
  'sha256 русского оригинала (title, materials, desc_short, curator_text через 0x1F) на момент перевода';
COMMENT ON COLUMN event_translations.source_hash IS
  'sha256 русского оригинала (title, place, description через 0x1F) на момент перевода';

COMMIT;
