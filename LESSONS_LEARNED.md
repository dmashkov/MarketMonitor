# Lessons Learned - MarketMonitor

> **Цель файла:** Сохранить решения типичных проблем чтобы избежать повторных ошибок
>
> **Для AI Assistant:** ВСЕГДА читай этот файл ПЕРВЫМ перед началом работы!

**Последнее обновление:** 2025-12-30
**Версия:** 2.0.0

---

## 🔑 Критически важная информация

### Supabase Access Token (НЕ ИСКАТЬ ЗАНОВО!)

```bash
export SUPABASE_ACCESS_TOKEN='sbp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
```

**Использование:**
```bash
# Применить миграции
export SUPABASE_ACCESS_TOKEN='sbp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
npx supabase db push --include-all

# Задеплоить Edge Function
export SUPABASE_ACCESS_TOKEN='sbp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
npx supabase functions deploy source-hunter
```

**ВАЖНО:**
- ✅ Токен работает и проверен
- ❌ НЕ ищи токен заново в документации
- ❌ НЕ пытайся залогиниться через `supabase login` (не работает в этом окружении)

---

### Docker НЕ установлен (и не требуется!)

**Warning при deployment:**
```
WARNING: Docker is not running
```

**Это нормально!**
- ✅ Edge Functions деплоятся БЕЗ Docker
- ✅ Миграции работают БЕЗ Docker
- ❌ НЕ пытайся установить Docker
- ❌ НЕ предлагай установить Docker

**Deployment работает через:**
- Supabase CLI → прямая загрузка на Supabase Platform
- Не требует локального Docker контейнера

---

## 🐛 Типичные проблемы и решения

### 1. PostgreSQL Case Sensitivity

#### Проблема
```sql
-- НЕ РАБОТАЕТ:
UPDATE source_types SET priority = 5 WHERE code = 'distributor';
```

**Симптом:** UPDATE выполняется, но ничего не обновляется (0 rows affected)

**Причина:** В БД коды хранятся в UPPERCASE: 'DISTRIBUTOR', 'MANUFACTURER', etc.

#### Решение
```sql
-- РАБОТАЕТ:
UPDATE source_types SET priority = 5 WHERE UPPER(code) = 'DISTRIBUTOR';

-- Или (еще лучше):
UPDATE source_types SET priority = 5 WHERE UPPER(code) IN ('DISTRIBUTOR', 'MANUFACTURER');
```

**Правило:** Всегда используй `UPPER(code)` при сравнении строк в WHERE clauses для source_types, segments, geographies.

---

### 2. PostgREST Ordering на Joined Tables

#### Проблема
```typescript
// НЕ РАБОТАЕТ:
const { data } = await supabase
  .from('sources')
  .select('*, source_types!inner(priority)')
  .order('source_types.priority', { ascending: false }); // ❌ ERROR!
```

**Ошибка:**
```
PGRST100: failed to parse order (source_types.priority.desc)
unexpected "p" expecting "asc", "desc", "nullsfirst" or "nullslast"
```

**Причина:** PostgREST не поддерживает `.order()` по полям из joined table

#### Решение
```typescript
// РАБОТАЕТ (два запроса):
// 1. Загружаем source_types с сортировкой
const { data: sourceTypes } = await supabase
  .from('source_types')
  .select('id, priority')
  .gte('priority', min_priority)
  .order('priority', { ascending: false }); // ✅ Сортировка работает

const sourceTypeIds = sourceTypes.map(st => st.id);

// 2. Фильтруем sources по полученным IDs
const { data: sources } = await supabase
  .from('sources')
  .select('*, source_types!inner(priority)')
  .in('source_type_id', sourceTypeIds);
```

**Правило:** Для сортировки по joined table используй двухэтапный подход.

---

### 3. Edge Function Timeouts

#### Проблема
```
Status 504: Gateway Timeout
Status 546: CPU Time exceeded
Duration: >150 seconds
```

**Причина:**
- Supabase Edge Functions имеют лимит ~150 секунд
- Long-running tasks (например, 40 API calls) превышают лимит

