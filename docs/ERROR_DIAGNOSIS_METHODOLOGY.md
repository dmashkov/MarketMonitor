# 🔬 Методология диагностики ошибок в Multi-Agent Pipeline

**Систематический подход к поиску и исправлению проблем**

---

## 📊 Диаграмма уровней системы

```
┌─────────────────────────────────────────────────────────────────┐
│ Level 1: Frontend (React + Supabase SDK)                        │
│ └─ Вызывает /functions/v1/search-orchestrator                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Level 2: Orchestrator (search-orchestrator function)            │
│ └─ Вызывает search-orchestrator                                 │
│ └─ Координирует: source-hunter → content-fetcher → processor    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Level 3: Agents (Edge Functions)                                │
│ ├─ source-hunter (поиск источников)                             │
│ ├─ content-fetcher (загрузка контента)                          │
│ └─ document-processor (обработка)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Level 4: Database (PostgreSQL + RLS)                            │
│ ├─ sources, documents, search_runs, etc.                        │
│ └─ Row Level Security policies                                  │
└─────────────────────────────────────────────────────────────────┘

Ошибки могут быть на ЛЮБОМ уровне!
```

---

## 🎯 Алгоритм диагностики по уровням

### Уровень 1: Frontend Issue?

**Симптомы:**
```
• Frontend не может вызвать функцию
• CORS ошибка
• 401/403 auth ошибка
• Request не отправляется вообще
```

**Диагностика:**
```bash
# 1. Проверь что функция URL правильная
const functionUrl = `${supabaseUrl}/functions/v1/search-orchestrator`;
console.log('Calling:', functionUrl);

# 2. Проверь auth token
const { data: session } = await supabase.auth.getSession();
console.log('Has session:', !!session);

# 3. Проверь CORS headers в функции
// В index.ts Edge Function должны быть:
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '...',
};

# 4. Вызови функцию напрямую (минуя frontend)
curl -X POST https://project.supabase.co/functions/v1/search-orchestrator \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"monitoring_profile_id":"test"}'

# Если curl работает но frontend не работает → frontend issue
# Если curl не работает → issue на Level 2/3
```

---

### Уровень 2: Orchestrator Issue?

**Симптомы:**
```
• 404 при вызове функции
• 500 Internal Server Error
• Неправильный формат ответа
• Функция существует но не отвечает
```

**Диагностика:**

#### 2.1 Функция развернута?
```bash
npx supabase functions list
# Результат должен содержать search-orchestrator

# Проверь версию и время обновления
npx supabase functions list | grep search-orchestrator
# Должно быть: search-orchestrator | ACTIVE | VERSION > 0 | UPDATED_AT свежий
```

#### 2.2 Новый код запущен?
```bash
# Добавь явный маркер версии в начало функции:
console.log('🚀 Search Orchestrator v8 started');

# Развертни и вызови:
curl -X POST https://.../functions/v1/search-orchestrator \
  -H "apikey: $ANON_KEY" \
  -d '{"monitoring_profile_id":"test"}'

# Проверь в Dashboard → Functions → Logs
# Видишь ли ты новый маркер "v8"?

# ❌ Если НЕ видишь новый маркер:
#    Причина: дублирование функции
#    Решение: найти и удалить дублирующуюся версию
#    find supabase/functions -type d -name search-orchestrator
#    Должно быть ОДНО совпадение

# ✅ Если видишь новый маркер:
#    Функция развернута правильно, issue дальше
```

#### 2.3 Правильное логирование?
```typescript
// ✅ ПРАВИЛЬНО: явно логируй все попытки вызова
console.log('🔍 Calling Source Hunter:', {
  url: functionUrl,
  hasAuthHeader: !!authHeader,
  documentCount: documentIds?.length,
});

const response = await fetch(functionUrl, { ... });

console.log('📡 Source Hunter response:', {
  status: response.status,
  statusText: response.statusText,
  size: response.size,
});

if (!response.ok) {
  const error = await response.text();
  console.error('❌ Source Hunter failed:', response.status, error);
  throw new Error(`Source Hunter failed: ${response.status}`);
}

// ❌ НЕПРАВИЛЬНО: молчаливый отказ
const response = await fetch(functionUrl, { ... });
if (!response.ok) {
  // Никаких логов!
  return { status: 'error' };
}
```

---

### Уровень 3: Agent Function Issue?

**Симптомы:**
```
• Функция вызывается но возвращает неправильный результат
• Функция очень медленная
• Функция выбрасывает исключение
• Неправильный формат ответа
```

**Диагностика:**

