-- 004_pipeline.sql
--
-- Контент-тракт «Экологии Космоса»: сбор новостей, отбор, посты, переводы,
-- публикация. Одна схема pipeline в той же базе cosmos_db, чтобы таблицы
-- тракта не смешивались с таблицами сайта (artworks, events).
--
-- Номер 004: миграции 003 в проекте нет, номер пропущен намеренно, чтобы
-- не спорить с ветками, где 003 может появиться (i18n-db, journal).
--
-- Применение:  psql "$DATABASE_URL" -f db/migrations/004_pipeline.sql
-- Повторный запуск безопасен: везде IF NOT EXISTS и ON CONFLICT DO NOTHING.

BEGIN;

CREATE SCHEMA IF NOT EXISTS pipeline;

-- Откуда берём находки. kind: search (запрос в Perplexity), rss (лента),
-- manual (ссылку вставил человек в админке).
CREATE TABLE IF NOT EXISTS pipeline.pipe_sources (
  id            SERIAL PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('search', 'rss', 'manual')),
  query_or_url  TEXT NOT NULL,
  topic         TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  organization  TEXT NOT NULL DEFAULT '',
  language      TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  feed_kind     TEXT,                                   -- rss|atom|api|page|null
  authority     INT  NOT NULL DEFAULT 0 CHECK (authority BETWEEN 0 AND 5),
  notes         TEXT NOT NULL DEFAULT '',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at   TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, query_or_url)
);