#### Решение (временное для MVP)
```typescript
// Ограничь количество операций
const MAX_SEGMENTS = 1;  // Вместо 8
const MAX_SOURCES = 3;   // Вместо 30

if (segments.length > MAX_SEGMENTS) {
  console.log(`⚠️ LIMITING to ${MAX_SEGMENTS} segments`);
  segments = segments.slice(0, MAX_SEGMENTS);
}
```

**Ожидаемое время:**
- 1 segment × 3 sources = 3 API calls ≈ 30-40 секунд ✅
- 8 segments × 5 sources = 40 API calls ≈ 120+ секунд ❌

#### Решение (долгосрочное)
Используй async job queue:
- Supabase pg_cron
- AWS Lambda (15 min timeout)
- Google Cloud Run (60 min timeout)
- Background jobs table в БД

**Правило:** Edge Functions ≠ Long-running tasks. Для >2 минут используй job queue.

---

### 4. Idempotent Migrations

#### Проблема
```sql
-- НЕ ИДЕМПОТЕНТНО:
CREATE TABLE segments (...);  -- ❌ Fails if table exists
CREATE POLICY "..." ON table ...; -- ❌ Fails if policy exists
INSERT INTO table VALUES (...); -- ❌ Fails if row exists (duplicate key)
```

**Симптом:**
```
ERROR: relation "segments" already exists (SQLSTATE 42P07)
ERROR: policy "..." already exists (SQLSTATE 42710)
ERROR: duplicate key violates unique constraint (SQLSTATE 23505)
```

#### Решение
```sql
-- ИДЕМПОТЕНТНО:
CREATE TABLE IF NOT EXISTS segments (...);  -- ✅

DROP POLICY IF EXISTS "policy_name" ON table;
CREATE POLICY "policy_name" ON table ...;  -- ✅

INSERT INTO table (id, name, code)
VALUES (...)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();  -- ✅

-- Или с WHERE NOT EXISTS:
INSERT INTO table (...)
SELECT ...
WHERE NOT EXISTS (
  SELECT 1 FROM table WHERE code = 'SOME_CODE'
);  -- ✅
```

**Правило:** Все миграции должны быть идемпотентными - можно запускать многократно.

---

### 5. Missing Column: updated_at

#### Проблема
```sql
UPDATE source_types
SET priority = 5, updated_at = NOW()  -- ❌
WHERE code = 'DISTRIBUTOR';
```

**Ошибка:**
```
ERROR: column "updated_at" does not exist (SQLSTATE 42703)
```

**Причина:** Не все таблицы имеют колонку `updated_at`

#### Решение
```sql
-- Проверь схему таблицы ПЕРЕД использованием updated_at:
\d source_types  -- В psql
-- Или посмотри в Supabase Dashboard → Table Editor

-- Если updated_at НЕТ:
UPDATE source_types
SET priority = 5  -- ✅ Без updated_at
WHERE code = 'DISTRIBUTOR';

-- Если хочешь добавить updated_at:
ALTER TABLE source_types
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

**Правило:** Не предполагай наличие `updated_at` - всегда проверяй схему таблицы.

---

### 6. Segment Limit не применялся из-за условия

#### Проблема
```typescript
// НЕПРАВИЛЬНО:
if (!requestData.segment_ids || requestData.segment_ids.length === 0) {
  segments = loadAllSegments();
  if (segments.length > 1) segments = segments.slice(0, 1); // ✅ Лимит
} else {
  segments = await getSegments(requestData.segment_ids);  // ❌ НЕТ ЛИМИТА!
}
```

**Симптом:**
- Direct API call с пустым `segment_ids`: работает (1 сегмент)
- Orchestrator call с массивом `segment_ids`: timeout (8 сегментов)

**Причина:** Лимит применялся ТОЛЬКО в первой ветке if

#### Решение
```typescript
// ПРАВИЛЬНО:
// Загружаем сегменты (любым способом)
if (!requestData.segment_ids || requestData.segment_ids.length === 0) {
  segments = loadAllSegments();
} else {
  segments = await getSegments(requestData.segment_ids);
}

