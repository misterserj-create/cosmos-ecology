# Развёртывание

Next.js 16 (App Router), Node.js 20+. Данные - PostgreSQL, картинки - MinIO
(S3-совместимое хранилище). Airtable из проекта выведен: `lib/airtable.ts` сохранил
только имя файла, читает он базу, а при недоступной базе - локальный снимок в
`public/cache/`.

> Где именно крутится боевая копия сейчас (сервер, домен, способ запуска), в репозитории
> не зафиксировано. Ниже описано то, что поддерживают файлы репозитория: запуск через
> Docker Compose и запуск напрямую через PM2 за nginx. Перед первой выкладкой сверить с
> тем, как сайт запущен на самом деле.

## Переменные окружения

Полный список того, что читает код (`grep -rn 'process.env' app lib scripts proxy.ts`):

| Переменная | Обязательна | Что делает | Где читается |
|---|---|---|---|
| `DATABASE_URL` | да | Строка подключения к PostgreSQL. Без неё сайт молча уходит на локальный снимок `public/cache/*.json`, а админка падает. | `lib/db.ts`, `lib/airtable.ts` |
| `ADMIN_PASSWORD` | да | Пароль входа в `/admin`. Если не задан, действует зашитый по умолчанию `cosmos2026` - на боевом сервере это равносильно открытой админке. | `proxy.ts`, `app/api/admin/login/route.ts` |
| `MINIO_ENDPOINT` | для загрузки картинок | Адрес MinIO, куда админка кладёт файлы. По умолчанию `http://127.0.0.1:9002`. | `lib/storage.ts` |
| `MINIO_PUBLIC_URL` | для загрузки картинок | Публичный адрес того же хранилища - он попадает в `image_url`/`thumb_url` и отдаётся браузеру. Если не задан, берётся `MINIO_ENDPOINT`, и в базу запишется внутренний адрес, недоступный снаружи. | `lib/storage.ts` |
| `MINIO_ACCESS_KEY` | для загрузки картинок | Ключ доступа. | `lib/storage.ts` |
| `MINIO_SECRET_KEY` | для загрузки картинок | Секретный ключ. | `lib/storage.ts` |
| `NODE_ENV=production` | да | Обычный признак боевого режима. | Next.js |

Пример `.env.production` (файл в `.gitignore`, в репозиторий не попадает):

```
DATABASE_URL=postgresql://ПОЛЬЗОВАТЕЛЬ:ПАРОЛЬ@ХОСТ:5432/cosmos_ecology
ADMIN_PASSWORD=<длинный случайный пароль, не cosmos2026>
MINIO_ENDPOINT=http://127.0.0.1:9002
MINIO_PUBLIC_URL=https://media.185-125-103-160.sslip.io
MINIO_ACCESS_KEY=<ключ>
MINIO_SECRET_KEY=<ключ>
NODE_ENV=production
```

Значения ключей и пароля брать из хранилища секретов сервера, а не из этого файла. Ни
один реальный ключ в git не кладём - ни в документацию, ни в примеры.

Устаревшее: `AIRTABLE_TOKEN`, `AIRTABLE_APP_ID`, `AIRTABLE_TABLE_ID` больше не нужны.
Их читает единственный скрипт `scripts/export-airtable.js` - разовая выгрузка из
Airtable, оставленная как след переезда. К работе сайта отношения не имеет.

## Подготовка базы

```bash
# Создать таблицы
psql "$DATABASE_URL" -f scripts/schema.sql

# Разово залить работы из снимка public/cache/artworks.json (пропускает существующие)
DATABASE_URL="..." node scripts/import-csv.js
```

Две таблицы: `artworks` (в каталог попадают строки с `in_catalog = true`) и `events`
(на сайт попадают строки с `published = true`).

## Картинки

Админка (`/api/admin/upload` → `lib/storage.ts`) кладёт файл в MinIO в бакет
`cosmos-ecology`: оригинал в `originals/`, превью 400px в `thumbs/`. Оба объекта
выкладываются с `public-read`, поэтому бакет должен разрешать публичное чтение.

Важно: хост из `MINIO_PUBLIC_URL` обязан быть перечислен в `next.config.ts` в
`images.remotePatterns`, иначе `next/image` откажется отдавать картинку. Сейчас там
`media.185-125-103-160.sslip.io` и два старых домена Airtable. Меняем хранилище -
правим `next.config.ts` в том же коммите.

## Языки

