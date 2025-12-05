# Supabase Edge Functions

Edge Functions для MarketMonitor - AI-powered мониторинг климатического рынка России.

## 📋 Доступные функции

### 1. `ai-search` - AI поиск новостей

**Назначение:** Автоматический поиск новостей климатического рынка через OpenAI API.

**Endpoint:**
```
POST https://your-project.supabase.co/functions/v1/ai-search
```

**Параметры (опционально):**
```json
{
  "days": 7,
  "segments": ["кондиционеры", "вентиляция"],
  "event_types": ["акция", "цены"]
}
```

**Ответ:**
```json
{
  "search_run_id": "uuid",
  "status": "completed",
  "events_found": 12,
  "events": [...],
  "execution_time_seconds": 15
}
```

## 🚀 Deployment

### 1. Установить Supabase CLI

```bash
npm install -g supabase
```

### 2. Login в Supabase

```bash
supabase login
```

### 3. Link проект

```bash
supabase link --project-ref your-project-ref
```

### 4. Установить секреты

```bash
# OpenAI API Key (обязательно!)
supabase secrets set OPENAI_API_KEY=sk-your-key-here
```

### 5. Deploy функцию

```bash
# Deploy одну функцию
supabase functions deploy ai-search

# Или все функции
supabase functions deploy
```

### 6. Проверить логи

```bash
supabase functions logs ai-search
```

## 🧪 Локальное тестирование

```bash
# Запустить функцию локально
supabase functions serve ai-search

# В другом терминале - вызвать функцию
curl -i --location --request POST 'http://localhost:54321/functions/v1/ai-search' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"days": 7}'
```

## 🔐 Environment Variables

Все Edge Functions имеют доступ к:

**Автоматически (Supabase):**
- `SUPABASE_URL` - URL проекта
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key для admin доступа

**Нужно установить вручную:**
- `OPENAI_API_KEY` - OpenAI API key для поиска новостей

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

## 📊 Архитектура

```
functions/
├── _shared/               # Общий код для всех функций
│   ├── types.ts          # TypeScript типы
│   └── supabaseClient.ts # Supabase клиент
│
├── ai-search/            # AI поиск новостей
│   ├── index.ts
│   └── deno.json
│
└── import_map.json       # Deno import map
```

## 🔍 Логирование

Все Edge Functions пишут логи в Supabase Dashboard:

1. Зайти в Dashboard → Functions → Logs
2. Выбрать функцию
3. Смотреть real-time логи

## ⚠️ Ограничения

- **Timeout:** 150 секунд
- **Memory:** 150 MB
- **Cold start:** ~1-3 секунды
- **Concurrency:** 100 одновременных запросов

## 📚 Документация

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy Docs](https://deno.com/deploy/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)

## 🐛 Troubleshooting

### Проблема: "OPENAI_API_KEY is not set"

**Решение:**
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase functions deploy ai-search
```

### Проблема: "Failed to parse JSON"

**Причина:** OpenAI вернул невалидный JSON

**Решение:**
- Проверить логи: `supabase functions logs ai-search`
- Убедиться что промпт требует чистый JSON (без markdown)

### Проблема: "Failed to save events"

**Причина:** RLS политики блокируют запись

**Решение:**
- Edge Function использует service_role_key (обходит RLS)
- Проверить что миграции применены: `supabase db pull`

## 🔄 CI/CD

Для автоматического деплоя при push в GitHub:

```yaml
# .github/workflows/deploy-functions.yml
name: Deploy Edge Functions

on:
  push:
    branches:
      - main
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

**Создано:** 2024-12-04
**Проект:** MarketMonitor v0.3.0
**AI Provider:** OpenAI (GPT-4o)
