# Этап 1: сборка
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Этап 2: продакшн образ
FROM node:20-alpine

WORKDIR /app

# Устанавливаем переменную для продакшна
ENV NODE_ENV=production

# Копируем package файлы
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production

# Копируем собранное приложение из builder этапа
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]
