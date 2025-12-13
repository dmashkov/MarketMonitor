# Content Fetcher Agent

**Phase 4 - Part 2/5**

Загрузка и парсинг контента с URLs, найденных Source Hunter агентом.

## 🎯 Назначение

Content Fetcher Agent выполняет следующие задачи:

1. **Загрузка контента** - HTTP запросы к найденным URLs с retry логикой
2. **Парсинг контента** - Извлечение текста из различных форматов:
   - HTML / Веб-страницы
   - PDF (базовый парсинг)
   - DOCX (Word документы)
   - PPTX (Презентации)
   - Текстовые файлы
3. **Сохранение контента** - Запись контента в `documents.content_text`
4. **Обновление метаданных** - Сохранение `fetched_at`, `content_length`
5. **Обработка ошибок** - Graceful handling 404, 403, таймаутов, etc.

## 🏗️ Архитектура

```
Source Hunter      Content Fetcher      Document Processor
    ↓                   ↓                        ↓
[Find URLs] → [Fetch & Parse] → [Extract Mentions, Embeddings]
```

### Входные данные (от Source Hunter)

```json
{
  "document_id": "uuid-of-document",
  "url": "https://example.com/news",
  "document_type": "webpage"
}
```

### Выходные данные

```json
{
  "status": "success",
  "document_id": "uuid-of-document",
  "content_length": 15234,
  "message": "Fetched and stored 15234 characters"
}
```

## 🔄 Процесс обработки

### Шаг 1: Fetch Content
- HTTP запрос к URL с User-Agent
- Таймаут: 15 секунд
- Retry логика: до 3 попыток с exponential backoff
- Обработка редиректов (автоматически через fetch API)

### Шаг 2: Validate Response
- Проверка HTTP статуса (200 OK)
- Проверка Content-Type
- Обработка ошибок (404, 403, 500, etc.)

### Шаг 3: Parse Content
- **HTML/Webpage**: Удаление тегов, скриптов, стилей
- **PDF**: Текстовый экстрактор (базовый)
- **DOCX**: XML парсер (ищет `<t>` теги)
- **PPTX**: XML парсер (ищет `<a:t>` теги)
- Нормализация пробелов и новых строк
- Ограничение размера: 50,000 символов

### Шаг 4: Update Document
- INSERT в `documents.content_text`
- UPDATE `fetched_at` = NOW()
- UPDATE `content_length` = LENGTH(content)

### Шаг 5: Return Response
- Успешный ответ с `content_length`
- Или ошибка с описанием

## 📋 API Документация

### Endpoint

```
POST http://localhost:54321/functions/v1/agents/content-fetcher
```

### Request

```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://haier.ru/news/2025/01/new-ac",
    "document_type": "webpage"
  }'
```

### Response Success (200 OK)

```json
{
  "status": "success",
  "document_id": "123e4567-e89b-12d3-a456-426614174000",
  "content_length": 15234,
  "message": "Fetched and stored 15234 characters"
}
```

### Response Error (400/500)

```json
{
  "status": "error",
  "document_id": "123e4567-e89b-12d3-a456-426614174000",
  "content_length": 0,
  "error": "HTTP 404: Not Found"
}
```

## 🛡️ CORS Headers

Все ответы содержат:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

Обработка OPTIONS preflight запросов.

## 🔧 Environment Variables

Требуются следующие переменные (устанавливаются Supabase автоматически):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📊 Performance Metrics

| Метрика | Значение | Примечание |
|---------|---------|-----------|
| Timeout per request | 15 sec | Для больших файлов |
| Max content size | 50 KB | Текстовый контент |
| Retry attempts | 3 | с exponential backoff |
| Supported formats | 5 | HTML, PDF, DOCX, PPTX, TXT |

## 🧪 Testing

### Test 1: Fetch HTML content

```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-001",
    "url": "https://www.example.com",
    "document_type": "webpage"
  }'
```

**Ожидается:** Status 200, content_length > 0

### Test 2: Error - Invalid URL

```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-002",
    "url": "https://not-exist-domain-12345.com/page",
    "document_type": "webpage"
  }'
```

**Ожидается:** Status 400, error message с описанием

### Test 3: Error - Missing parameters

```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{"document_id": "test-003"}'
```

**Ожидается:** Status 400, "Missing required parameters"

### Test 4: CORS Preflight

```bash
curl -i -X OPTIONS http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

**Ожидается:** Status 200, CORS headers present

## 📚 Integration Points

### Входящие данные от

- **Source Hunter Agent** - Отправляет `document_id`, `url`, `document_type`
- **Orchestrator** - Запускает Content Fetcher для каждого найденного документа

### Выходящие данные для

- **Database** - Обновляет `documents.content_text`, `documents.fetched_at`
- **Document Processor Agent** - Использует загруженный контент для extraction

### Зависимости

```
Source Hunter Agent → Content Fetcher Agent → Document Processor Agent
```

## ⚡ Оптимизация

### Текущие оптимизации

1. **Streaming**: Используем fetch API для потокового чтения больших файлов
2. **Timeout**: 15 сек таймаут для больших файлов
3. **Retry**: Exponential backoff при failures
4. **Content limit**: Max 50KB текста для Document Processor

### Будущие оптимизации

1. **Parallel fetching** - Одновременная загрузка нескольких документов
2. **Better PDF parsing** - Интеграция с `pdf-parse` библиотекой
3. **Better DOCX/PPTX** - Интеграция с специализированными парсерами
4. **Language detection** - Определение языка контента (CLD3)
5. **Caching** - Кэширование уже загруженного контента

## 🚀 Следующий этап

После завершения Content Fetcher начинаем:

**Phase 4 - Part 3: Document Processor Agent**

- Генерация embeddings через OpenAI (text-embedding-3-small)
- Extraction упоминаний (бренды, сегменты, географии)
- Сохранение в pgvector для семантического поиска

## 📝 Примечания разработчика

### Почему парсинг базовый?

Content Fetcher использует базовый парсинг для быстроты MVP. Для production нужны:

1. **PDF**: `pdf-parse` или `pdfjs-dist`
2. **DOCX**: `docx` или `mammoth`
3. **PPTX**: `pptx-extract` или `unzipper + xml2js`

### Почему 50KB лимит?

Больший контент замедлит:
1. Document Processor (embeddings)
2. Event Extractor (токены OpenAI)
3. Storage в БД

### Security

- User-Agent спуфинг для совместимости
- Таймауты против DDoS-подобных URL
- Content size limits против memory exhaustion
- No execution of JavaScript

---

**Version:** 0.1.0
**Created:** 2025-12-13
**Status:** Phase 4 - Part 2 Implementation
