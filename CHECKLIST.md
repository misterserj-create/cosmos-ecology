# ✅ Контрольный список перед развертыванием

## 📋 Предварительные проверки

- [x] ✅ Проект собирается успешно (`npm run build`)
- [x] ✅ Нет критических ошибок TypeScript
- [x] ✅ Все зависимости установлены
- [ ] Все API маршруты протестированы локально
- [ ] `.env.production` заполнен корректными значениями Airtable
- [ ] Git репозиторий создан и настроен

## 🖥️ На сервере Aeza

### Окружение
- [ ] Ubuntu 22.04+ установлена
- [ ] Node.js 20+ установлен
- [ ] npm/yarn установлен
- [ ] Git установлен
- [ ] Nginx установлен
- [ ] PM2 установлен глобально (`npm install -g pm2`)

### Приложение
- [ ] Репозиторий склонирован в `/home/cosmos-ecology`
- [ ] `.env.production` создан с правильными значениями
- [ ] `npm ci` выполнен успешно
- [ ] `npm run build` прошел без ошибок
- [ ] Приложение запущено через PM2
- [ ] PM2 добавлен в автозагрузку (`pm2 startup && pm2 save`)

### Веб-сервер
- [ ] Nginx конфиг скопирован и отредактирован
- [ ] Domain имя указано вместо `your-domain.com`
- [ ] SSL сертификаты получены через Let's Encrypt
- [ ] Nginx синтаксис проверен (`nginx -t`)
- [ ] Nginx перезагружен (`systemctl reload nginx`)

### Безопасность
- [ ] Firewall включен (`ufw enable`)
- [ ] Открыты порты: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- [ ] `.env.production` НЕ в git репозитории
- [ ] SSH ключ настроен для автоматического развертывания (опционально)
- [ ] Backup стратегия определена

### Мониторинг
- [ ] PM2 Plus (опционально): `pm2 install pm2-auto-pull`
- [ ] Логирование настроено: `pm2 logs cosmos-ecology`
- [ ] Мониторинг ресурсов: `pm2 monit`

## 🧪 Тестирование перед запуском

```bash
# Локально
npm run dev        # Работает ли dev режим?
npm run build      # Собирается ли для продакшна?

# На сервере
pm2 status         # Приложение запущено?
curl http://localhost:3000  # Отвечает ли на локальный порт?
curl https://your-domain.com  # Работает ли через Nginx?
```

## 📝 Данные для заполнения

```
Домен: ___________________________
IP сервера Aeza: ___________________________
SSH пользователь: ___________________________
SSH пароль/ключ: ___________________________

Airtable Token: patzr6mo9h7YmCP1r.209cf3d37103fb91d789a36cfea0cb482bd7117f03e489cf5b58520cc11eaaf6
Airtable App ID: appEdqvnKWVkqZdv5
Airtable Table ID: tblyTMo0CHtEauLAD

SSL Email для Let's Encrypt: ___________________________
```

## 🚀 День развертывания

1. Убедитесь что все выше отмечено ✅
2. Следуйте инструкциям в `DEPLOY.md`
3. Протестируйте каждый шаг
4. Проверьте логи: `pm2 logs cosmos-ecology`
5. Мониторьте первые часы работы

## 🎯 После развертывания

- [ ] Сайт открывается без ошибок
- [ ] Все страницы загружаются корректно
- [ ] Изображения с Airtable отображаются
- [ ] Нет 404/500 ошибок в логах
- [ ] SSL сертификат действителен
- [ ] Производительность в норме
- [ ] Резервные копии настроены
- [ ] Алерты для ошибок настроены

## 📚 Полезные ссылки

- [Next.js Deployment Docs](https://nextjs.org/docs/app/building-your-application/deploying)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Airtable API Docs](https://airtable.com/developers/web/api/overview)

---

**Если всё готово - можно переносить! 🚀**
