# Контент-тракт «Экологии Космоса»

Небольшой автоматический тракт: сбор новостей по темам проекта, отбор, посты в
голосе канала, переводы на шесть языков, проверка качества, публикация в
Telegram и ВКонтакте после одобрения человеком. Админка для всего этого живёт
в самом сайте: `/admin/pipeline`.

Ориентир - «Резонанс» на highazure, но тракт намного меньше и ни от чего в
Резонансе не зависит: один Python-пакет, семь скриптов, одна схема `pipeline`
в базе `cosmos_db`.

## Как устроено

```
collect.py ──► pipe_findings ──► judge.py ──► (accepted) ──► write.py ──► pipe_drafts (review)
  поиск Perplexity                GPT-5.6                      Claude пишет
  + RSS-ленты                     оценка 0-10                  Perplexity сверяет факты
                                  + бонус источника            Grok и Gemini судят качество
                                                                        │
                                                   человек в админке: одобрить / отклонить / переписать
                                                                        │
                                             translate.py ◄── approved ──► publish.py (крон */30)
                                             Claude переводит,            Telegram + ВК,
                                             носитель оценивает           ссылки в published_to
```

Каждый этап - отдельный скрипт с одинаковым каркасом (`common.Run`): строка в
`pipe_runs` на старте, лог и стоимость по ходу, при исключении `ok=false`,
трассировка в лог и алерт в `TG_ALERTS_CHAT_ID`. `run_all.py` гоняет четыре
этапа подряд для крона, `publish.py` ходит отдельно.

### Таблицы (схема `pipeline`, миграция `db/migrations/004_pipeline.sql`)

| Таблица | Что хранит |
|---|---|
| `pipe_sources` | источники: темы поиска (`search`), ленты (`rss`), справочник и ручные ссылки (`manual`); `authority` 0-5, `feed_kind` |
| `pipe_findings` | находки, `url` уникален и нормализован; `verdict` new/accepted/rejected/duplicate, оценка и объяснение судьи в `score`, `verdict_reason`, `raw.judge` |
| `pipe_drafts` | русский пост (`lang=ru`) и переводы (`parent_id` на русский); статусы draft/review/approved/published/rejected; `quality`, `fact_check`, `published_to` |
| `pipe_runs` | журнал прогонов по этапам |
| `pipe_api_calls` | каждый вызов модели: токены, стоимость, ошибка; отсюда суммы в админке |
| `pipe_settings` | темы, пороги, модели, режим публикации, лимиты |

### Модели (через OpenRouter, id правятся в настройках)

| Роль | Модель | Почему |
|---|---|---|
| поиск | `perplexity/sonar-pro` | единственный с поиском и ссылками; `sonar` дешевле, но хуже держит формат и даты |
| отбор | `openai/gpt-5.6-sol` | GPT-5.6 в базовом варианте: для оценки по пяти критериям reasoning-вариант terra не нужен, а стоит столько же на выходе |
| автор и переводчик | `anthropic/claude-sonnet-5` | лучший русский текст за $2/$10; Opus 5 в 2,5 раза дороже без заметной разницы на 200 словах |
| фактчек | `perplexity/sonar-pro` | умеет открыть источник и сравнить |
| судья А | `x-ai/grok-4.6` | последний Grok |
| судья Б, носитель zh/ja | `google/gemini-3.7-flash` | последний Gemini, дёшев, сильный в CJK |
| носитель en/es/fr/de | `openai/gpt-5.6-sol` | независимая от переводчика модель |

Стоимость считается по `usage.cost` из ответа OpenRouter, при его отсутствии
токены умножаются на цены из `/api/v1/models`. Замер на dry-run 22.08.2026:
сбор по одной теме $0.024, оценка десяти находок $0.050 (около $0.005 за
находку). Полный суточный прогон по семи темам с пятью постами и переводами
оценочно $1.5-3.

### Голос и тире

Промпты в `prompts.py`. Голос канала взят из уже вышедших постов: спокойная
музейная интонация, без восклицаний и призывов, 120-250 слов, источник в
конце. Длинное тире «—» запрещено промптом и дополнительно заменяется на «–»
после ответа модели (`common.fix_long_dash`), факт замены виден в админке.
`publish.py` пост с «—» не отправит, а редактор в админке не даст сохранить.

## Установка на highazure