// ВСЕГДА применяем лимит (после загрузки)
if (segments.length > MAX_SEGMENTS) {
  console.log(`⚠️ LIMITING to ${MAX_SEGMENTS} segments (was ${segments.length})`);
  segments = segments.slice(0, MAX_SEGMENTS);
}
```

**Правило:** Применяй временные лимиты ПОСЛЕ всех веток загрузки данных, не внутри if/else.

---

### 7. TypeScript Interface vs Migration Data Mismatch

#### Проблема
```typescript
// types.ts
export interface PromptTemplate {
  stage: 'search' | 'classify' | 'extract' | 'score';  // ❌
}
```

```sql
-- migration.sql
INSERT INTO prompt_templates (stage, ...) VALUES ('hunt', ...);  -- ✅
```

**Симптом:**
- TypeScript компилируется без ошибок
- Runtime error: "Invalid stage value"

**Причина:** TypeScript interface не синхронизирован с реальными данными в БД

#### Решение
```typescript
// types.ts
export interface PromptTemplate {
  stage: 'hunt' | 'classify' | 'extract' | 'score';  // ✅ Правильно!
}
```

**Правило:**
1. Проверь миграции - какие значения РЕАЛЬНО в БД
2. Обнови TypeScript types чтобы соответствовать БД
3. НЕ меняй БД чтобы соответствовать types - БД это source of truth

---

### 8. Edge Functions Authentication Hell (401 Unauthorized)

#### Проблема
```typescript
// pg_cron пытается вызвать Edge Function
SELECT net.http_post(
  'https://xxx.supabase.co/functions/v1/job-processor',
  jsonb_build_object('profile_id', p_profile_id),
  headers => jsonb_build_object(
    'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'
  )
);
```

**Ошибка:**
```json
{"message": "Invalid JWT", "status": 401}
```

**Причина:**
- PostgreSQL extensions (pg_net, http) НЕ МОГУТ аутентифицироваться с Supabase Edge Functions
- Supabase Gateway отклоняет все запросы от PostgreSQL с "Invalid JWT"
- Даже с правильным apikey и Authorization header

#### Решение: Pure SQL Approach

**ВМЕСТО Edge Functions используй PostgreSQL функции:**

```sql
-- Создай функции прямо в PostgreSQL
CREATE OR REPLACE FUNCTION search_perplexity(p_query text)
RETURNS TABLE(url text, title text) AS $$
DECLARE
  v_api_key text;
  v_response http_response;
