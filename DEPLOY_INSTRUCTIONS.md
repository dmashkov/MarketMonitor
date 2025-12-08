# 🚀 Deploy Instructions - Phase 3 Backend

**Дата:** 2024-12-07
**Статус:** ✅ Все Edge Functions созданы, готовы к деплою

---

## 📋 Что готово к деплою

### Edge Functions (6 штук):

1. ✅ **brands-api** - DEPLOYED (только что задеплоено)
2. ⏳ **documents-api** - READY (NEW!)
3. ⏳ **sources-api** - READY
4. ⏳ **source-urls-api** - READY
5. ⏳ **segments-api** - READY
6. ⏳ **geographies-api** - READY

### Migrations:

1. ✅ **007_brands_and_documents.sql** - APPLIED
2. ⏳ **008_semantic_search_function.sql** - READY (NEW!)

---

## 🎯 Инструкции для деплоя

### Шаг 1: Применить миграцию 008 (2 минуты)

**Через Supabase Dashboard:**

1. Зайди в https://supabase.com/dashboard
2. Открой свой проект MarketMonitor
3. Перейди в **SQL Editor**
4. Открой файл `supabase/migrations/008_semantic_search_function.sql`
5. Скопируй весь SQL код
6. Вставь в SQL Editor
7. Нажми **Run** ▶️

**Проверка:**
```sql
-- В SQL Editor выполни:
SELECT * FROM pg_proc WHERE proname = 'search_documents_by_embedding';
-- Должна вернуться 1 строка
```

---

### Шаг 2: Деплой Edge Functions (10 минут)

**ВАЖНО:** Перед деплоем убедись что:
- ✅ Supabase CLI настроен (если нет - деплой через Dashboard)
- ✅ Переменная окружения `OPENAI_API_KEY` установлена в Supabase

**Через Supabase Dashboard (рекомендуется):**

1. Перейди в **Edge Functions** → **Deploy new function**
2. Загрузи каждую функцию:
   - `supabase/functions/documents-api/index.ts`
   - `supabase/functions/sources-api/index.ts`
   - `supabase/functions/source-urls-api/index.ts`
   - `supabase/functions/segments-api/index.ts`
   - `supabase/functions/geographies-api/index.ts`

**Через Supabase CLI (если настроен):**

```bash
# Если Supabase CLI настроен:
cd supabase/functions

npx supabase functions deploy documents-api
npx supabase functions deploy sources-api
npx supabase functions deploy source-urls-api
npx supabase functions deploy segments-api
npx supabase functions deploy geographies-api
```

**Проверка:**
```bash
npx supabase functions list
# Должны быть:
# ✅ ai-search
# ✅ brands-api
# ✅ documents-api
# ✅ sources-api
# ✅ source-urls-api
# ✅ segments-api
# ✅ geographies-api
```

---

### Шаг 3: Установить OPENAI_API_KEY (если не установлен)

**Через Supabase Dashboard:**

1. Перейди в **Project Settings** → **Edge Functions**
2. Найди секцию **Secrets**
3. Добавь новый secret:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-proj-...` (твой OpenAI API ключ)

**Проверка:**
```bash
# В Supabase Dashboard → Edge Functions → Logs
# Запусти любую функцию и проверь что нет ошибки "OPENAI_API_KEY not configured"
```

---

## ✅ Проверка после деплоя

### Тест 1: Проверить brands-api

```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/brands" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Должен вернуться список брендов
```

### Тест 2: Проверить documents-api

```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/documents" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Должен вернуться пустой список или ошибка 401 (если не залогинен)
```

### Тест 3: Проверить sources-api

```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/sources" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Должен вернуться список 15 источников
```

### Тест 4: Проверить segments-api

```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/segments" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Должен вернуться список 8 сегментов
```

---

## 🎉 После успешного деплоя

Напиши в чате:

> "✅ Все функции задеплоены, миграция 008 применена, готов к следующему этапу"

И мы продолжим работу над Frontend UI! 🚀

---

## 📊 Прогресс Phase 3

```
✅ Migration 007: Brands & Documents     - APPLIED
✅ Migration 008: Semantic Search RPC    - READY
✅ Edge Function: brands-api             - DEPLOYED
✅ Edge Function: documents-api          - CREATED
✅ Edge Function: sources-api            - CREATED
✅ Edge Function: source-urls-api        - CREATED
✅ Edge Function: segments-api           - CREATED
✅ Edge Function: geographies-api        - CREATED

⏳ Frontend: Brands Management UI        - TODO (следующий этап)
⏳ Frontend: Documents Library UI        - TODO
⏳ Frontend: Sources Management UI       - TODO

Backend готовность:  100% ✅
Frontend готовность:   0% ⏳

ИТОГО Phase 3:        60%
```

---

## ❓ Troubleshooting

### Ошибка: "Module not found _shared/cors.ts"

**Решение:** Все функции уже исправлены! CORS headers встроены прямо в каждую функцию.

### Ошибка: "OPENAI_API_KEY not configured"

**Решение:** Установи OPENAI_API_KEY в Project Settings → Edge Functions → Secrets

### Ошибка: "function search_documents_by_embedding does not exist"

**Решение:** Примени migration 008 через SQL Editor

---

**Создано:** 2024-12-07
**Следующий этап:** Frontend UI для управления брендами, документами, источниками