#### 3.1 Функция реально вызвана?
```bash
# Вызови функцию напрямую (не через orchestrator)
curl -X POST https://.../functions/v1/source-hunter \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test query","segment_ids":["id1"]}'

# Проверь:
# 1. Есть ли логи в Dashboard → Functions → Logs?
# 2. Какой status код? (200, 400, 500)
# 3. Какой body ответа?
```

#### 3.2 Параметры правильные?
```typescript
// Функция ожидает параметры из types.ts
// Проверь types.ts что там написано

export interface SourceHunterRequest {
  prompt: string;                    // REQUIRED
  segment_ids?: string[];            // OPTIONAL
  geography_ids?: string[];          // OPTIONAL
  monitoring_profile_id?: string;    // OPTIONAL
}

// При вызове из orchestrator:
const body = JSON.stringify({
  prompt: promptTemplate.template_text,
  segment_ids: profile.segment_ids,
  geography_ids: profile.geography_ids,
  monitoring_profile_id: profile.id,
});

// Логируй что отправляешь:
console.log('📤 Sending to source-hunter:', body);
```

#### 3.3 Логирование в функции?
```typescript
// ОБЯЗАТЕЛЬНО логируй структурно:

async function handler(request: Request) {
  console.log('='.repeat(80));
  console.log('🚀 source-hunter v3 started');
  console.log('📌 Environment:', Deno.env.get('DENO_ENV'));
  console.log('='.repeat(80));

  try {
    const body = await request.json();
    console.log('📥 Request received:', {
      prompt: body.prompt?.substring(0, 50),
      segment_ids: body.segment_ids?.length,
      geography_ids: body.geography_ids?.length,
    });

    // Шаг 1
    console.log('Step 1/3: Loading sources...');
    const sources = await getSearchSources(body.segment_ids, body.geography_ids);
    console.log('✅ Found sources:', sources.length);

    // Шаг 2
    console.log('Step 2/3: Generating queries...');
    const queries = await generateSearchQueries(body.prompt, sources);
    console.log('✅ Generated queries:', queries.size);

    // Шаг 3
    console.log('Step 3/3: Searching and saving...');
    let created = 0;
    for (const source of sources) {
      const results = await searchDocuments(queries.get(source.id), source);
      for (const result of results) {
        const docId = await saveDocument(result.title, result.url, source.id);
        if (docId) created++;
      }
    }
    console.log('✅ Documents created:', created);

    console.log('🎉 Success');
    return successResponse({ documents_created: created });
  } catch (error) {
    console.error('❌ Error:', error);
    return errorResponse(error);
  }
}
```

#### 3.4 Быстро ли работает?
```bash
# Логируй время операций:
console.time('fetch-content');
const response = await fetch(url);
console.timeEnd('fetch-content');
// Результат: fetch-content: 1234ms

# Если медленно:
# • Может быть что-то с network (retry, backoff)
# • Может быть много requests (параллелизм)
# • Может быть блокировка на БД

# Решение:
const promises = urls.map(url => fetch(url)); // Параллель
const results = await Promise.all(promises);
```

---

### Уровень 4: Database Issue?

**Симптомы:**
```
• Таблица пуста []
• "column does not exist" ошибка
• RLS блокирует доступ
• Данные не сохраняются
• Очень медленно читать/писать
```

**Диагностика:**

#### 4.1 Таблица существует?
```bash
# Supabase Dashboard → SQL Editor

SELECT * FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'sources';

# Результат: должна быть одна строка
```

#### 4.2 Данные есть в таблице?
```bash
SELECT COUNT(*) FROM sources;
# Результат: > 0

SELECT * FROM sources LIMIT 1;
# Посмотри структуру и значения
```

#### 4.3 Все колонки правильные?
```bash
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sources'
ORDER BY ordinal_position;

# Проверь:
# ✅ id           | uuid          | NO
# ✅ name         | character varying | NO
# ✅ source_type_id | uuid        | NO
# ✅ website_url  | text          | YES
# ✅ telegram_channel | character varying | YES
# ✅ priority     | integer       | NO
# ✅ is_active    | boolean       | YES

# Если другие имена → обновить код
```

#### 4.4 RLS позволяет доступ?
```bash
# Проверить все политики на таблице
SELECT polname, poltype, poldefine FROM pg_policy
WHERE polrelid = 'sources'::regclass;

# Нужна политика типа SELECT с USING (true) для публичного доступа
# Если видишь USING (auth.role() = 'authenticated')
#  → создать/обновить политику

# Минимальный fix:
DROP POLICY IF EXISTS "Sources viewable by authenticated users" ON sources;
CREATE POLICY "Sources viewable by all"
  ON sources FOR SELECT
  USING (true);
```