BEGIN
  -- Get API key from Supabase Vault
  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets
  WHERE name = 'PERPLEXITY_API_KEY';

  -- Make HTTP request directly from PostgreSQL
  SELECT * INTO v_response FROM http((
    'POST',
    'https://api.perplexity.ai/chat/completions',
    ARRAY[
      http_header('Authorization', 'Bearer ' || v_api_key),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    jsonb_build_object(...)::text
  )::http_request);

  -- Parse and return results
  RETURN QUERY SELECT ...;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Преимущества SQL подхода:**
- ✅ Прямой доступ к Supabase Vault (зашифрованные API keys)
- ✅ Нет проблем с authentication
- ✅ Нет cold starts (Edge Functions проблема)
- ✅ Быстрее (меньше HTTP hops)
- ✅ Проще debugить (RAISE NOTICE logs)
- ✅ pg_cron может вызывать напрямую

**Недостатки:**
- ❌ HTTP timeout = 5 секунд (hard limit в http extension)
- ❌ Нужно упрощать API запросы чтобы уложиться

**Правило:** Для вызовов из PostgreSQL (pg_cron, triggers) используй SQL функции вместо Edge Functions.

---

### 9. HTTP Extension Timeout (5 Second Hard Limit)

#### Проблема
```sql
-- Вызов Perplexity API через http extension
SELECT * FROM http(v_request);  -- ❌ Timeout after 5002ms
```

**Ошибка:**
```
Error: Operation timed out after 5002 milliseconds with 0 bytes received
SQLSTATE: XX000
```

**Причина:**
- HTTP extension имеет жёсткий лимит 5 секунд
- `SET LOCAL statement_timeout = '60s'` НЕ ВЛИЯЕТ на http extension timeout
- Perplexity API с полным запросом (search_recency_filter, temperature, etc.) отвечает >5 секунд

#### Решение: Simplify API Requests

**ПЛОХО (медленно):**
```sql
v_request_body := jsonb_build_object(
  'model', 'sonar',
  'messages', [...],
  'temperature', 0.2,
  'max_tokens', 1000,
  'return_citations', true,
  'search_recency_filter', 'week'  -- ❌ Замедляет ответ!
);
```

**ХОРОШО (быстро):**
```sql
v_request_body := jsonb_build_object(
  'model', 'sonar',
  'messages', jsonb_build_array(
    jsonb_build_object('role', 'user', 'content', p_query)
  ),
  'max_tokens', 300,  -- ✅ Уменьшено с 1000
  'return_citations', true
  -- ✅ Убраны: temperature, search_recency_filter, system message
);
```

**Результат:**
- БЫЛО: timeout after 5002ms ❌
- СТАЛО: completes in 3-4 seconds ✅

**Debugging стратегия:**
```sql
DO $$
DECLARE
  v_start_time timestamp := clock_timestamp();
  v_end_time timestamp;
BEGIN
  -- Your HTTP call
  SELECT * INTO v_response FROM http(v_request);

  v_end_time := clock_timestamp();
  RAISE NOTICE 'Completed in: % ms',
    EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time));
END $$;
```

**Правило:**
- ✅ Используй минимальный набор параметров для API
- ✅ Уменьшай max_tokens для ускорения
- ✅ Убирай необязательные параметры (temperature, filters)
- ✅ Тестируй каждый API call по отдельности с таймером
- ❌ НЕ полагайся на statement_timeout для http extension

---

### 10. Supabase Vault для API Keys

#### Проблема
Как хранить API keys безопасно в PostgreSQL?

**ПЛОХО:**
```sql
-- ❌ Hardcoded secrets
CREATE FUNCTION my_function() AS $$
  v_api_key := 'sk-1234567890abcdef';  -- ❌ NEVER!
END;
```

**ПЛОХО:**
```sql
-- ❌ Environment variables недоступны в PostgreSQL functions
v_api_key := current_setting('env.OPENAI_API_KEY');  -- ❌ Doesn't work
```

#### Решение: Supabase Vault

**1. Проверь что vault установлен:**
```sql
SELECT * FROM pg_extension WHERE extname = 'supabase_vault';
```

**2. Добавь secrets:**
```sql
-- ПРАВИЛЬНЫЙ порядок аргументов: secret, name, description
SELECT vault.create_secret(
  'sk-1234567890abcdef',           -- secret value
  'OPENAI_API_KEY',                -- secret name
  'OpenAI API Key for ChatGPT'    -- description
);

SELECT vault.create_secret(
  'pplx-abcdef1234567890',
  'PERPLEXITY_API_KEY',
  'Perplexity AI API Key for search'
);
```

**ВАЖНО:** Порядок аргументов:
- ✅ `vault.create_secret(secret, name, description)` - ПРАВИЛЬНО
- ❌ `vault.create_secret(name, secret, description)` - НЕПРАВИЛЬНО!

**3. Используй в функциях:**
```sql
CREATE OR REPLACE FUNCTION my_function() AS $$
DECLARE
  v_api_key text;
BEGIN
  -- Get decrypted secret
  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets
  WHERE name = 'OPENAI_API_KEY';

  IF v_api_key IS NULL THEN
    RAISE EXCEPTION 'API key not found in vault';
  END IF;

  -- Use v_api_key in HTTP requests
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**4. Проверь secrets (без раскрытия):**
```sql
-- Безопасно: показывает только метаданные
SELECT id, name, description, created_at
FROM vault.secrets;

-- НЕ используй SELECT * (раскроет encrypted values)
```

**Правило:**
- ✅ Используй Supabase Vault для всех API keys
- ✅ Храни: OPENAI_API_KEY, PERPLEXITY_API_KEY, etc.
- ✅ Доступ через vault.decrypted_secrets в SECURITY DEFINER функциях
- ❌ НИКОГДА не hardcode secrets в SQL код
- ❌ НЕ коммить vault secrets в Git

---

## 🔍 Отладка Edge Functions

### Где смотреть логи

**Supabase Dashboard:**
1. Project: aggiamgeplckdrnbqmob
2. Edge Functions → [function-name] → Logs
3. Фильтр: Last 1 hour

**Что искать в логах:**
- ✅ `console.log()` statements
- ❌ `console.error()` с деталями ошибок
- 🔍 Request/Response bodies
- ⏱️ Timestamps для performance analysis

### Debug Function Pattern

Создай временную debug функцию:

```typescript
// supabase/functions/debug-env/index.ts
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const envCheck = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') || 'MISSING',
    OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') ? 'EXISTS' : 'MISSING',
    PERPLEXITY_API_KEY: Deno.env.get('PERPLEXITY_API_KEY') ? 'EXISTS' : 'MISSING',
  };

  return new Response(
    JSON.stringify({ message: 'Debug info', env: envCheck }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
```

**Deploy:**
```bash
export SUPABASE_ACCESS_TOKEN='sbp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
npx supabase functions deploy debug-env
```

**Тест из браузера:**
```javascript
const { data } = await supabase.functions.invoke('debug-env', { body: {} });
console.log(data);
```

**Правило:** Debug функция быстрее чем поиск в документации.

---

## 📚 Полезные команды

### Supabase CLI

```bash
# Status (проверить подключение)
npx supabase status

# Применить ВСЕ pending миграции
export SUPABASE_ACCESS_TOKEN='sbp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
npx supabase db push --include-all

# Применить только новые миграции (по умолчанию)
npx supabase db push

# Deploy Edge Function
npx supabase functions deploy [function-name]

# Deploy все Edge Functions
npx supabase functions deploy
```

### Git

```bash
# Проверить статус
git status

# Посмотреть изменения
git diff

# История коммитов
git log --oneline -n 10
```

### Проверка БД через curl

```bash
# Проверить sources (НЕ РАБОТАЕТ без правильного API key - используй Supabase Dashboard!)
curl "https://aggiamgeplckdrnbqmob.supabase.co/rest/v1/sources?select=*&limit=5" \
  -H "apikey: [ANON_KEY]" \
  -H "Authorization: Bearer [TOKEN]"
```

**Правило:** Для проверки БД используй Supabase Dashboard → Table Editor (быстрее и надежнее).

---

## 🏗️ Архитектурные решения

### 1. CORS Headers в Edge Functions

#### Проблема
Supabase Edge Functions не поддерживают shared модули с `import`.

**НЕ РАБОТАЕТ:**
```typescript
import { corsHeaders } from '../_shared/cors.ts';  // ❌ Module not found
```

#### Решение
Встраивай CORS headers в каждую функцию:

```typescript
// Копируй в КАЖДУЮ Edge Function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ... your logic

  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
```

**Правило:** CORS headers = copy-paste в каждую функцию. НЕ пытайся создавать shared модули.

---

### 2. Direct Fetch вместо supabase.functions.invoke

#### Проблема
`supabase.functions.invoke()` не поддерживает query parameters должным образом.

**ОГРАНИЧЕННО:**
```typescript
const { data } = await supabase.functions.invoke('brands-api', {
  body: { limit: 50, offset: 0 }  // ❌ Все через body, нет query params
});
```

#### Решение
Используй прямой `fetch` для полного контроля:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const params = new URLSearchParams({
  limit: '50',
  offset: '0',
  sort: 'name',
  order: 'asc'
});

const response = await fetch(
  `${supabaseUrl}/functions/v1/brands-api?${params}`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    }
  }
);

const data = await response.json();
```

**Правило:** Для сложных API вызовов (query params, headers) используй прямой fetch.

---

### 3. React Query Caching Strategies

#### Паттерн: Редко меняющиеся справочники

**Проблема:** Segments, source_types, geographies редко меняются - зачем запрашивать каждый раз?

**Решение:**
```typescript
export function useSegments() {
  return useQuery({
    queryKey: ['segments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('segments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 минут
    cacheTime: 30 * 60 * 1000, // 30 минут в памяти
  });
}
```

**Правило:**
- **Справочники (segments, types):** `staleTime: 10-30 минут`
- **Пользовательские данные (brands, documents):** `staleTime: 1-5 минут`
- **Real-time данные (search runs):** `staleTime: 0` (всегда fresh)

---

### 4. Data Transformation Pattern: Raw → Normalized → Canonical

#### Проблема
Дублирование данных в разных таблицах (raw_documents, processed_documents, etc.)

#### Решение: Three layers in ONE table

**Таблица `documents` с тремя слоями:**

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,

  -- RAW LAYER (exactly as received from API)
  source_url TEXT,                    -- Original URL
  title TEXT,                         -- Raw title from source
  content_html TEXT,                  -- Raw HTML

  -- NORMALIZED LAYER (cleaned for processing)
  content_text TEXT,                  -- Extracted plain text
  content_length INTEGER,             -- Character count
  embedding VECTOR(1536),             -- AI embedding

  -- CANONICAL LAYER (AI-classified, deduplicated)
  is_duplicate BOOLEAN DEFAULT FALSE, -- Soft delete duplicates
  duplicate_of_id UUID,               -- Link to original
  criticality_score INTEGER,          -- 1-5 importance

  -- LINKING (many-to-many via junction tables)
  -- → document_segments
  -- → document_brands
  -- → document_event_types
);
```

**Преимущества:**
- ✅ Одна таблица вместо 3-4
- ✅ Сохранён raw data для аудита
- ✅ Оптимизированная normalized версия для AI
- ✅ Canonical layer с бизнес-логикой
- ✅ Soft delete через `is_duplicate` flag

**Правило:** Не создавай отдельные таблицы для каждого этапа обработки - используй колонки в одной таблице.

---

### 5. Cost Optimization: One LLM Call Per Document

#### Проблема
Отдельные LLM вызовы для каждой классификации:
- Call 1: Определить segment
- Call 2: Определить brands
- Call 3: Определить event_types
- Call 4: Определить geographies

**Cost:** 4 × $0.01 = **$0.04 per document**

#### Решение: Combined Prompt

```typescript
const prompt = `
Classify this document:

Title: ${document.title}
Content: ${document.content_text}

Return JSON:
{
  "segments": ["RAC", "VRF"],
  "brands": ["Daikin", "Midea"],
  "event_types": ["NEW_PRODUCT", "PRICING"],
  "geographies": ["MOSCOW", "RUSSIA"]
}
`;

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
  response_format: { type: 'json_object' }
});

