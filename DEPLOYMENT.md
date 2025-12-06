# 🚀 Deployment Guide - MarketMonitor

**Версия:** 0.4.0
**Статус:** Staging Ready
**Дата:** 2024-12-06

---

## 📋 Оглавление

1. [Netlify Deployment](#netlify-deployment)
2. [Environment Variables](#environment-variables)
3. [Supabase Configuration](#supabase-configuration)
4. [Post-Deployment Checklist](#post-deployment-checklist)
5. [Troubleshooting](#troubleshooting)

---

## 🌐 Netlify Deployment

### Предварительные требования

- ✅ GitHub репозиторий с кодом
- ✅ Аккаунт на [Netlify](https://www.netlify.com/)
- ✅ Supabase проект создан и настроен
- ✅ Environment variables готовы

### Шаг 1: Подключить GitHub репозиторий

1. Зайти на https://app.netlify.com/
2. Нажать **"Add new site"** → **"Import an existing project"**
3. Выбрать **"GitHub"**
4. Авторизовать Netlify в GitHub (если не сделано)
5. Найти и выбрать репозиторий **MarketMonitor**

### Шаг 2: Настроить Build Settings

Netlify автоматически обнаружит `netlify.toml` в корне проекта.

**Проверьте настройки:**
```
Base directory:    (оставить пустым)
Build command:     cd frontend && npm install && npm run build
Publish directory: frontend/dist
```

**ВАЖНО:** Эти настройки уже прописаны в `netlify.toml`, просто проверьте что они применились.

### Шаг 3: Настроить Environment Variables

**ПЕРЕД первым deploy обязательно настроить:**

1. Перейти в **Site settings** → **Environment variables**
2. Добавить следующие переменные:

#### Обязательные переменные:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here

# Application Environment
VITE_APP_ENV=staging
```

#### Опциональные переменные (можно добавить позже):

```bash
# OpenAI API (для AI search, опционально для staging)
VITE_OPENAI_API_KEY=sk-your-openai-key-here

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_SENTRY=false

# Debug Mode (только для staging/preview)
VITE_DEBUG=true
```

### Шаг 4: Deploy!

1. Нажать **"Deploy site"**
2. Дождаться окончания сборки (2-3 минуты)
3. Проверить логи сборки на наличие ошибок

### Шаг 5: Настроить Site Name (опционально)

1. **Site settings** → **General** → **Site details**
2. Изменить **Site name** на `marketmonitor-staging` (или другое имя)
3. URL станет: `https://marketmonitor-staging.netlify.app`

---

## 🔐 Environment Variables

### Где взять значения:

#### 1. VITE_SUPABASE_URL
- Перейти в Supabase Dashboard
- **Settings** → **API**
- Скопировать **Project URL**
- Пример: `https://abcdefghijklmnop.supabase.co`

#### 2. VITE_SUPABASE_ANON_KEY
- Там же: **Settings** → **API**
- Скопировать **anon (public) key**
- Это публичный ключ, безопасно использовать в frontend

#### 3. VITE_OPENAI_API_KEY (опционально)
- Перейти на https://platform.openai.com/api-keys
- **Create new secret key**
- Скопировать ключ (показывается один раз!)
- ⚠️ **ВАЖНО:** Храните в безопасности, НЕ коммитить в git!

---

## 🗄️ Supabase Configuration

### 1. CORS Settings

Добавить Netlify URL в разрешенные источники:

1. Supabase Dashboard → **Settings** → **API**
2. Найти **CORS: Additional Allowed Origins**
3. Добавить URL вашего Netlify сайта:
   ```
   https://marketmonitor-staging.netlify.app
   https://your-custom-domain.com (если есть)
   ```

### 2. Auth Redirect URLs

Настроить redirect URLs для аутентификации:

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Добавить в **Site URL**:
   ```
   https://marketmonitor-staging.netlify.app
   ```
3. Добавить в **Redirect URLs**:
   ```
   https://marketmonitor-staging.netlify.app/**
   http://localhost:3000/** (для локальной разработки)
   ```

### 3. Edge Functions (если развернуты)

Проверить что Edge Functions развернуты и работают:

```bash
# Локально (если установлен Supabase CLI)
supabase functions list

# Или проверить в Dashboard:
# Edge Functions → Список функций
```

**Необходимые функции для полной работы:**
- ✅ `ai-search` - AI поиск событий
- ✅ `sources-api` - управление источниками
- ✅ `segments-api` - сегменты оборудования
- ✅ `geographies-api` - географические зоны
- ⏳ `source-urls-api` - управление URL (опционально)

---

## ✅ Post-Deployment Checklist

### Проверка после первого деплоя:

#### 1. Проверить сайт доступен
- [ ] Открыть URL сайта (https://your-site.netlify.app)
- [ ] Страница загружается без ошибок
- [ ] Нет ошибок в консоли браузера (F12)

#### 2. Проверить аутентификацию
- [ ] Перейти на `/login`
- [ ] Попытаться войти с существующим аккаунтом
- [ ] Проверить redirect на Dashboard после входа
- [ ] Проверить кнопку Logout

#### 3. Проверить Supabase подключение
- [ ] Открыть консоль браузера (F12) → Network
- [ ] Попытаться загрузить данные (например, события)
- [ ] Проверить запросы к Supabase API
- [ ] Проверить CORS errors (не должно быть)

#### 4. Проверить основные страницы
- [ ] Dashboard (`/`)
- [ ] Events (`/events`)
- [ ] Reports (`/reports`)
- [ ] Admin Panel (`/admin`) - только для админов

#### 5. Проверить мобильную версию
- [ ] Открыть DevTools → Toggle device toolbar
- [ ] Проверить на разных размерах (mobile, tablet)
- [ ] Проверить меню навигации

---

## 🛠️ Troubleshooting

### Проблема 1: "Failed to load module"

**Симптомы:** Белый экран, ошибка в консоли

**Решение:**
1. Проверить Build logs в Netlify
2. Убедиться что `npm run build` прошел успешно
3. Проверить что `frontend/dist` содержит файлы
4. Очистить кэш Netlify: **Deploys** → **Trigger deploy** → **Clear cache and deploy**

### Проблема 2: CORS Errors

**Симптомы:** Ошибки `Access-Control-Allow-Origin` в консоли

**Решение:**
1. Добавить Netlify URL в Supabase CORS settings (см. выше)
2. Проверить что URL точный (без лишних слэшей)
3. Подождать 1-2 минуты для применения изменений

### Проблема 3: Environment Variables не работают

**Симптомы:** Ошибки подключения к Supabase, undefined в коде

**Решение:**
1. Проверить что переменные добавлены в **Site settings** → **Environment variables**
2. Проверить префикс `VITE_` (обязателен!)
3. **Trigger deploy** после добавления переменных (важно!)
4. Проверить в консоли браузера: `import.meta.env.VITE_SUPABASE_URL`

### Проблема 4: 404 при обновлении страницы

**Симптомы:** Работает при клике по ссылкам, но 404 при F5

**Решение:**
- Проверить что `netlify.toml` присутствует в репозитории
- Проверить redirect правило в `netlify.toml`:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```

### Проблема 5: Build fails

**Симптомы:** Deploy failed, ошибки в Build logs

**Решение:**
1. Проверить Build logs в Netlify
2. Запустить локально: `cd frontend && npm run build`
3. Исправить TypeScript ошибки
4. Закоммитить и запушить исправления

### Проблема 6: Slow load times

**Симптомы:** Сайт медленно загружается

**Решение:**
1. Проверить размер бандла в Build logs
2. Рассмотреть code splitting (будет в следующих фазах)
3. Включить Netlify CDN (должен быть включен по умолчанию)
4. Проверить Supabase Edge Functions (region должен быть близко)

---

## 📊 Monitoring & Analytics

### Netlify Analytics (опционально, платно)

1. **Site settings** → **Analytics**
2. Enable Netlify Analytics (платная функция)
3. Получите данные о трафике, производительности

### Supabase Monitoring

1. Supabase Dashboard → **Reports**
2. Мониторить:
   - Database connections
   - API requests
   - Edge Functions invocations
   - Storage usage

---

## 🔄 Continuous Deployment

### Автоматический deploy при push в main

**Уже настроено!** Netlify автоматически деплоит при push в `main` ветку.

**Workflow:**
1. Внести изменения локально
2. Commit & Push в `main`
3. Netlify автоматически запустит build
4. Через 2-3 минуты изменения live

### Deploy Previews для Pull Requests

**Настроить (опционально):**
1. **Site settings** → **Build & deploy** → **Deploy contexts**
2. Enable **Deploy Previews**
3. Теперь каждый PR получит preview URL

---

## 🔐 Security Checklist

### Before Production Deploy:

- [ ] Все секреты (API keys) в Environment Variables, НЕ в коде
- [ ] `.env.local` в `.gitignore`
- [ ] Supabase RLS policies настроены и протестированы
- [ ] CORS настроен только для нужных доменов
- [ ] CSP headers настроены (в `netlify.toml`)
- [ ] HTTPS включен (автоматически в Netlify)
- [ ] Admin routes защищены (`ProtectedRoute` + role check)

---

## 📞 Support & Resources

### Документация:
- [Netlify Docs](https://docs.netlify.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev/guide/)

### Полезные команды:

```bash
# Локальный preview production build
cd frontend
npm run build
npm run preview

# Проверить TypeScript
npm run type-check

# Проверить ESLint
npm run lint
```

---

## 🎯 Next Steps

После успешного staging deploy:

1. **Тестирование:**
   - Пригласить пользователей протестировать
   - Собрать feedback
   - Исправить баги

2. **Мониторинг:**
   - Следить за ошибками в консоли
   - Проверять Supabase usage
   - Мониторить performance

3. **Production Deploy:**
   - Создать production branch
   - Настроить custom domain
   - Обновить Supabase CORS для prod URL
   - Enable analytics

4. **Phase 3.3 Development:**
   - Продолжить разработку Source Management UI
   - Обновлять staging регулярно
   - Тестировать новые features

---

**Успешного деплоя! 🚀**

*Документ обновлен: 2024-12-06*