-- Находки. url уникален: один и тот же материал из RSS и из поиска ложится
-- одной строкой. url хранится нормализованным (без utm и якорей), исходный
-- адрес лежит в raw->>'url_raw'.
CREATE TABLE IF NOT EXISTS pipeline.pipe_findings (
  id             SERIAL PRIMARY KEY,
  source_id      INT REFERENCES pipeline.pipe_sources(id) ON DELETE SET NULL,
  url            TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL DEFAULT '',
  summary        TEXT NOT NULL DEFAULT '',
  published_at   TIMESTAMPTZ,
  found_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw            JSONB NOT NULL DEFAULT '{}'::jsonb,
  score          NUMERIC(4,2),
  verdict        TEXT NOT NULL DEFAULT 'new'
                 CHECK (verdict IN ('new', 'accepted', 'rejected', 'duplicate')),
  verdict_reason TEXT NOT NULL DEFAULT '',
  judged_at      TIMESTAMPTZ,
  model_cost     NUMERIC(10,6) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pipe_findings_verdict_idx ON pipeline.pipe_findings (verdict, found_at DESC);

-- Черновики. Русский пост и его переводы - отдельные строки, переводы
-- ссылаются на русский через parent_id. status у перевода повторяет статус
-- родителя в момент перевода и дальше живёт сам.
CREATE TABLE IF NOT EXISTS pipeline.pipe_drafts (
  id            SERIAL PRIMARY KEY,
  finding_id    INT REFERENCES pipeline.pipe_findings(id) ON DELETE SET NULL,
  parent_id     INT REFERENCES pipeline.pipe_drafts(id) ON DELETE CASCADE,
  lang          TEXT NOT NULL DEFAULT 'ru'
                CHECK (lang IN ('ru','en','es','zh','fr','de','ja')),
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','review','approved','published','rejected')),
  quality       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- оценки судей
  fact_check    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- расхождения с источником
  created_by    TEXT NOT NULL DEFAULT '',             -- модель-автор
  reviewed_by   TEXT,
  reviewed_at   TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  published_to  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"tg": {...}, "vk": {...}}
  model_cost    NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pipe_drafts_status_idx ON pipeline.pipe_drafts (status, lang, created_at DESC);
CREATE INDEX IF NOT EXISTS pipe_drafts_parent_idx ON pipeline.pipe_drafts (parent_id);

-- Журнал прогонов: одна строка на запуск каждого этапа.
CREATE TABLE IF NOT EXISTS pipeline.pipe_runs (
  id          SERIAL PRIMARY KEY,
  stage       TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  ok          BOOLEAN,
  items_in    INT NOT NULL DEFAULT 0,
  items_out   INT NOT NULL DEFAULT 0,
  cost        NUMERIC(10,6) NOT NULL DEFAULT 0,
  log         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS pipe_runs_stage_idx ON pipeline.pipe_runs (stage, started_at DESC);

-- Настройки: темы, пороги, модели, промпты, режим публикации.
CREATE TABLE IF NOT EXISTS pipeline.pipe_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Журнал каждого обращения к модели: откуда приходят суммы в model_cost и
-- pipe_runs.cost и где смотреть расход по моделям.
CREATE TABLE IF NOT EXISTS pipeline.pipe_api_calls (
  id                SERIAL PRIMARY KEY,
  run_id            INT REFERENCES pipeline.pipe_runs(id) ON DELETE SET NULL,
  stage             TEXT NOT NULL,
  purpose           TEXT NOT NULL DEFAULT '',
  model             TEXT NOT NULL,
  prompt_tokens     INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  cost_usd          NUMERIC(10,6) NOT NULL DEFAULT 0,
  ok                BOOLEAN NOT NULL DEFAULT TRUE,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pipe_api_calls_created_idx ON pipeline.pipe_api_calls (created_at DESC);

-- Значения по умолчанию. Промпты лежат в коде (pipeline/prompts.py), здесь
-- только то, что человек меняет из админки. Существующие ключи не трогаем.
INSERT INTO pipeline.pipe_settings (key, value) VALUES
  ('topics', '[
      "космический мусор на орбите",
      "синдром Кесслера",
      "спутниковые группировки и мегасозвездия",
      "активное удаление мусора с орбиты",
      "космическое право и регулирование орбитальной деятельности",
      "артсайклинг и апсайклинг техногенных отходов",
      "выставки и проекты на стыке науки и искусства о космосе"
   ]'::jsonb),
  ('thresholds', '{"judge_accept": 6.5, "quality_min": 7.0, "translation_min": 7.0}'::jsonb),
  ('models', '{
      "search":    "perplexity/sonar-pro",
      "judge":     "openai/gpt-5.6-sol",
      "writer":    "anthropic/claude-sonnet-5",
      "factcheck": "perplexity/sonar-pro",
      "judge_a":   "x-ai/grok-4.6",
      "judge_b":   "google/gemini-3.7-flash",
      "translator": "anthropic/claude-sonnet-5",
      "native_cjk": "google/gemini-3.7-flash",
      "native_eu":  "openai/gpt-5.6-sol"
   }'::jsonb),
  ('publish', '{"mode": "manual", "telegram_chat_id": "", "vk_group_id": "", "languages_to_site": false}'::jsonb),
  ('schedule', '{"run_all": "0 7 * * *", "publish": "*/30 * * * *", "tz": "Europe/Moscow"}'::jsonb),
  ('limits', '{"search_results_per_topic": 8, "max_findings_per_run": 40, "max_posts_per_run": 5, "max_age_days": 14, "rewrite_rounds": 1}'::jsonb),
  ('voice', '{"words_min": 120, "words_max": 250, "signature": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- updated_at у черновиков обновляем триггером, чтобы API и скрипты об этом
-- не помнили.
CREATE OR REPLACE FUNCTION pipeline.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pipe_drafts_touch ON pipeline.pipe_drafts;
CREATE TRIGGER pipe_drafts_touch BEFORE UPDATE ON pipeline.pipe_drafts
  FOR EACH ROW EXECUTE FUNCTION pipeline.touch_updated_at();

DROP TRIGGER IF EXISTS pipe_settings_touch ON pipeline.pipe_settings;
CREATE TRIGGER pipe_settings_touch BEFORE UPDATE ON pipeline.pipe_settings
  FOR EACH ROW EXECUTE FUNCTION pipeline.touch_updated_at();

COMMIT;