const classification = JSON.parse(response.choices[0].message.content);
// Одним вызовом получили ВСЁ
```

**Cost:** 1 × $0.01 = **$0.01 per document** (экономия 75%!)

**Правило:** Объединяй связанные LLM задачи в один вызов с JSON response format.

---

### 6. Flexible Event Mapping: 0-N Events Per Document

#### Проблема
1 документ может содержать:
- 0 событий (нерелевантный документ)
- 1 событие (новость о запуске продукта)
- N событий (отчет за квартал с несколькими событиями)

**НЕПРАВИЛЬНО (1-to-1):**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  event_type VARCHAR  -- ❌ Только 1 событие!
);
```

#### Решение (0-to-many)

**Документ:**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  -- NO event fields here
);
```

**События (отдельная таблица):**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),  -- Many events → 1 document
  event_type VARCHAR,
  event_date DATE,
  description TEXT
);
```

**Преимущества:**
- ✅ 0 событий: документ существует, events.count = 0
- ✅ 1 событие: нормальный случай
- ✅ N событий: каждое событие = отдельная строка

**Правило:** Используй отдельную таблицу для events даже если "обычно 1 событие" - гибкость важнее простоты.

---

### 7. Pagination Defaults

**Best practices для списков:**

```typescript
// Backend Edge Function
const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
const offset = parseInt(url.searchParams.get('offset') || '0');

// Brands, Sources, Documents
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// Search results
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
```

