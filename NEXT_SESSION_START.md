# Quick Start - Next Session

**Дата:** 2025-12-30
**Статус:** Content Fetcher Integration 90% Complete
**Блокер:** SUPABASE_SERVICE_ROLE_KEY не в Vault

---

## ⚡ IMMEDIATE ACTION (5 минут)

### 1. Добавить Service Role Key в Vault

**Шаги:**

1. Откройте **Supabase Dashboard** → **Project Settings** (⚙️) → **API**
2. Найдите раздел **Project API keys**
3. Скопируйте ключ **`service_role`** (длинная строка, НЕ `anon`!)
4. В **SQL Editor** выполните:

```sql
INSERT INTO vault.secrets (name, secret, description)
VALUES (
  'SUPABASE_SERVICE_ROLE_KEY',
  'ВСТАВЬТЕ_СЮДА_ВАШ_SERVICE_ROLE_KEY',  -- <-- замените этот текст
  'Service Role Key for calling Edge Functions from SQL'
);
```

5. Проверьте что ключ добавлен:

```sql
SELECT name, description, created_at
FROM vault.secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
```

Ожидаемый результат: 1 row returned ✅

---

### 2. Протестировать Content Fetcher (10 минут)

Выполните в **SQL Editor:**

```sql
-- Step 1: Test with 5 documents
SELECT * FROM fetch_pending_documents(5);
```

**Ожидаемый результат:**
- `status`: "success"
- `documents_fetched`: 3-5 (некоторые URLs могут не работать)
- `documents_failed`: 0-2
- `error_message`: NULL

```sql
-- Step 2: Verify HTML was saved
SELECT
  id,
  source_url,
  content_html IS NOT NULL as has_html,
  content_length,
  fetched_at
FROM documents
WHERE content_html IS NOT NULL
ORDER BY fetched_at DESC
LIMIT 10;
```

**Ожидаемый результат:**
- 3-5 строк с `has_html = true`
- `content_length` > 1000
- `fetched_at` = current timestamp

✅ **Если результаты соответствуют - Content Fetcher работает!**

---

## 📋 NEXT STEPS (после успешного теста)

### 3. Интеграция с Orchestrator (30 минут)

**Файл:** `supabase/migrations/050_integrate_content_fetcher.sql`

**Задача:** Обновить `run_source_hunter_sql()` чтобы после создания документов вызывался Content Fetcher.

**План:**
```sql
-- В конце run_source_hunter_sql() добавить:

-- After documents created, fetch their content
v_fetch_result := fetch_pending_documents(v_total_documents_created);

RAISE NOTICE 'Content Fetcher: % documents fetched, % failed',
  v_fetch_result.documents_fetched,
  v_fetch_result.documents_failed;
```

---

### 4. Тест полного Pipeline (15 минут)

```sql
-- Run full pipeline: Source Hunter → Content Fetcher
SELECT run_source_hunter_sql();

-- Verify documents have both URLs AND HTML
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN source_url IS NOT NULL THEN 1 ELSE 0 END) as has_url,
  SUM(CASE WHEN content_html IS NOT NULL THEN 1 ELSE 0 END) as has_html
FROM documents
WHERE created_at > NOW() - INTERVAL '10 minutes';
```

**Success criteria:**
- `total` = 3 (или больше)
- `has_url` = 3
- `has_html` = 2-3 (80%+ success rate OK)

---

## 🎯 Session Goals

**Сегодня (если всё работает):**
- ✅ Content Fetcher протестирован
- ✅ Интегрирован с orchestrator
- ✅ Полный pipeline работает (Source Hunter + Content Fetcher)

**Следующая сессия:**
- ⬆️ Масштабирование (2-3 источника, 5 URLs)
- 🔥 Event Extractor (извлечение событий из HTML)

---

## 📂 Важные файлы

**Миграции:**
- `048_content_fetcher_columns.sql` - error tracking columns
- `049_content_fetcher_sql_wrapper.sql` - SQL wrapper для Edge Function

**Edge Functions:**
- `supabase/functions/content-fetcher/index.ts` - обновлённый (deployed)

**Тестовые скрипты:**
- `sql-scripts/test_content_fetcher.sql` - полный тест
- `sql-scripts/add_service_role_key_to_vault.sql` - инструкция для Vault

**Документация:**
- `SESSION_CONTEXT.md` - полное описание сессии
- `CONTENT_FETCHER_ROADMAP.md` - план интеграции

---

## 🐛 Known Issues

**RESOLVED:**
- ✅ Content Fetcher Edge Function обновлён
- ✅ SQL wrapper создан
- ✅ Migrations applied

**BLOCKER:**
- ⚠️ SUPABASE_SERVICE_ROLE_KEY не в Vault → **FIX THIS FIRST!**

**NEXT:**
- ⏳ Интеграция с orchestrator (после теста)
- ⏳ Масштабирование pipeline

---

**Удачи! 🚀**