```bash
# 1. Код. Пакет лежит в репозитории сайта, на сервере это /opt/cosmos-ecology.
cd /opt/cosmos-ecology && git pull        # ветка pipeline или main после слияния

# 2. Зависимости (все уже стоят системно: psycopg2 2.9, requests, pyyaml, feedparser 6)
python3 -c "import psycopg2, requests, yaml, feedparser"

# 3. Миграция базы
PGPASSWORD=... psql -h 127.0.0.1 -p 5433 -U resonance -d cosmos_db -f db/migrations/004_pipeline.sql

# 4. Ключи
cp pipeline/.env.example pipeline/.env && chmod 600 pipeline/.env
#    DATABASE_URL=postgresql://resonance:...@127.0.0.1:5433/cosmos_db
#    OPENROUTER_API_KEY, TELEGRAM_BOT_TOKEN, TG_ALERTS_CHAT_ID, VK_USER_ACCESS_TOKEN
#    (значения из /root/resonance_factory/.env)

# 5. Источники из реестра
python3 pipeline/seed_sources.py sources.json --dry-run     # посмотреть
python3 pipeline/seed_sources.py sources.json

# 6. Канал и группа: админка -> Тракт -> Настройки -> публикация
#    (telegram_chat_id, vk_group_id; режим manual)

# 7. Пересобрать сайт, чтобы появилась админка
docker compose -f docker-compose.server.yml up -d --build

# 8. Крон: вставить pipeline/jobs.snippet.yaml в /root/etc/jobs.yaml и
python3 /root/bin/cron_manifest.py --apply
```

Токен ВК: если в `.env` задать `RESONANCE_DSN`, `publish.py` берёт свежий
токен из `vk_tokens` Резонанса (его обновляет `wf_vk_token_refresh.py`), а
`VK_USER_ACCESS_TOKEN` остаётся запасным. Без `RESONANCE_DSN` токен из `.env`
придётся обновлять руками, когда истечёт.

## Запуск вручную

```bash
cd /opt/cosmos-ecology/pipeline
python3 collect.py --dry-run            # одна тема, до трёх лент, без записи
python3 collect.py                      # полный сбор
python3 judge.py --limit 10             # оценить десять новых находок
python3 write.py --finding 42           # пост по конкретной находке
python3 write.py --dry-run --finding 42 # написать и показать, не сохранять
python3 translate.py --draft 7 --langs en,ja
python3 publish.py --dry-run            # что ушло бы
python3 publish.py --draft 7            # опубликовать этот черновик
python3 run_all.py --skip translate     # суточный прогон без переводов
```

У каждого скрипта `--help`. Dry-run нигде не пишет в базу, но модели вызывает
(кроме `publish.py`, он в dry-run никуда не постит).

## Где смотреть

- Админка `/admin/pipeline`: обзор (последние прогоны, расход за день/неделю/месяц,
  счётчики, где упало, расход по моделям, лог любого прогона по клику на номер),
  находки (вердикты, оценки, ручной приём/отклонение, вставка ссылки),
  черновики (текст, судьи, фактчек, переводы по вкладкам, прежние версии,
  кнопки «Одобрить», «Отклонить», «Переписать», «Опубликовать сейчас», правка
  текста), настройки (темы, пороги, модели, режим публикации, ленты).
- Логи крона: `/var/log/cosmos_pipeline.log`, `/var/log/cosmos_pipeline_publish.log`.
- `job_runs` в `resonance_db` (через `run_job.sh`): факт запуска, таймауты.
- Алерты: чат `TG_ALERTS_CHAT_ID` при падении любого этапа.

### Что делают кнопки

- «Одобрить» - `status=approved`; `publish.py` опубликует в ближайшие 30 минут,
  `translate.py` переведёт в следующий суточный прогон.
- «Опубликовать сейчас» - то же одобрение плюс пометка `publish_now`. Сайт
  крутится в контейнере, а скрипты на хосте, поэтому кнопка не запускает
  `publish.py` сама: публикация случится в ближайший прогон крона (до 30 минут)
  или сразу после `python3 publish.py --draft N` руками.
- «Переписать» - `status=draft` с `quality.rewrite_requested`; `write.py`
  перепишет при следующем прогоне, прежняя версия остаётся в истории,
  переводы прежней версии удаляются.
- «Отклонить» - `status=rejected`, больше нигде не участвует.

## Режимы публикации

`manual` (по умолчанию): публикуются только `approved`. `auto`: ещё и
`review`, то есть всё, что прошло фактчек и судей без человека. Переключается
в настройках.

## Что не доделано

- Картинок к постам нет: транспорт текстовый. Когда понадобятся, добавить
  загрузку фото в `publish.py` по образцу `resonance_publish/vk.py` и `tg.py`.
- Переводы лежат в `pipe_drafts`, на сайт и в иноязычные каналы не выходят
  (`publish.languages_to_site` зарезервирован, не реализован).
- Кнопка «Опубликовать сейчас» ждёт крона, см. выше. Если нужна мгновенная
  публикация, нужен маленький HTTP-триггер на хосте или проброс сокета.
- Суммы в `pipe_api_calls` не попадают в `api_cost_log` Резонанса: тракт
  автономный. При желании добавить запись туда одной строкой в `common._record_call`.