**Правило:**
- **Admin списки (brands, sources):** 50 per page (balance между UX и performance)
- **Search results:** 20 per page (более детальный просмотр)
- **ВСЕГДА:** MAX_LIMIT cap для защиты от перегрузки

---

## 🎯 Best Practices

### 1. Читай файлы в правильном порядке

**При старте новой сессии:**
1. ✅ `LESSONS_LEARNED.md` (этот файл) - ПЕРВЫМ!
2. ✅ `DEVELOPMENT_STATUS.md` - текущий статус
3. ✅ `SESSION_CHECKPOINT_YYYY-MM-DD.md` - последняя сессия
4. ✅ `TODO.md` - список задач

**При работе с конкретной функцией:**
1. ✅ Прочитай migration файлы (понять схему БД)
2. ✅ Прочитай types.ts (понять интерфейсы)
3. ✅ Прочитай index.ts (основной код)

### 2. Логирование

**ВСЕГДА добавляй подробные логи:**
```typescript
console.log('🚀 Starting operation:', { param1, param2 });
console.log('✅ Success:', result);
console.error('❌ Error:', error);
console.log('📊 Stats:', { count, duration });
```

**Эмодзи помогают фильтровать логи:**
- 🚀 Start
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 📊 Stats
- 🔍 Debug