Семь языков (`i18n/config.ts`): ru, en, es, zh, fr, de, ja. Русский живёт по адресу без
префикса, остальные - с префиксом (`/en`, `/ja`). Разводит их `proxy.ts`, он же
закрывает `/admin`. Отдельной настройки на сервере это не требует, но при правке
nginx нельзя перехватывать пути с языковыми префиксами - всё уходит в приложение.

## Вариант 1: Docker Compose

```bash
cd /home/cosmos-ecology
git pull origin main

# .env.production по образцу выше должен лежать рядом с docker-compose.yml
docker compose up -d --build
docker compose logs -f nextjs
```

`docker-compose.yml` поднимает два контейнера: приложение на 3000 и nginx на 80/443 с
конфигом из `nginx.conf` и сертификатами из `/etc/letsencrypt`.

Осторожно с `Dockerfile`: боевой образ собирается из `.next` и `public`, а
`next.config.ts` в него не копируется. Пока настройки картинок живут в этом файле,
образ отдаёт картинки не так, как локальная сборка. Перед переходом на Docker это надо
поправить (или перейти на `output: 'standalone'`).

## Вариант 2: PM2 за nginx

```bash
cd /home/cosmos-ecology
git pull origin main
npm ci
npm run build

pm2 restart cosmos-ecology || pm2 start npm --name cosmos-ecology -- start
pm2 save
```

Ровно это и делает `deploy.sh` (в нём прописан путь `/home/cosmos-ecology`; домен и порт
в переменных скрипта - декоративные, нигде дальше не используются).

Первичная настройка сервера:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx certbot python3-certbot-nginx
npm install -g pm2

cp nginx.conf /etc/nginx/sites-available/cosmos-ecology
ln -s /etc/nginx/sites-available/cosmos-ecology /etc/nginx/sites-enabled/
# заменить your-domain.com на реальный домен и указать пути к сертификатам
nginx -t && systemctl reload nginx

certbot certonly --nginx -d ДОМЕН -d www.ДОМЕН
systemctl enable --now certbot.timer

pm2 startup && pm2 save
```

`nginx.conf` в репозитории - заготовка: в нём остались `your-domain.com` и пути к
сертификатам вида `/etc/ssl/certs/your-domain.com.crt`. Как есть он не заработает.

## Проверка после выкладки

```bash
pm2 status                      # или docker compose ps
curl -I http://localhost:3000/  # приложение отвечает
curl -I https://ДОМЕН/          # проходит через nginx и TLS
curl -I https://ДОМЕН/en        # языковая ветка жива
```

Дальше глазами: открывается галерея (значит, база доступна - иначе показался бы снимок
из `public/cache`), открывается `/admin` и просит пароль, картинка в карточке работы
грузится с публичного адреса MinIO.

## Обслуживание

```bash
pm2 logs cosmos-ecology         # логи приложения
pm2 restart cosmos-ecology      # перезапуск
docker compose logs -f nextjs   # то же для Docker-варианта
systemctl reload nginx          # перечитать конфиг веб-сервера
```

## Безопасность

- Секреты живут только в `.env.production` на сервере. В git - ни ключей, ни паролей,
  ни токенов, ни примеров с реальными значениями. Репозиторий публичный.
- `ADMIN_PASSWORD` задавать обязательно: значение по умолчанию `cosmos2026` зашито в код
  и известно всем, у кого есть доступ к исходникам, то есть кому угодно.
- Наружу открыты только 22, 80 и 443 (`ufw`). PostgreSQL и MinIO - не наружу.
- Утёкший ключ лечится отзывом в личном кабинете сервиса, а не удалением строки из
  файла: в истории git он остаётся.

## Если что-то не работает

**Сайт поднялся, но галерея пустая или показывает старое.** Приложение не достучалось
до базы и ушло на снимок `public/cache/artworks.json`. Проверить `DATABASE_URL` и
доступность PostgreSQL с машины приложения, в логах искать `DB fetch failed`.

**В админку пускает без пароля или не пускает с правильным.** Переменная
`ADMIN_PASSWORD` не доехала до процесса. При PM2 после правки `.env.production` нужен
`pm2 restart --update-env`, иначе процесс держит старое окружение.

**Картинка загрузилась, но не показывается.** Либо в базу записан внутренний адрес
(не задан `MINIO_PUBLIC_URL`), либо хост не перечислен в `images.remotePatterns` в
`next.config.ts`, либо бакет не отдаёт объекты анонимно.

**Сборка падает.** `npm run build` локально на той же версии Node, что и на сервере.
