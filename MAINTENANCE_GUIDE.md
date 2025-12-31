# 🔧 Памятка по обслуживанию - MarketMonitor

> **Версия:** 1.0.0
> **Дата:** 2025-12-30
> **Статус системы:** SQL-based Source Hunter + pg_cron автоматизация

---

## 📋 Содержание

1. [Ежедневные проверки](#ежедневные-проверки) (5 минут)
2. [Еженедельные проверки](#еженедельные-проверки) (15 минут)
3. [Ежемесячные проверки](#ежемесячные-проверки) (30 минут)
4. [Действия при проблемах](#действия-при-проблемах)
5. [Полезные команды](#полезные-команды)
6. [Контакты и ресурсы](#контакты-и-ресурсы)

---

## 🌅 Ежедневные проверки

**Когда:** Каждое утро после 9:30 AM (через 30 минут после автоматического запуска)
**Время:** ~5 минут
**Где:** Supabase Dashboard → SQL Editor

### ✅ Чек-лист:

- [ ] pg_cron запустился успешно
- [ ] Новые документы созданы (3-5 шт)
- [ ] Нет зависших заданий
- [ ] Нет критических ошибок

---

### 1️⃣ Проверка: Автоматический запуск прошёл успешно

**SQL запрос:**

```sql
-- Последний успешный запуск Source Hunter
SELECT
  status,
  started_at,
  completed_at,
  documents_created,
  execution_time_ms / 1000.0 as duration_seconds,
  error_message
FROM search_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC
LIMIT 1;
```

**✅ Ожидаемый результат:**

```
status    | started_at           | documents_created | duration_seconds | error_message
----------|----------------------|-------------------|------------------|-------------
completed | 2025-12-30 09:00:XX | 3-5               | 5-15             | NULL
```

**Что проверять:**
- ✅ `status = completed`
- ✅ `started_at` близко к 09:00 AM
- ✅ `documents_created > 0`
- ✅ `error_message IS NULL`

**❌ Если проблема:**
- `status = failed` → См. раздел [Действия при проблемах](#failed-run)
- `documents_created = 0` → Проверь источники и API keys
- `error_message NOT NULL` → Читай текст ошибки, см. [Troubleshooting](#troubleshooting)

---

### 2️⃣ Проверка: Новые документы сегодня

**SQL запрос:**

```sql
-- Документы за сегодня
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_docs,
  COUNT(CASE WHEN source_url IS NOT NULL THEN 1 END) as with_url,
  STRING_AGG(DISTINCT LEFT(title, 30), ', ') as sample_titles
FROM documents
WHERE created_at > CURRENT_DATE  -- Сегодня с 00:00
GROUP BY DATE(created_at);
```

**✅ Ожидаемый результат:**

```
date        | total_docs | with_url | sample_titles
------------|------------|----------|---------------------------------------------
2025-12-30  | 3-5        | 3-5      | Document from daichi.ru, Document from...
```

**Что проверять:**
- ✅ `total_docs >= 3` (минимум 3 документа)
- ✅ `with_url = total_docs` (все с URL)
- ✅ `sample_titles` содержит реальные названия

**❌ Если проблема:**
- `total_docs = 0` → pg_cron не запустился или упал
- `sample_titles` пустые → Проблема с парсингом Perplexity

---

### 3️⃣ Проверка: Нет зависших заданий

**SQL запрос:**

```sql
-- Проверка зависших запусков
SELECT
  id,
  status,
  started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as minutes_running
FROM search_runs
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

**✅ Ожидаемый результат:**

```
(Empty result set - no rows)
```

**Что проверять:**
- ✅ Результат пустой (0 строк)

**❌ Если проблема:**
- Есть строки → Зависшие задания
- **Действие:** Cleanup автоматически исправит через 15 минут
- Или вручную: См. [Ручная очистка зависших заданий](#manual-cleanup)

---

## 📅 Еженедельные проверки

**Когда:** Каждый понедельник
**Время:** ~15 минут
**Где:** Supabase Dashboard → SQL Editor + Admin Panel UI

### ✅ Чек-лист:

- [ ] Статистика за неделю в норме
- [ ] Success rate > 80%
- [ ] Средняя длительность < 20 секунд
- [ ] API usage в пределах лимитов
- [ ] Хранилище документов не переполнено
- [ ] Нет дубликатов документов

---

### 1️⃣ Проверка: Статистика за неделю

**SQL запрос:**

```sql
-- Weekly summary
SELECT
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate_percent,
  SUM(documents_created) as total_documents,
  ROUND(AVG(execution_time_ms) / 1000.0, 1) as avg_duration_seconds
FROM search_runs
WHERE started_at > NOW() - INTERVAL '7 days';
```

**✅ Ожидаемый результат:**

```
total_runs | successful | failed | success_rate_percent | total_documents | avg_duration_seconds
-----------|------------|--------|----------------------|-----------------|--------------------
7          | 6-7        | 0-1    | 85.7-100.0          | 21-35           | 8-15
```

**Что проверять:**
- ✅ `success_rate_percent >= 80%`
- ✅ `avg_duration_seconds < 20`
- ✅ `total_documents >= 21` (минимум 3 в день × 7 дней)

**❌ Если проблема:**
- `success_rate < 80%` → Проверь логи ошибок, см. [Failed Runs Analysis](#failed-runs)
- `avg_duration > 20s` → Возможно timeout близко, см. [Performance Issues](#performance)

---

### 2️⃣ Проверка: Распределение документов по дням

**SQL запрос:**

```sql
-- Daily document creation trend
SELECT
  DATE(created_at) as date,
  COUNT(*) as documents,
  CASE
    WHEN COUNT(*) >= 3 THEN '✅ Good'
    WHEN COUNT(*) >= 1 THEN '⚠️ Low'
    ELSE '❌ None'
  END as status
FROM documents
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**✅ Ожидаемый результат:**

```
date        | documents | status
------------|-----------|--------
2025-12-30  | 3         | ✅ Good
2025-12-29  | 27        | ✅ Good (manual test)
2025-12-28  | 4         | ✅ Good
...
```

**Что проверять:**
- ✅ Каждый день >= 3 документа
- ✅ Нет пропусков (каждый день присутствует)

**❌ Если проблема:**
- Пропущенный день → pg_cron не запустился
- Все дни < 3 документов → Нужно увеличить лимиты источников

---

### 3️⃣ Проверка: API Usage (Perplexity)

**SQL запрос:**

```sql
-- Perplexity API usage (if tracking table exists)
SELECT
  DATE(request_timestamp) as date,
  COUNT(*) as api_calls,
  SUM(tokens_used) as total_tokens
FROM perplexity_search_usage
WHERE request_timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE(request_timestamp)
ORDER BY date DESC;
```

**✅ Ожидаемый результат:**

```
date        | api_calls | total_tokens
------------|-----------|-------------
2025-12-30  | 1-3       | 500-1500
2025-12-29  | 8         | 4000-8000
...
```

**Что проверять:**
- ✅ `api_calls` в пределах лимита (1000 requests/day для Perplexity)
- ✅ `total_tokens` не превышает лимиты

**⚠️ Лимиты Perplexity:**
- Free tier: 1000 requests/day
- Paid tier: см. ваш план

---

### 4️⃣ Проверка: Дубликаты документов

**SQL запрос:**

```sql
-- Check for duplicate URLs
SELECT
  source_url,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as document_ids
FROM documents
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source_url
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;
```

**✅ Ожидаемый результат:**

```
(Empty result set - no duplicates)
```

**Что проверять:**
- ✅ Результат пустой (0 дубликатов)

**❌ Если проблема:**
- Есть дубликаты → Deduplication не работает
- **Действие:** Удалить дубликаты вручную или настроить дедупликацию

---

## 📊 Ежемесячные проверки

**Когда:** Первый рабочий день месяца
**Время:** ~30 минут
**Где:** Supabase Dashboard + Admin Panel

### ✅ Чек-лист:

- [ ] Общая статистика за месяц
- [ ] Cost analysis (API usage)
- [ ] Database size и performance
- [ ] Cleanup старых данных (опционально)
- [ ] Review и оптимизация лимитов

---

### 1️⃣ Проверка: Месячная статистика

**SQL запрос:**

```sql
-- Monthly summary
SELECT
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
  SUM(documents_created) as total_documents,
  ROUND(AVG(execution_time_ms) / 1000.0, 1) as avg_duration_sec,
  MIN(started_at) as first_run,
  MAX(started_at) as last_run
FROM search_runs
WHERE started_at > NOW() - INTERVAL '30 days';
```

**✅ Ожидаемый результат:**

```
total_runs | successful | success_rate | total_documents | avg_duration_sec
-----------|------------|--------------|-----------------|----------------
30         | 27-30      | 90-100       | 90-150          | 8-15
```

---

### 2️⃣ Проверка: Database Size

**SQL запрос:**

```sql
-- Database size by table
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

**Что проверять:**
- ✅ `documents` table < 1 GB (для первых месяцев)
- ✅ Общий размер БД в пределах Supabase плана

---

### 3️⃣ Очистка старых данных (опционально)

**SQL запрос (ОСТОРОЖНО!):**

```sql
-- Delete search_runs older than 3 months (keeps documents)
-- ВНИМАНИЕ: Удалит старые логи запусков!

-- Сначала ПРОСМОТР:
SELECT COUNT(*) as runs_to_delete
FROM search_runs
WHERE started_at < NOW() - INTERVAL '90 days';

-- Потом УДАЛЕНИЕ (если согласен):
-- DELETE FROM search_runs_stages
-- WHERE search_run_id IN (
--   SELECT id FROM search_runs
--   WHERE started_at < NOW() - INTERVAL '90 days'
-- );
--
-- DELETE FROM search_runs
-- WHERE started_at < NOW() - INTERVAL '90 days';
```

**⚠️ ВАЖНО:**
- Делай backup перед удалением!
- Документы НЕ удаляются, только логи запусков

---

## 🚨 Действия при проблемах

### <a name="failed-run"></a>❌ Problem: Failed Run (status = failed)

**Диагностика:**

```sql
-- Последние ошибки
SELECT
  started_at,
  error_message,
  execution_time_ms / 1000.0 as duration_sec,
  documents_created
FROM search_runs
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 5;
```

**Частые причины:**

1. **API Key expired/invalid**
   - Ошибка: "Invalid API key" или "401 Unauthorized"
   - **Решение:** Обнови API keys в Supabase Vault

2. **Timeout (>5 seconds для HTTP)**
   - Ошибка: "Operation timed out after 5002 milliseconds"
   - **Решение:** Упрости Perplexity запрос или уменьши лимиты

3. **Rate limit exceeded**
   - Ошибка: "429 Too Many Requests"
   - **Решение:** Подожди до следующего дня или увеличь план

**Действия:**

```sql
-- 1. Прочитай error_message
SELECT error_message FROM search_runs WHERE status = 'failed' ORDER BY started_at DESC LIMIT 1;

-- 2. Проверь API keys в Vault
SELECT name, description, created_at
FROM vault.secrets
WHERE name IN ('OPENAI_API_KEY', 'PERPLEXITY_API_KEY');

-- 3. Если нужно - обнови secrets (ОСТОРОЖНО!)
-- SELECT vault.create_secret('NEW_KEY_VALUE', 'PERPLEXITY_API_KEY', 'Updated key');
```

---

### <a name="manual-cleanup"></a>🧹 Manual Cleanup: Зависшие задания

**Если автоматическая очистка не сработала:**

```sql
-- Проверь зависшие
SELECT id, status, started_at,
  EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as minutes_stuck
FROM search_runs
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';

-- Исправь вручную
UPDATE search_runs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = 'Manually cleaned - stuck for >10 minutes'
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

---

### <a name="performance"></a>⚡ Performance Issues: Медленные запуски

**Диагностика:**

```sql
-- Самые медленные запуски
SELECT
  started_at,
  execution_time_ms / 1000.0 as duration_sec,
  documents_created,
  status
FROM search_runs
WHERE started_at > NOW() - INTERVAL '7 days'
ORDER BY execution_time_ms DESC
LIMIT 10;
```

**Если `duration > 20 секунд`:**

1. **Уменьши количество источников:**
   ```sql
   -- Текущие лимиты
   SELECT
     name,
     max_sources_per_run,
     min_source_priority
   FROM monitoring_profiles
   WHERE is_active = true;
   ```

2. **Проверь Perplexity response time** (в логах Edge Function)

3. **Оптимизируй запросы** (упрости промпты)

---

### 🔥 Problem: No Documents Created (documents_created = 0)

**Диагностика:**

```sql
-- Проверь последний запуск с деталями
SELECT
  started_at,
  status,
  documents_created,
  error_message
FROM search_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC
LIMIT 1;
```

**Причины:**

1. **Perplexity вернул пустой результат**
   - Запрос слишком специфичный
   - Нет результатов по теме
   - **Решение:** Проверь search query, расширь тему

2. **Источники неактивны**
   ```sql
   -- Проверь активные источники
   SELECT code, name, url, is_active, priority
   FROM sources
   WHERE is_active = true
   ORDER BY priority DESC;
   ```
   - **Решение:** Активируй источники или добавь новые

3. **Segment links не настроены**
   ```sql
   -- Проверь segment в профиле
   SELECT
     mp.name as profile_name,
     mp.segment_ids,
     s.name as segment_name
   FROM monitoring_profiles mp
   LEFT JOIN segments s ON s.id = ANY(mp.segment_ids)
   WHERE mp.is_active = true;
   ```
   - **Решение:** Настрой segment_ids в monitoring_profile

---

### 🔐 Problem: API Authentication Failed (401/403)

**Симптомы:**
- Error: "Invalid API key"
- Error: "401 Unauthorized"
- Error: "403 Forbidden"

**Диагностика:**

```sql
-- Проверь наличие secrets
SELECT name, description, created_at
FROM vault.secrets
WHERE name IN ('OPENAI_API_KEY', 'PERPLEXITY_API_KEY');
```

**Решение:**

1. **Проверь API keys в Supabase Dashboard:**
   - Dashboard → Settings → Vault
   - Убедись что оба ключа существуют

2. **Обнови ключи (если expired):**
   ```sql
   -- ОСТОРОЖНО: Только если уверен!
   -- SELECT vault.create_secret('NEW_KEY_HERE', 'PERPLEXITY_API_KEY', 'Updated key');
   ```

3. **Тест API keys вручную:**
   - OpenAI: https://platform.openai.com/api-keys
   - Perplexity: https://www.perplexity.ai/settings/api

---

### 🌐 Problem: Network Timeout (>60 seconds)

**Симптомы:**
- Error: "Operation timed out after 5002 milliseconds"
- Error: "network error"
- Execution time > 60 seconds

**Диагностика:**

```sql
-- Проверь длительность запросов
SELECT
  started_at,
  execution_time_ms / 1000.0 as duration_sec,
  documents_created,
  error_message
FROM search_runs
WHERE execution_time_ms > 60000  -- > 60 seconds
ORDER BY started_at DESC
LIMIT 5;
```

**Причины:**

1. **HTTP Extension Timeout (5s)**
   - PostgreSQL http extension имеет hard limit 5 секунд
   - **Решение:** Упрости запросы, убери лишние параметры

2. **Perplexity API медленно отвечает**
   - Сложный запрос
   - Много результатов
   - **Решение:**
     ```sql
     -- Уменьши max_results в search_perplexity()
     -- Текущее значение: 10, попробуй 5
     ```

3. **Слишком много источников**
   ```sql
   -- Проверь лимиты
   SELECT
     name,
     max_sources_per_run,
     max_urls_per_source
   FROM monitoring_profiles
   WHERE is_active = true;
   ```
   - **Решение:** Уменьши max_sources_per_run с 3 до 1-2

---

### 📊 Problem: Low Quality Documents (irrelevant results)

**Симптомы:**
- Документы созданы, но не релевантны сегменту
- Title generic ("Document from...")
- Низкое качество контента

**Диагностика:**

```sql
-- Проверь последние документы
SELECT
  title,
  source_url,
  created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;
```

**Решение:**

1. **Улучши search query prompts:**
   - Открой миграцию `037_sql_source_hunter_functions.sql`
   - Найди функцию `generate_search_query()`
   - Уточни промпт для более специфичных запросов

2. **Добавь фильтры по источникам:**
   ```sql
   -- Проверь приоритеты источников
   SELECT code, name, priority, is_active
   FROM sources
   ORDER BY priority DESC;
   ```
   - Повысь priority проверенных источников
   - Понизь priority нерелевантных

3. **Настрой min_source_priority:**
   ```sql
   -- Повысь порог минимального приоритета
   UPDATE monitoring_profiles
   SET min_source_priority = 3  -- было 1
   WHERE name = 'MVP Test Profile';
   ```

---

### 🔄 Problem: Duplicate Documents

**Симптомы:**
- Одинаковые URLs в разные дни
- Повторяющийся контент

**Диагностика:**

```sql
-- Найди дубликаты по URL
SELECT
  source_url,
  COUNT(*) as duplicate_count,
  STRING_AGG(id::text, ', ') as document_ids
FROM documents
GROUP BY source_url
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;
```

**Решение:**

1. **Deduplication не работает:**
   - Проверь `dedupe_threshold` в monitoring_profile
   ```sql
   SELECT name, dedupe_threshold
   FROM monitoring_profiles
   WHERE is_active = true;
   ```
   - Рекомендуемое значение: 0.85 (85% similarity)

2. **Удали дубликаты вручную:**
   ```sql
   -- ОСТОРОЖНО: Удалит старые дубликаты, оставит новые
   DELETE FROM documents
   WHERE id IN (
     SELECT id
     FROM (
       SELECT id,
         ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at DESC) as rn
       FROM documents
     ) t
     WHERE rn > 1
   );
   ```

---

### 💾 Problem: Database Full / Storage Limit

**Симптомы:**
- Error: "database is full"
- Error: "out of storage"
- Медленные запросы

**Диагностика:**

```sql
-- Проверь размер базы данных
SELECT
  pg_size_pretty(pg_database_size(current_database())) as total_size;

-- Проверь размер таблиц
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

**Решение:**

1. **Очисти старые логи:**
   ```sql
   -- Удали search_runs старше 3 месяцев
   DELETE FROM search_runs_stages
   WHERE search_run_id IN (
     SELECT id FROM search_runs
     WHERE started_at < NOW() - INTERVAL '90 days'
   );

   DELETE FROM search_runs
   WHERE started_at < NOW() - INTERVAL '90 days';
   ```

2. **Удали неиспользуемые документы:**
   ```sql
   -- ОСТОРОЖНО: Проверь перед удалением!
   -- Удали документы без segment links (orphaned)
   DELETE FROM documents
   WHERE id NOT IN (
     SELECT DISTINCT document_id FROM document_segments
   );
   ```

3. **Upgrade Supabase plan:**
   - Dashboard → Settings → Billing
   - Увеличь storage limit

---

### 🚫 Problem: pg_cron Job Not Running

**Симптомы:**
- Нет новых документов после 9:00 AM
- Last run был вчера
- Automatic запуски не происходят

**Диагностика:**

```sql
-- Проверь статус jobs
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database,
  username
FROM cron.job
WHERE jobname IN ('run-sql-source-hunter', 'cleanup-stuck-runs');

-- Проверь последние выполнения
SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

**Решение:**

1. **Job неактивен:**
   ```sql
   -- Активируй job
   UPDATE cron.job
   SET active = true
   WHERE jobname = 'run-sql-source-hunter';
   ```

2. **Неправильное расписание:**
   ```sql
   -- Проверь cron expression
   -- '0 9 * * *' = каждый день в 9:00 AM
   SELECT jobname, schedule FROM cron.job;
   ```

3. **Job failed:**
   - Проверь `return_message` в `cron.job_run_details`
   - Если ошибка → исправь и пересоздай job

4. **Пересоздай job:**
   ```sql
   -- Удали старый
   SELECT cron.unschedule('run-sql-source-hunter');

   -- Создай новый
   SELECT cron.schedule(
     'run-sql-source-hunter',
     '0 9 * * *',
     $$
     SELECT run_source_hunter_sql(
       p_monitoring_profile_id := (
         SELECT id FROM monitoring_profiles WHERE name = 'MVP Test Profile' LIMIT 1
       )
     );
     $$
   );
   ```

---

## 🛠️ Полезные команды

### Перезапустить pg_cron job вручную

**Через SQL:**

```sql
-- Вызвать Source Hunter вручную
SELECT run_source_hunter_sql(
  p_monitoring_profile_id := (
    SELECT id FROM monitoring_profiles WHERE name = 'MVP Test Profile' LIMIT 1
  )
);
```

**Через Admin UI:**
1. Открой http://localhost:3000/admin
2. Вкладка "🚀 Pipeline Management"
3. Найди профиль "MVP Test Profile"
4. Нажми кнопку "Запустить"

---

### Проверить следующий запланированный запуск

```sql
-- Информация о расписании
SELECT
  jobname,
  schedule,
  active,
  CASE
    WHEN schedule = '0 9 * * *' THEN 'Daily at 9:00 AM'
    WHEN schedule = '*/15 * * * *' THEN 'Every 15 minutes'
    ELSE schedule
  END as description
FROM cron.job
WHERE jobname IN ('run-sql-source-hunter', 'cleanup-stuck-runs');
```

---

### Экспорт данных для отчётов

```sql
-- Export weekly report
COPY (
  SELECT
    DATE(started_at) as date,
    COUNT(*) as runs,
    SUM(documents_created) as documents,
    ROUND(AVG(execution_time_ms) / 1000.0, 1) as avg_duration_sec
  FROM search_runs
  WHERE started_at > NOW() - INTERVAL '7 days'
  GROUP BY DATE(started_at)
  ORDER BY date DESC
) TO '/tmp/weekly_report.csv' WITH CSV HEADER;
```

---

## 📚 Контакты и ресурсы

### Supabase Dashboard
- **URL:** https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob
- **SQL Editor:** Dashboard → SQL Editor
- **Edge Functions Logs:** Dashboard → Edge Functions → Logs

### Документация проекта
- **CLAUDE.md** - Главный контекст проекта
- **LESSONS_LEARNED.md** - Решения типичных проблем
- **SESSION_CONTEXT.md** - Текущий статус и приоритеты
- **TODO.md** - Список задач
- **AI_AGENTS_ARCHITECTURE_V3.md** - Архитектура Scope-Aware

### API Documentation
- **Perplexity AI:** https://docs.perplexity.ai/
- **OpenAI API:** https://platform.openai.com/docs/api-reference
- **Supabase PostgreSQL:** https://supabase.com/docs/guides/database

### Support
- **Supabase Support:** https://supabase.com/dashboard/support
- **GitHub Issues:** (если есть репозиторий)

---

## 📝 История изменений

| Дата       | Версия | Изменения |
|------------|--------|-----------|
| 2025-12-30 | 1.0.0  | Первая версия памятки после SQL-based Source Hunter implementation |

---

**Последнее обновление:** 2025-12-30
**Автор:** Claude Code Session
**Статус:** ✅ Готово к использованию
