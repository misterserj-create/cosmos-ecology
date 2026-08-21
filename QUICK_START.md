# 🚀 Быстрый старт развертывания на Aeza

## 📦 Что было подготовлено

Все необходимые файлы для развертывания уже созданы:

```
✅ Dockerfile                - контейнеризация приложения
✅ docker-compose.yml        - многоконтейнерное окружение
✅ .dockerignore             - игнорирование ненужных файлов
✅ nginx.conf                - конфиг веб-сервера
✅ .env.production           - переменные продакшена (не отслеживается git)
✅ deploy.sh                 - скрипт развертывания
✅ DEPLOY.md                 - подробная инструкция
✅ CHECKLIST.md              - контрольный список
✅ Проект успешно собирается - npm run build ✓
```

## ⚡ Самый быстрый путь (5 минут)

### На вашем компе (сейчас):

```bash
cd ~/Desktop/cosmos-ecology

# Коммитим все файлы для развертывания
git add -A
git commit -m "Add deployment configuration (Docker, Nginx, PM2)"
git push origin main
```

### На сервере Aeza (через SSH):

```bash
# 1. Подключитесь к серверу
ssh root@YOUR_AEZA_IP

# 2. Скопируйте эту команда и выполните её целиком:

bash -c 'set -e && \
echo "📦 Обновляю пакеты..." && \
apt update && apt upgrade -y && \
echo "🐳 Устанавливаю Docker..." && \
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && \
echo "📦 Устанавливаю Docker Compose..." && \
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
chmod +x /usr/local/bin/docker-compose && \
echo "📂 Клонирую репозиторий..." && \
mkdir -p /home/cosmos-ecology && \
cd /home/cosmos-ecology && \
git clone https://github.com/YOUR_USERNAME/cosmos-ecology.git . && \
echo "✅ Готово! Переходим к шагу 3..."'

# 3. Создайте .env.production файл:
cat > /home/cosmos-ecology/.env.production << EOF
AIRTABLE_TOKEN=<токен отозван, Airtable из проекта выведен>
AIRTABLE_APP_ID=appEdqvnKWVkqZdv5
AIRTABLE_TABLE_ID=tblyTMo0CHtEauLAD
NODE_ENV=production
EOF

# 4. Запустите приложение:
cd /home/cosmos-ecology
docker-compose up -d

# 5. Проверьте что всё работает:
docker-compose logs -f
```

## 🔐 Вариант 2: Без Docker (более простой для VPS)

Если на Aeza нет Docker, используйте этот путь:

### На сервере:

```bash
ssh root@YOUR_AEZA_IP

# Установка окружения
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs npm git nginx

# Клонирование
mkdir -p /home/cosmos-ecology
cd /home/cosmos-ecology
git clone https://github.com/YOUR_USERNAME/cosmos-ecology.git .

# .env файл
cat > .env.production << EOF
AIRTABLE_TOKEN=<токен отозван, Airtable из проекта выведен>
AIRTABLE_APP_ID=appEdqvnKWVkqZdv5
AIRTABLE_TABLE_ID=tblyTMo0CHtEauLAD
NODE_ENV=production
EOF

# Сборка и запуск
npm ci
npm run build
npm install -g pm2
pm2 start npm --name "cosmos-ecology" -- start
pm2 startup
pm2 save

# Nginx
cp nginx.conf /etc/nginx/sites-available/cosmos-ecology
ln -s /etc/nginx/sites-available/cosmos-ecology /etc/nginx/sites-enabled/
nano /etc/nginx/sites-available/cosmos-ecology  # Отредактируйте домен
nginx -t
systemctl reload nginx

# SSL
apt install -y certbot python3-certbot-nginx
certbot certonly --nginx -d your-domain.com -d www.your-domain.com
```

## 📋 Замены которые НУЖНО сделать:

1. **your-domain.com** → Ваш реальный домен
2. **YOUR_USERNAME** → Ваш GitHub юзернейм
3. **YOUR_AEZA_IP** → IP адрес вашего VPS на Aeza

## ✅ Проверка работы

```bash
# На сервере
curl http://localhost:3000    # Должна быть ошибка (порт закрыт снаружи)
curl https://your-domain.com  # Должна открыться ваша страница
```

## 🎯 Если что-то пошло не так

```bash
# Docker вариант:
docker-compose logs cosmos-ecology  # Смотрите логи приложения
docker-compose logs nginx           # Смотрите логи Nginx

# PM2 вариант:
pm2 logs cosmos-ecology  # Смотрите логи
pm2 status              # Статус приложения
```

## 📚 Более подробно

Если нужны полные инструкции со всеми деталями, смотрите **`DEPLOY.md`**

Если хотите проверить всё перед развертыванием, используйте **`CHECKLIST.md`**

---

## 🚀 Резюме

✅ **Готово к развертыванию!**

- Git коммит → `git push`
- SSH на сервер → выполнить скрипт
- Готово! 🎉

Какой вариант вам нравится больше - Docker или обычный VPS?
