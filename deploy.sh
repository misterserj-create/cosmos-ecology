#!/bin/bash

# Скрипт для развертывания на Aeza сервере

set -e

echo "🚀 Начинаю развертывание cosmos-ecology..."

# Переменные (замените на ваши значения)
REPO_DIR="/home/cosmos-ecology"
DOMAIN="your-domain.com"
PORT=3000

# 1. Обновляем код из Git
echo "📦 Обновляю код из репозитория..."
cd $REPO_DIR
git pull origin main

# 2. Устанавливаем зависимости
echo "📚 Устанавливаю зависимости..."
npm ci

# 3. Собираем приложение
echo "🔨 Собираю приложение..."
npm run build

# 4. Перезапускаем PM2 приложение
echo "♻️ Перезапускаю приложение..."
pm2 restart cosmos-ecology || pm2 start npm --name "cosmos-ecology" -- start

# 5. Сохраняем PM2 конфиг
pm2 save

echo "✅ Развертывание завершено!"
echo "🌐 Приложение доступно по адресу: https://$DOMAIN"