#### 4.5 Вставка работает?
```bash
# Прямой тест вставки
INSERT INTO sources (name, source_type_id, priority)
VALUES ('Test Source', 'd36b3d6c-34a5-435c-b5b4-dc036ff50b04', 5)
RETURNING *;

# Если успех → INSERT работает
# Если ошибка → есть проблема с constraint или trigger

# Проверить constraints:
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'sources';
```

---

## 🧪 Пошаговые тесты для каждого уровня

### Тест Уровня 1: Frontend может вызвать функцию?

```typescript
// В frontend коде:
const testPipelineCall = async () => {
  try {
    console.log('1️⃣ Testing frontend → orchestrator call');

    const { data, error } = await supabase.functions.invoke(
      'search-orchestrator',
      {
        body: {
          monitoring_profile_id: 'e136307c-2630-4281-a7b2-739f3ebade3b',
        },
      }
    );

    if (error) {
      console.error('❌ Frontend error:', error);
      return;
    }

    console.log('✅ Frontend call successful:', data);
  } catch (error) {
    console.error('❌ Exception:', error);
  }
};
```

### Тест Уровня 2: Orchestrator работает?

```bash
# Bash script
#!/bin/bash

echo "2️⃣ Testing orchestrator function"

RESULT=$(curl -s -X POST \
  https://your-project.supabase.co/functions/v1/search-orchestrator \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"monitoring_profile_id":"e136307c-2630-4281-a7b2-739f3ebade3b"}')

echo "Response:"
echo $RESULT | jq .

# Проверить наличие:
if echo $RESULT | jq -e '.status' > /dev/null; then
  echo "✅ Orchestrator returned valid JSON"
else
  echo "❌ Invalid response from orchestrator"
fi
```

### Тест Уровня 3: Агент может работать независимо?

```bash
# Тест source-hunter независимо
curl -X POST https://.../functions/v1/source-hunter \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test query",
    "segment_ids": ["segment-id"],
    "geography_ids": ["geography-id"]
  }' | jq .

# Результат должен быть:
# {
#   "status": "success",
#   "documents_created": N,
#   "document_ids": [...],
#   "urls": [...]
# }
```

### Тест Уровня 4: БД доступна и правильная?

```bash
# Быстрый тест доступа к таблице
curl -H "apikey: $ANON_KEY" \
  'https://your-project.supabase.co/rest/v1/sources?limit=1' \
  | jq '.[] | {id, name, source_type_id, website_url}'

# Результат: данные из таблицы или [] если пусто

# Проверить что видишь:
# {
#   "id": "uuid",
#   "name": "Русклимат",
#   "source_type_id": "uuid",
#   "website_url": "https://rusclimate.ru"
# }
```

---

## 🎯 Дерево решений: Где ошибка?

```
                    Pipeline не работает
                           |
                           v
                    Какой статус код?
                 /          |          \
               /            |            \
              /             |             \
            404            400           500/timeout
            |               |               |
            |               |               |
    Функция не      Неправильные    Ошибка в коде
    найдена         параметры       функции
            |               |               |
            v               v               v
    1. URL путь?    1. Посмотри      1. Логи в
    2. Развернута?     types.ts         Dashboard
    3. Нет дублей?  2. Проверь      2. Какой шаг
                       что отправляешь  сломался?
                    3. Форм        3. Повтори
                       проверка      шаг отдельно
                                  4. Fix → redeploy
```

---

## 📋 Быстрая справка: Что проверить в первых 5 минут

```
□ Функция развернута?
  npx supabase functions list | grep <name>

□ Новый код запущен?
  curl .../functions/v1/<name> -d '...'
  # Смотри в Logs → видишь новые эмодзи логи?

□ URL правильный?
  # /functions/v1/{NAME} - правильно
  # /functions/v1/agents/{NAME} - неправильно

□ RLS не блокирует?
  curl -H "apikey: $ANON_KEY" .../rest/v1/table?limit=1
  # [] - возможно RLS
  # [data] - OK

□ Типы данных совпадают?
  # SELECT * FROM table;
  # Проверь что column names в коде совпадают

□ Параметры правильные?
  # Посмотри types.ts функции
  # Что ожидает на вход?
```

---

## 🚨 Типичные паттерны ошибок

| Ошибка | Причина | Решение |
|--------|---------|---------|
| 404 Not Found | Неправильный URL или дублирование | Проверить URL, find дублей |
| 400 Bad Request | Неправильный формат данных | Посмотри types.ts, check JSON |
| 500 Server Error | Ошибка в коде | Смотри логи, добавь console.log |
| `[]` Пусто | RLS блокирует или нет данных | CREATE POLICY ... USING (true) |
| Медленно | Много операций или network lag | Promise.all, optimize |
| Timeout | Функция работает > 10 минут | Оптимизировать или батчить |

---

**Версия:** 1.0.0
**Дата:** 2025-12-14
