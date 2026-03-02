# Пошаговая настройка Family Health

Инструкция для человека без опыта. Каждый шаг — подробно.

---

## 1. Создание проекта в Supabase

1. Зайдите на [supabase.com](https://supabase.com) и создайте аккаунт
2. Нажмите **New Project**
3. Выберите имя проекта (например, `family-health`) и придумайте пароль для базы данных
4. Дождитесь создания проекта (1-2 минуты)
5. Откройте **Project Settings** → **API** и скопируйте:
   - **Project URL** → это `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** ключ → это `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** ключ → это `SUPABASE_SERVICE_ROLE_KEY`

> service_role ключ — секретный, не публикуйте его в клиентском коде.

---

## 2. Создание таблиц (SQL-миграция)

1. В Supabase откройте **SQL Editor** (иконка в левом меню)
2. Нажмите **New Query**
3. Откройте файл `supabase/schema.sql` из проекта
4. Скопируйте всё содержимое и вставьте в SQL Editor
5. Нажмите **Run**
6. Убедитесь, что запрос выполнился без ошибок

Это создаст все таблицы, политики безопасности и storage bucket.

---

## 3. Получение API-ключа Anthropic (для AI)

1. Зайдите на [console.anthropic.com](https://console.anthropic.com)
2. Создайте аккаунт или войдите
3. Перейдите в **API Keys**
4. Нажмите **Create Key** и скопируйте ключ (начинается с `sk-ant-...`)
5. Это ваш `ANTHROPIC_API_KEY`

> Для работы AI нужен платный аккаунт с балансом. Без ключа приложение работает, но AI-анализ и чат будут недоступны.

---

## 4. Настройка переменных окружения

Скопируйте файл `.env.local.example` в `.env.local`:

```bash
cp .env.local.example .env.local
```

Заполните значения:

```
NEXT_PUBLIC_SUPABASE_URL=https://ваш-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_anon_ключ
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_ключ
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 5. Запуск проекта локально

```bash
npm install
npm run dev
```

Откройте http://localhost:3000

---

## 6. Создание первого пользователя (администратор)

1. Зайдите на http://localhost:3000/login
2. Зарегистрируйтесь с email и паролем
3. Подтвердите email (Supabase отправит письмо)
4. Откройте **Supabase Dashboard** → **Table Editor** → таблица `profiles`
5. Найдите свою строку и измените `role` с `member` на `admin`
6. Перезагрузите страницу приложения

Теперь у вас есть доступ к админ-панели `/admin`.

---

## 7. Деплой на Vercel

1. Залейте проект на GitHub (если ещё не сделано)
2. Откройте [vercel.com](https://vercel.com) → **Add New** → **Project**
3. Выберите **Import Git Repository** и выберите ваш репозиторий
4. В настройках деплоя добавьте все переменные окружения:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SITE_URL` — оставьте пустым, обновите после деплоя
5. Нажмите **Deploy**
6. После деплоя скопируйте URL (например, `https://family-health.vercel.app`)
7. В настройках Vercel → **Environment Variables** обновите:
   - `NEXT_PUBLIC_SITE_URL` = `https://family-health.vercel.app`
8. В Supabase → **Authentication** → **URL Configuration** добавьте ваш Vercel URL в **Site URL** и **Redirect URLs**

---

## 8. Приглашение членов семьи

1. Войдите в приложение как администратор
2. Перейдите в **Админ-панель** (`/admin`)
3. В разделе «Пригласить члена семьи» введите email и имя
4. Нажмите **Пригласить**
5. Приглашённый получит письмо со ссылкой для регистрации

---

## Решение проблем

| Проблема | Решение |
|----------|---------|
| "AI-сервис не настроен" | Проверьте `ANTHROPIC_API_KEY` в `.env.local` |
| Не работает регистрация | Проверьте `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Ошибка приглашения | Проверьте `SUPABASE_SERVICE_ROLE_KEY` |
| Нет админ-панели | Измените `role` на `admin` в таблице `profiles` |
