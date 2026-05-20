# 🚀 Инструкция по развертыванию на Aeza

## Предварительные требования

- Ubuntu 22.04 или выше (на сервере Aeza)
- Node.js 20+
- npm или yarn
- Nginx
- PM2 (или другой process manager)
- SSL сертификат (Let's Encrypt)
- Git доступ к репозиторию

## Шаг 1️⃣: Подготовка сервера

```bash
# Подключитесь к вашему VPS Aeza через SSH
ssh root@your-aeza-server-ip

# Обновите систему
apt update && apt upgrade -y

# Установите Node.js (версия 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs npm

# Установите Git
apt install -y git

# Установите Nginx
apt install -y nginx

# Установите PM2 глобально
npm install -g pm2

# Установите certbot для SSL
apt install -y certbot python3-certbot-nginx
```

## Шаг 2️⃣: Клонирование репозитория

```bash
# Создайте директорию для приложения
mkdir -p /home/cosmos-ecology
cd /home/cosmos-ecology

# Клонируйте репозиторий (замените на ваш GitHub URL)
git clone https://github.com/your-username/cosmos-ecology.git .

# Или используйте существующую папку
# cd ~/Desktop/cosmos-ecology
```

## Шаг 3️⃣: Настройка переменных окружения

```bash
# Создайте файл .env.production
nano /home/cosmos-ecology/.env.production
```

Добавьте ваши переменные Airtable:
```
AIRTABLE_TOKEN=patzr6mo9h7YmCP1r.209cf3d37103fb91d789a36cfea0cb482bd7117f03e489cf5b58520cc11eaaf6
AIRTABLE_APP_ID=appEdqvnKWVkqZdv5
AIRTABLE_TABLE_ID=tblyTMo0CHtEauLAD
NODE_ENV=production
```

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

## Шаг 4️⃣: Установка зависимостей и сборка

```bash
cd /home/cosmos-ecology

# Установите зависимости
npm ci

# Собрите приложение для продакшна
npm run build

# Проверьте что сборка успешна
ls -la .next/
```

## Шаг 5️⃣: Запуск с PM2

```bash
# Запустите приложение
pm2 start npm --name "cosmos-ecology" -- start

# Убедитесь что оно запустилось
pm2 status

# Сделайте его автозагружаемым при перезагрузке
pm2 startup
pm2 save
```

## Шаг 6️⃣: Настройка Nginx

```bash
# Скопируйте конфиг Nginx (если вы его создали)
cp /home/cosmos-ecology/nginx.conf /etc/nginx/sites-available/cosmos-ecology

# Создайте символическую ссылку
ln -s /etc/nginx/sites-available/cosmos-ecology /etc/nginx/sites-enabled/

# Отредактируйте конфиг - замените your-domain.com на ваш домен
nano /etc/nginx/sites-available/cosmos-ecology
```

Убедитесь что в конфиге правильно указаны:
- `server_name your-domain.com www.your-domain.com;`
- Пути к SSL сертификатам

```bash
# Проверьте синтаксис Nginx
nginx -t

# Перезагрузите Nginx
systemctl reload nginx
```

## Шаг 7️⃣: SSL сертификат (Let's Encrypt)

```bash
# Получите бесплатный SSL сертификат
certbot certonly --nginx -d your-domain.com -d www.your-domain.com

# Автоматическое обновление
systemctl enable certbot.timer
systemctl start certbot.timer

# Проверьте что сертификат работает
certbot renew --dry-run
```

## Шаг 8️⃣: Проверка

```bash
# Проверьте статус приложения
pm2 status

# Смотрите логи
pm2 logs cosmos-ecology

# Проверьте порт 3000
netstat -tlnp | grep 3000

# Проверьте Nginx
curl -I http://localhost/
```

## 🎉 Готово!

Ваше приложение должно быть доступно по адресу:
- 🌐 https://your-domain.com

## 📝 Полезные команды

```bash
# Просмотр логов приложения
pm2 logs cosmos-ecology

# Перезапуск приложения
pm2 restart cosmos-ecology

# Остановка приложения
pm2 stop cosmos-ecology

# Удаление из PM2
pm2 delete cosmos-ecology

# Проверка версии Node.js на сервере
node --version
npm --version

# Переблокировка Nginx конфига
systemctl reload nginx

# Просмотр открытых портов
netstat -tlnp
```

## 🔧 Автоматическое обновление

Для автоматического развертывания при коммите в GitHub создайте GitHub Action (опционально):

```yaml
# .github/workflows/deploy.yml
name: Deploy to Aeza

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh -i ~/.ssh/id_rsa root@your-aeza-server-ip 'cd /home/cosmos-ecology && bash deploy.sh'
```

## ⚠️ Безопасность

- 🔐 Не публикуйте `.env.production` в GitHub
- 🔐 Используйте Strong пароли
- 🔐 Включите firewall: `ufw enable`
- 🔐 Откройте только нужные порты (80, 443, 22)
- 🔐 Регулярно обновляйте систему: `apt update && apt upgrade`

## 🆘 Решение проблем

**Приложение не запускается:**
```bash
npm run build  # Проверьте что сборка работает
pm2 logs cosmos-ecology  # Посмотрите логи ошибок
```

**Nginx не работает:**
```bash
nginx -t  # Проверьте синтаксис конфига
systemctl status nginx  # Посмотрите статус
```

**Проблемы с Airtable:**
- Проверьте что `.env.production` содержит правильные значения
- Убедитесь что сервер имеет доступ в интернет
- Проверьте токены Airtable на странице разработчика

---

✅ Если всё работает - ваш сайт экологии космоса в сети! 🚀