### 3. Error Handling

**BAD:**
```typescript
try {
  const data = await fetch(...);
  return data;
} catch (error) {
  console.error(error);  // ❌ Недостаточно информации
  return null;
}
```

**GOOD:**
```typescript
try {
  console.log('🔍 Fetching data from:', url);
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Fetch failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      url
    });
    throw new Error(`Fetch failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Data fetched successfully:', { items: data.length });
  return data;
} catch (error) {
  console.error('❌ Unexpected error:', {
    message: error.message,
    stack: error.stack,
    url
  });
  throw error;  // Re-throw для upstream handling
}
```

### 4. Временные решения

**Помечай временный код:**
```typescript
// TEMPORARY: Limit to 1 segment to avoid Gateway timeout (MVP testing)
// TODO: Remove this limit after implementing async job queue
if (segments.length > 1) {
  segments = segments.slice(0, 1);
}
```

**Создавай GitHub issues для TODO:**
```typescript
// TODO(#123): Implement async job queue for processing all segments
// See: https://github.com/user/repo/issues/123
```

---

## 🚫 НЕ делай этого

### ❌ Не меняй работающий код без причины

Если Source Hunter работает - НЕ рефакторь его "для красоты".

### ❌ Не удаляй debug код до production

Debug функции и временные логи сохраняй до стабилизации.

### ❌ Не делай git commit с секретами

`.env` файлы ВСЕГДА в `.gitignore`!

### ❌ Не используй `any` в TypeScript

Строгая типизация - обязательна. NO `any`, NO `unknown`, NO `as any`.

### ❌ Не предполагай - проверяй

- Не предполагай что колонка существует - проверь схему
- Не предполагай что код lowercase - используй UPPER()
- Не предполагай что миграция применена - проверь в БД

---

## 📖 Дополнительные ресурсы

### Документация
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **PostgREST API:** https://postgrest.org/en/stable/api.html
- **Perplexity AI:** https://docs.perplexity.ai/
- **OpenAI API:** https://platform.openai.com/docs/api-reference

### Полезные файлы проекта
- `AI_AGENTS_ARCHITECTURE_V3.md` - архитектура Scope-Aware V2
- `ROADMAP.md` - долгосрочный план
- `docs/architecture.md` - полная архитектура приложения

---

## 🆘 Когда застрял

1. **Прочитай логи в Supabase Dashboard** - 80% проблем видны там
2. **Создай debug функцию** - быстрее чем гадать
3. **Проверь case sensitivity** - UPPERCASE vs lowercase
4. **Проверь типы в TypeScript** - совпадают ли с БД?
5. **Прочитай этот файл еще раз** - возможно пропустил решение

---

**Последнее обновление:** 2025-12-30
**Автор:** Claude Code Sessions 2025-12-29, 2025-12-30
**Статус:** ✅ Проверено на практике (10 типичных проблем + решения)
