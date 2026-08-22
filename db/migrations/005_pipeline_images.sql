-- 005_pipeline_images.sql
--
-- Иллюстрации к постам тракта. Отдельный этап (pipeline/illustrate.py)
-- генерирует промпт и картинку через kie.ai (nano-banana-2) и кладёт
-- результат в MinIO, ссылку и промпт - сюда.
--
-- Применение:  psql "$DATABASE_URL" -f db/migrations/005_pipeline_images.sql
-- Повторный запуск безопасен: IF NOT EXISTS на каждый столбец.

BEGIN;

ALTER TABLE pipeline.pipe_drafts
  ADD COLUMN IF NOT EXISTS image_url    TEXT,
  ADD COLUMN IF NOT EXISTS image_prompt TEXT,
  ADD COLUMN IF NOT EXISTS image_cost   NUMERIC(10,6);

COMMIT;
