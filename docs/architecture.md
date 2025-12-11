# Архитектура приложения MarketMonitor

**Версия:** 2.0 (AI Agents Architecture)
**Дата обновления:** 2024-12-11
**Статус:** Phase 3 In Progress - Multi-Agent System

---

## 📋 Содержание

1. [Обзор проекта](#1-обзор-проекта)
2. [Технологический стек](#2-технологический-стек)
3. [Ключевые принципы новой архитектуры](#3-ключевые-принципы-новой-архитектуры)
4. [Multi-Agent Pipeline](#4-multi-agent-pipeline)
5. [Структура базы данных](#5-структура-базы-данных)
6. [LLM Provider Management](#6-llm-provider-management)
7. [Архитектура приложения](#7-архитектура-приложения)
8. [Система авторизации и ролей](#8-система-авторизации-и-ролей)
9. [Ключевые функциональные модули](#9-ключевые-функциональные-модули)
10. [Интеграция с OpenAI API](#10-интеграция-с-openai-api)
11. [Supabase Storage](#11-supabase-storage)
12. [Типы отслеживаемых событий](#12-типы-отслеживаемых-событий)
13. [Структура проекта](#13-структура-проекта)
14. [Безопасность](#14-безопасность)
15. [Развертывание и CI/CD](#15-развертывание-и-cicd)

---

## 1. Обзор проекта

**Название:** MarketMonitor

**Цель:** AI-powered мониторинг климатического рынка России с накоплением истории и аналитикой.

### Основные характеристики

- **Сегменты:** RAC, VRF, Chiller, AHU, Промышленное оборудование, Тепловые насосы, Вентиляция, Холодильное оборудование
- **Каналы:** B2B, B2G, B2C
- **Целевая аудитория:** Руководители компаний, коммерческий департамент, продуктовые менеджеры, маркетологи
- **MVP Срок:** 6 недель (5 фаз)

### Ключевая функциональность

- ✅ Автоматический ежедневный сбор событий рынка через AI agents
- ✅ Полное сохранение исходных документов (PDF, PPTX, HTML) + embeddings
- ✅ Multi-agent pipeline для обработки данных
- ✅ Управление справочниками (бренды, источники, сегменты, география)
- ✅ RAG-based отчёты (daily/weekly/monthly) на основе накопленных данных
- ✅ Кастомные промпты для специализированных запросов
- ✅ Оценка критичности событий (1-5 уровней)
- ✅ Дубликат-детекция через embeddings
- ✅ Экспорт отчетов (Excel, CSV, PDF, DOCX)
- ✅ Ролевой контроль доступа (admin, user)

---

## 2. Технологический стек

### Frontend (Netlify Deploy)
- **React 18+** с **TypeScript (strict mode)** - основной фреймворк
  - ✅ Строгая типизация (NO `any`)
  - ✅ Все функции и переменные типизированы
  - ✅ Type guards для runtime проверок
- **Vite 5** - быстрый bundler (оптимизирован для SPA)
- **Ant Design** - компоненты UI
- **Zustand** - управление состоянием приложения (с полной типизацией)
- **TanStack Query (React Query)** - кэширование и синхронизация данных (типизированные hooks)
- **React Router 6** - маршруты (SPA routing)
- **Recharts** - интерактивные графики и диаграммы
- **Tailwind CSS** - утилиты для стилизации
- **zod** - валидация типов на runtime
- **react-hook-form** - управление формами
- **Хостинг:** Netlify (статический SPA)

### Backend & Database
- **Supabase** - полнофункциональный Backend-as-a-Service
  - **PostgreSQL** - реляционная БД для хранения всех данных
  - **pgvector** extension - векторный поиск для embeddings (1536 dimensions)
  - **Supabase Auth** - аутентификация и авторизация
  - **Row Level Security (RLS)** - безопасность на уровне БД
  - **Edge Functions (Deno)** - серверная логика без управления серверами
  - **Storage** - хранилище файлов (PDF, PPTX, DOCX, XLSX)
  - **Realtime** (опционально) - для live-обновлений

### AI Layer
- **OpenAI API** (основной провайдер в MVP)
  - **gpt-4o** - сложные задачи (event extraction, reports, scoring)
  - **gpt-4o-mini** - дешевые операции (mention extraction)
  - **text-embedding-3-small** - генерация embeddings (1536 dimensions)
- **UniversalLLMClient** - абстракция над провайдерами
  - MVP: только OpenAI
  - Будущее: Anthropic, Perplexity, Google
  - Конфигурация задач: `llm_task_configs`
  - Логирование использования: `llm_usage_logs`

### CI/CD & Автоматизация
- **GitHub Actions** - ежедневные запуски поиска по расписанию
- **Supabase Cron Jobs** (опционально) - альтернатива для планирования
- **Git** - управление версиями

---

## 3. Ключевые принципы новой архитектуры

### 🔄 Парадигмальный сдвиг

**БЫЛО (неправильно):**
- Daily/Weekly/Monthly промпты каждый раз ищут НОВЫЕ данные
- Нет накопления истории
- Повторения и дубликаты
- Невозможность анализа трендов

**СТАЛО (правильно):**
```
Daily Search (сбор) → Documents DB (хранение) → Reports (RAG-анализ)
```

### Принципы

#### 1. Разделение сбора и анализа
- **Daily Search** - ежедневный сбор первичных данных (новости, акции, цены)
- **Documents DB** - полное сохранение контента с embeddings
- **Reports** - анализ СУЩЕСТВУЮЩИХ данных из БД (weekly/monthly)
- **Custom Prompts** - ad-hoc запросы пользователей

#### 2. Полное сохранение контента
Сохраняем не только события, но и исходники:
- PDF документы → Supabase Storage
- Презентации (PPTX) → Supabase Storage
- HTML статьи → `content_html` в БД
- Извлечённый текст → `content_text` для FTS поиска
- **Embeddings** → `vector(1536)` для семантического поиска

**Зачем:**
- Повторный анализ в будущем
- Ссылки на источники для пользователей
- Возможность добавлять свои материалы (user uploads)
- RAG-based отчёты с цитированием источников

#### 3. Multi-agent система
Вместо одного большого промпта → несколько специализированных агентов (см. раздел 4)

#### 4. Управляемые справочники
Все справочники редактируются через админ-панель:
- Источники (`sources`)
- Бренды (`brands`) 🆕
- Сегменты (`segments`)
- География (`geographies`)
- Типы источников (`source_types`)

#### 5. Гибкие промпты
- Стандартные (daily, weekly, monthly)
- Кастомные (создаются пользователями через UI)
- С параметрами (brands, segments, geographies, event_types)

---

## 4. Multi-Agent Pipeline

### Обзор агентов

```
Orchestrator → Source Hunter → Content Fetcher → Document Processor →
→ Event Extractor → Criticality Scorer → Duplicate Detector → Alert Manager
```

**+ Report Generator** (отдельный контур для создания отчётов)

### 4.1 Orchestrator (Планировщик)

**Задача:** Управление расписанием и запуском всех агентов.

**Входные данные:**
- `job_schedules` - расписания запусков
- `ai_prompts` - промпты для выполнения

**Что делает:**
1. Проверяет расписания (cron expressions)
2. Создаёт записи в `search_runs`
3. Запускает агентов по порядку
4. Логирует статусы и ошибки

**Выходные данные:**
- Обновлённые `job_schedules` (last_run_at, next_run_at)
- Записи в `search_runs`

---

### 4.2 Agent 1: Source Hunter

**Задача:** Определить, ГДЕ искать информацию.

**Входные данные:**
- `segments` (например, RAC, VRF)
- `geographies` (Москва, СПб, Сибирский ФО)
- `search_depth` (daily / weekly / monthly)

**Что делает:**
1. Выбирает релевантные `sources` из БД (фильтр по segment, geography, frequency)
2. Формирует список `source_urls` для проверки
3. Возвращает приоритизированный список

**Выходные данные:**
```typescript
interface SourceHunterResult {
  sources: Source[];
  urls: SourceUrl[];
  priority_order: UUID[];
}
```

**Время:** ~2 сек
**Стоимость:** $0 (без LLM, только БД запросы)

---

### 4.3 Agent 2: Content Fetcher

**Задача:** Загрузить контент по URL.

**Входные данные:**
- Список `source_urls` от Source Hunter

**Что делает:**
1. Для каждого URL:
   - Если HTML страница → скачать HTML
   - Если PDF/PPTX → скачать файл
   - Если API endpoint → запросить данные
2. Обрабатывает ошибки (404, timeout)
3. Сохраняет сырой контент

**Выходные данные:**
```typescript
interface ContentFetcherResult {
  url: string;
  content_type: 'html' | 'pdf' | 'pptx' | 'api';
  raw_content: string | Buffer;
  file_size: number;
  fetch_status: 'success' | 'failed';
  error?: string;
}
```

**Время:** ~15 сек (зависит от количества URL)
**Стоимость:** $0 (без LLM)

---

### 4.4 Agent 3: Document Processor

**Задача:** Сохранить контент в БД + Storage, сгенерировать embeddings.

**Входные данные:**
- `ContentFetcherResult[]` от Content Fetcher

**Что делает:**
1. **Извлечение текста:**
   - HTML → текст (удаление тегов)
   - PDF → текст (библиотека pdf-parse)
   - PPTX → текст (библиотека pptx-parser)

2. **Сохранение файлов:**
   - Загружает PDF/PPTX/DOCX в **Supabase Storage** (`market-documents` bucket)
   - Структура: `pdfs/2024/12/{filename}.pdf`

3. **Генерация embeddings:**
   - Вызывает OpenAI `text-embedding-3-small`
   - Сохраняет vector(1536) в `documents.embedding`

4. **Извлечение упоминаний (mentions extraction):**
   - LLM (gpt-4o-mini) анализирует текст
   - Находит упоминания брендов → `brand_ids`
   - Находит упоминания сегментов → `segment_ids`
   - Находит упоминания географий → `geography_ids`

5. **Сохранение в `documents` таблицу:**
   ```typescript
   {
     title: string,
     content_text: string,
     content_html: string | null,
     file_url: string | null,
     embedding: number[], // 1536 dimensions
     brand_ids: UUID[],
     segment_ids: UUID[],
     geography_ids: UUID[],
     source_id: UUID,
     published_date: Date,
     document_type: 'article' | 'pdf' | 'presentation' | ...
   }
   ```

**Выходные данные:**
```typescript
interface DocumentProcessorResult {
  document_id: UUID;
  title: string;
  content_text: string;
  brand_ids: UUID[];
  segment_ids: UUID[];
  embedding_generated: boolean;
}
```

**Время:** ~30 сек (с embeddings)
**Стоимость:** ~$0.01-0.02 (embeddings + mention extraction)

---

### 4.5 Agent 4: Event Extractor

**Задача:** Превратить текст документа в структурированные события.

**Входные данные:**
- `DocumentProcessorResult[]` от Document Processor
- Текст документа (`content_text`)

**Что делает:**
1. Вызывает **OpenAI gpt-4o** с промптом:
   ```
   Извлеки все маркетинговые события из текста.
   Для каждого события верни JSON:
   {
     "date": "YYYY-MM-DD",
     "event_type": "promo" | "price" | "contract" | "partnership" | "pr" | "tender" | "regulation",
     "company": "Название компании",
     "description": "Полное описание",
     "channel": "B2B" | "B2C" | "B2G",
     "extracted_data": { ... } // дополнительные данные
   }
   ```

2. Парсит JSON ответ (типизированный!)
3. Сохраняет события в `events` таблицу с привязкой к `document_id`

**Выходные данные:**
```typescript
interface EventExtractorResult {
  events: MarketEvent[];
  total_extracted: number;
}
```

**Время:** ~40 сек (зависит от размера текста)
**Стоимость:** ~$0.05-0.10 (gpt-4o)

---

### 4.6 Agent 5: Embedding Generator

**Примечание:** В MVP интегрирован в **Agent 3: Document Processor**.

В будущем может быть отдельным агентом для:
- Batch обработки событий
- Переиндексации старых документов
- Экспериментов с разными моделями embeddings

---

### 4.7 Agent 6: Criticality Scorer

**Задача:** Оценить важность (критичность) событий по шкале 1-5.

**Входные данные:**
- `MarketEvent[]` от Event Extractor

**Что делает:**
1. Batch обработка ~10 событий за раз
2. Вызывает **OpenAI gpt-4o** с промптом:
   ```
   Оцени критичность каждого события по шкале 1-5:

   1 - Низкая (рутинные акции, мелкие обновления)
   2 - Ниже среднего (стандартные промо)
   3 - Средняя (значимые акции, обновления продуктов)
   4 - Высокая (крупные контракты, партнёрства)
   5 - Критическая (сделки на сотни млн, M&A, регулирование)

   Верни JSON:
   {
     "event_id": "UUID",
     "criticality_level": 1-5,
     "reasoning": "Почему такая оценка",
     "factors": ["factor1", "factor2"]
   }
   ```

3. Обновляет `events`:
   - `criticality_level`
   - `criticality_reasoning`
   - `criticality_factors`

**Выходные данные:**
```typescript
interface CriticalityScorerResult {
  event_id: UUID;
  criticality_level: 1 | 2 | 3 | 4 | 5;
  reasoning: string;
  factors: string[];
}
```

**Время:** ~10 сек
**Стоимость:** ~$0.02-0.03

**Критичные события (4-5):** Автоматически передаются в **Alert Manager**.

---

### 4.8 Agent 7: Duplicate Detector

**Задача:** Найти дубликаты событий.

**Входные данные:**
- Новые события от Event Extractor
- Существующие события из БД (за последние 30 дней)

**Что делает:**

**Метод 1: Ключевые поля (быстрый)**
```sql
SELECT * FROM events
WHERE date = $1
  AND company = $2
  AND event_type = $3
  AND detected_at > NOW() - INTERVAL '30 days';
```

**Метод 2: Embeddings (точный)**
1. Генерирует embedding для описания события
2. Векторный поиск похожих событий:
   ```sql
   SELECT id, description,
     1 - (embedding <=> $1::vector) as similarity
   FROM events
   WHERE 1 - (embedding <=> $1::vector) > 0.85
   ORDER BY embedding <=> $1::vector
   LIMIT 5;
   ```

3. Если similarity > 0.85 → дубликат

**Действия при обнаружении:**
- Отмечает событие как дубликат (`is_duplicate = true`)
- Связывает с оригиналом (`duplicate_of_id`)
- НЕ удаляет автоматически (admin может проверить)

**Выходные данные:**
```typescript
interface DuplicateDetectorResult {
  event_id: UUID;
  is_duplicate: boolean;
  duplicate_of_id?: UUID;
  similarity_score?: number;
}
```

**Время:** ~15 сек
**Стоимость:** ~$0.01 (embeddings)

---

### 4.9 Agent 8: Alert Manager

**Задача:** Уведомить пользователей о критичных событиях (criticality 4-5).

**Входные данные:**
- События с `criticality_level >= 4`

**Что делает:**
1. Создаёт записи в `alerts` таблице
2. Отправляет уведомления:
   - **In-app notifications** (приоритет в MVP)
   - **Email** (опционально)
   - **Telegram** (Phase 6+)

**Выходные данные:**
```typescript
interface AlertManagerResult {
  alert_id: UUID;
  event_id: UUID;
  sent_to: UUID[]; // user IDs
  channels: ('in-app' | 'email' | 'telegram')[];
}
```

**Время:** ~5 сек
**Стоимость:** $0 (без LLM)

---

### 4.10 Report Generator (отдельный контур)

**Задача:** Создать RAG-based отчёт на основе накопленных данных.

**Входные данные:**
- Период (date_from, date_to)
- Фильтры (brands, segments, geographies, event_types)
- Тип отчёта (daily-digest / weekly-analytics / monthly-summary)

**Что делает:**

**1. Retrieval (выборка данных):**
```sql
-- Классический фильтр
SELECT e.*, d.content_text, d.file_url
FROM events e
LEFT JOIN documents d ON e.document_id = d.id
WHERE e.date BETWEEN $date_from AND $date_to
  AND ($brand_ids IS NULL OR e.brand_id = ANY($brand_ids))
  AND ($segment_ids IS NULL OR e.segment_id = ANY($segment_ids))
  AND e.criticality_level >= $min_criticality
ORDER BY e.criticality_level DESC, e.date DESC
LIMIT 100;

-- + Семантический поиск (если нужно)
SELECT *, 1 - (embedding <=> $query_embedding::vector) as similarity
FROM documents
WHERE 1 - (embedding <=> $query_embedding::vector) > 0.7
ORDER BY similarity DESC
LIMIT 20;
```

**2. Augmentation (подготовка контекста для LLM):**
```typescript
const context = {
  period: { from: '2024-12-01', to: '2024-12-07' },
  events: events.map(e => ({
    date: e.date,
    company: e.company,
    description: e.description,
    criticality: e.criticality_level,
    type: e.event_type
  })),
  documents: documents.map(d => ({
    title: d.title,
    excerpt: d.content_text.substring(0, 500),
    url: d.source_url
  }))
};
```

**3. Generation (генерация отчёта через LLM):**
```typescript
const prompt = `
Создай отчёт за период ${period.from} - ${period.to}.

Контекст:
${JSON.stringify(context, null, 2)}

Структура отчёта:
1. Executive Summary (3-5 ключевых инсайтов)
2. Критичные события (criticality 4-5)
3. Анализ по компаниям
4. Анализ по сегментам
5. Тренды
6. Рекомендации

Формат: Markdown с таблицами.
`;

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 4096
});
```

**4. Сохранение:**
- Markdown контент в `reports.content_markdown`
- HTML версия в `reports.content_html`
- Генерация PDF/DOCX (опционально)
- Ссылки на файлы в Storage

**Выходные данные:**
```typescript
interface ReportGeneratorResult {
  report_id: UUID;
  title: string;
  content_markdown: string;
  events_count: number;
  documents_count: number;
  key_insights: string[];
  pdf_url?: string;
}
```

**Время:** ~60-90 сек
**Стоимость:** ~$0.20-0.40 (зависит от объёма данных)

---

## 5. Структура базы данных

### 5.1 Существующие таблицы (Phase 1-2)

#### `user_profiles`
Расширенная информация о пользователях и их ролях.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Ссылка на auth.users |
| email | TEXT | Email пользователя |
| full_name | TEXT | Полное имя |
| role | TEXT | 'admin' или 'user' |
| is_active | BOOLEAN | Активен ли аккаунт |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата последнего обновления |
| created_by | UUID (FK) | Кто создал пользователя |

#### `ai_prompts`
Библиотека промптов для различных типов поиска.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| name | TEXT | Название промпта (уникальное) |
| description | TEXT | Описание назначения и результатов |
| prompt_template | TEXT | Шаблон с переменными вида {variable_name} |
| search_type | TEXT | Категория поиска (marketing, pricing, regulations и т.д.) |
| is_active | BOOLEAN | Активен ли промпт |
| parameters | JSONB | Параметры по умолчанию (JSON схема) |
| segment_id | UUID (FK) | Ссылка на сегмент (опционально) |
| geography_id | UUID (FK) | Ссылка на географию (опционально) |
| search_depth | TEXT | 'daily' / 'weekly' / 'monthly' |
| created_by | UUID (FK) | Кто создал промпт |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата последнего обновления |

#### `search_runs`
История всех запусков поиска (ручных и автоматических).

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| prompt_id | UUID (FK) | Какой промпт был использован |
| status | TEXT | 'running' / 'completed' / 'failed' |
| events_found | INTEGER | Количество найденных событий |
| parameters_used | JSONB | Параметры, которые были использованы |
| error_message | TEXT | Описание ошибки (если failed) |
| triggered_by | UUID (FK) | Кто запустил (admin UID) |
| is_scheduled | BOOLEAN | Автоматический или ручной запуск |
| started_at | TIMESTAMP | Когда начал выполняться |
| completed_at | TIMESTAMP | Когда завершился |
| execution_time_seconds | INTEGER | Сколько секунд выполнялся |

#### `job_schedules`
Расписание автоматических запусков поиска.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| prompt_id | UUID (FK) | Какой промпт запускать |
| name | TEXT | Название расписания (описательное) |
| cron_expression | TEXT | Cron выражение (например: '0 9 * * *') |
| is_active | BOOLEAN | Активно ли расписание |
| parameters | JSONB | Параметры для подстановки в промпт |
| last_run_at | TIMESTAMP | Когда был последний запуск |
| next_run_at | TIMESTAMP | Когда будет следующий запуск |
| last_run_status | TEXT | Статус последнего запуска |
| created_by | UUID (FK) | Кто создал расписание |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата последнего обновления |

### 5.2 Таблицы справочников (Phase 3 - Migration 005-006)

#### `segments` - сегменты оборудования
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| code | TEXT | Код сегмента (RAC, VRF, CHILLER, AHU, INDUSTRIAL, HEAT_PUMP, VENTILATION, REFRIGERATION) |
| name | TEXT | Название на русском |
| description | TEXT | Описание сегмента |
| is_active | BOOLEAN | Активен ли |

**Seed данные:** 8 сегментов (RAC, VRF, Chiller, AHU, Промышленное, Тепловые насосы, Вентиляция, Холодильное)

#### `geographies` - географические зоны
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| name | TEXT | Название (Россия, Москва, Сибирский ФО) |
| type | TEXT | 'country' / 'federal_district' / 'city' |
| parent_id | UUID (FK) | Ссылка на родителя |
| is_active | BOOLEAN | Активен ли |

**Seed данные:** Страна (Россия) + 7 федеральных округов + 4 крупных города

#### `source_types` - типы источников
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| code | TEXT | Код типа (distributor, manufacturer, media, association, marketplace, government) |
| name | TEXT | Название на русском |
| description | TEXT | Описание |

**Seed данные:** 6 типов (Дистрибьютор, Производитель, СМИ, Ассоциация, Маркетплейс, Госорганы)

#### `sources` - источники для мониторинга
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| name | TEXT | Название источника |
| source_type_id | UUID (FK) | Тип источника |
| website_url | TEXT | URL сайта |
| telegram_channel | TEXT | Telegram канал (опционально) |
| description | TEXT | Описание |
| priority | INTEGER | Приоритет (1-5) |
| frequency | TEXT | Частота проверки (daily/weekly/monthly) |
| is_active | BOOLEAN | Активен ли |

**Seed данные:** 15 источников (Русклимат, Даичи, MIDEA, GREE, Forbes, Ведомости, АВОК, АПИК, etc.)

#### `source_urls` - конкретные URL для мониторинга
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| source_id | UUID (FK) | Ссылка на источник |
| url | TEXT | Полный URL |
| url_type | TEXT | Тип URL (news, products, blog, press-release, tenders) |
| description | TEXT | Описание |
| is_active | BOOLEAN | Активен ли |

### 5.3 Новые таблицы (Phase 3 - Migration 007)

#### `brands` - справочник брендов 🆕
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| name | TEXT | Название бренда (Daikin, Midea, Haier) |
| manufacturer | TEXT | Производитель (Daikin Industries, Midea Group) |
| country | TEXT | Страна (Япония, Китай, Россия) |
| category | TEXT | premium / middle / budget |
| is_active | BOOLEAN | Активен ли |
| logo_url | TEXT | Ссылка на логотип |
| website_url | TEXT | Официальный сайт |
| description | TEXT | Описание бренда |
| metadata | JSONB | { market_share: "15%", segments: [...] } |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |

**Seed данные:** Daikin, Mitsubishi Electric, Haier, Midea, TCL, Gree, Ballu, Centek, Lessar, Royal Clima, Electrolux, LG

#### `brand_segments` - связь брендов с сегментами (Many-to-Many) 🆕
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| brand_id | UUID (FK) | Ссылка на бренд |
| segment_id | UUID (FK) | Ссылка на сегмент |
| is_primary | BOOLEAN | Основной сегмент бренда |
| created_at | TIMESTAMP | Дата создания |

#### `documents` - хранилище контента 🆕
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| title | TEXT | Название документа |
| description | TEXT | Описание |
| document_type | TEXT | article / report / presentation / pdf / press-release / analytics / user-upload |
| content_text | TEXT | Извлечённый текст (для FTS поиска) |
| content_html | TEXT | HTML версия (если есть) |
| file_url | TEXT | Ссылка на файл в Supabase Storage |
| file_size | INTEGER | Размер в байтах |
| file_format | TEXT | pdf / docx / pptx / html |
| source_id | UUID (FK) | Источник документа |
| source_url | TEXT | URL источника |
| published_date | DATE | Дата публикации |
| detected_at | TIMESTAMP | Когда обнаружен |
| brand_ids | UUID[] | Массив брендов, упомянутых в документе |
| segment_ids | UUID[] | Массив сегментов |
| geography_ids | UUID[] | Массив географий |
| **embedding** | **VECTOR(1536)** | **Векторное представление для семантического поиска** |
| is_processed | BOOLEAN | Обработан ли |
| is_archived | BOOLEAN | Архивирован ли |
| processing_error | TEXT | Ошибка обработки (если есть) |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата обновления |
| created_by | UUID (FK) | Кто создал (для user-uploads) |

**Индексы:**
- FTS поиск: `to_tsvector('russian', content_text)`
- Векторный поиск: `ivfflat (embedding vector_cosine_ops)`
- GIN на arrays: `brand_ids`, `segment_ids`, `geography_ids`

#### `events` - обновления таблицы событий 🔄
**Новые поля:**
| Поле | Тип | Описание |
|------|-----|---------|
| brand_id | UUID (FK) | Основной бренд события (опционально) |
| document_id | UUID (FK) | Ссылка на исходный документ 🆕 |
| extracted_data | JSONB | Дополнительные извлечённые данные |
| additional_sources | TEXT[] | Массив дополнительных ссылок |
| criticality_reasoning | TEXT | Обоснование критичности 🆕 |
| criticality_factors | TEXT[] | Факторы критичности 🆕 |

**Дополнительная таблица:**
```sql
CREATE TABLE event_brands (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, brand_id)
);
```

#### `reports` - сохранённые отчёты 🆕
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| title | TEXT | Название отчёта |
| report_type | TEXT | daily-digest / weekly-analytics / monthly-summary / custom-query |
| date_from | DATE | Период от |
| date_to | DATE | Период до |
| filters | JSONB | { brands: [...], segments: [...], geographies: [...], event_types: [...] } |
| content_markdown | TEXT | Markdown контент |
| content_html | TEXT | HTML контент |
| events_count | INTEGER | Количество событий |
| documents_count | INTEGER | Количество документов |
| key_insights | TEXT[] | Массив ключевых инсайтов |
| status | TEXT | generating / completed / failed |
| error_message | TEXT | Ошибка (если failed) |
| pdf_url | TEXT | Ссылка на PDF в Storage |
| docx_url | TEXT | Ссылка на DOCX в Storage |
| excel_url | TEXT | Ссылка на Excel в Storage |
| generated_at | TIMESTAMP | Когда сгенерирован |
| created_by | UUID (FK) | Кто создал |

#### `custom_prompts` - кастомные запросы пользователей 🆕
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| user_id | UUID (FK) | Кто создал |
| prompt_text | TEXT | Текст промпта |
| brand_ids | UUID[] | Фильтр по брендам |
| segment_ids | UUID[] | Фильтр по сегментам |
| geography_ids | UUID[] | Фильтр по географии |
| event_types | TEXT[] | Фильтр по типам событий |
| date_from | DATE | Период от |
| date_to | DATE | Период до |
| result_type | TEXT | events / report / analysis |
| result_data | JSONB | Результат выполнения |
| status | TEXT | pending / running / completed / failed |
| error_message | TEXT | Ошибка (если failed) |
| is_saved | BOOLEAN | Сохранён для повторного использования |
| name | TEXT | Название сохранённого промпта |
| description | TEXT | Описание |
| created_at | TIMESTAMP | Дата создания |
| completed_at | TIMESTAMP | Дата завершения |

### 5.4 LLM Management (Phase 4+)

#### `llm_providers`
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| name | TEXT | openai / anthropic / perplexity / google |
| api_key_encrypted | TEXT | Зашифрованный API ключ |
| is_active | BOOLEAN | Активен ли |

#### `llm_models`
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| provider_id | UUID (FK) | Ссылка на провайдера |
| model_name | TEXT | gpt-4o / claude-sonnet-4-5 |
| cost_per_1k_input_tokens | DECIMAL | Стоимость input |
| cost_per_1k_output_tokens | DECIMAL | Стоимость output |

#### `llm_task_configs`
Конфигурация задач (какую модель использовать)
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| task_name | TEXT | event_extraction / criticality_scoring / report_generation / document_enrichment |
| preferred_model_id | UUID (FK) | Предпочитаемая модель |
| fallback_model_id | UUID (FK) | Резервная модель |

#### `llm_usage_logs`
Логирование использования LLM
| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный ID |
| model_id | UUID (FK) | Какая модель |
| task_name | TEXT | Задача |
| input_tokens | INTEGER | Токены input |
| output_tokens | INTEGER | Токены output |
| total_cost | DECIMAL | Стоимость |
| execution_time_ms | INTEGER | Время выполнения (мс) |
| created_at | TIMESTAMP | Дата |

---

## 6. LLM Provider Management

### Архитектура UniversalLLMClient

```typescript
// lib/llm/UniversalLLMClient.ts

interface LLMProvider {
  name: 'openai' | 'anthropic' | 'perplexity' | 'google';
  apiKey: string;
}

interface LLMTaskConfig {
  taskName: string;
  preferredModel: string;
  fallbackModel?: string;
  maxTokens: number;
  temperature: number;
}

class UniversalLLMClient {
  private providers: Map<string, LLMProvider>;
  private taskConfigs: Map<string, LLMTaskConfig>;

  async executeTask(
    taskName: string,
    prompt: string,
    options?: Partial<LLMTaskConfig>
  ): Promise<string> {
    const config = this.getTaskConfig(taskName);
    const provider = this.getProvider(config.preferredModel);

    try {
      return await this.callLLM(provider, config, prompt);
    } catch (error) {
      if (config.fallbackModel) {
        const fallbackProvider = this.getProvider(config.fallbackModel);
        return await this.callLLM(fallbackProvider, config, prompt);
      }
      throw error;
    }
  }

  private async callLLM(
    provider: LLMProvider,
    config: LLMTaskConfig,
    prompt: string
  ): Promise<string> {
    switch (provider.name) {
      case 'openai':
        return await this.callOpenAI(provider, config, prompt);
      case 'anthropic':
        return await this.callAnthropic(provider, config, prompt);
      // ... другие провайдеры
    }
  }

  private async callOpenAI(
    provider: LLMProvider,
    config: LLMTaskConfig,
    prompt: string
  ): Promise<string> {
    const client = new OpenAI({ apiKey: provider.apiKey });

    const response = await client.chat.completions.create({
      model: config.preferredModel, // gpt-4o, gpt-4o-mini
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens,
      temperature: config.temperature
    });

    // Логирование
    await this.logUsage({
      model: config.preferredModel,
      taskName: config.taskName,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalCost: this.calculateCost(response.usage)
    });

    return response.choices[0].message.content;
  }
}
```

### MVP конфигурация (только OpenAI)

```typescript
// lib/llm/config.ts

export const LLM_TASK_CONFIGS: Record<string, LLMTaskConfig> = {
  event_extraction: {
    taskName: 'event_extraction',
    preferredModel: 'gpt-4o',
    maxTokens: 2048,
    temperature: 0.3
  },
  criticality_scoring: {
    taskName: 'criticality_scoring',
    preferredModel: 'gpt-4o',
    maxTokens: 1024,
    temperature: 0.5
  },
  report_generation: {
    taskName: 'report_generation',
    preferredModel: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7
  },
  document_enrichment: {
    taskName: 'document_enrichment',
    preferredModel: 'gpt-4o-mini', // дешевле
    maxTokens: 512,
    temperature: 0.3
  },
  embeddings: {
    taskName: 'embeddings',
    preferredModel: 'text-embedding-3-small',
    maxTokens: 0,
    temperature: 0
  }
};
```

### Будущее расширение (Phase 4+)

```typescript
// Конфигурация с multi-provider
export const LLM_TASK_CONFIGS_MULTI: Record<string, LLMTaskConfig> = {
  event_extraction: {
    taskName: 'event_extraction',
    preferredModel: 'claude-sonnet-4-5', // Anthropic лучше для extraction
    fallbackModel: 'gpt-4o',
    maxTokens: 2048,
    temperature: 0.3
  },
  report_generation: {
    taskName: 'report_generation',
    preferredModel: 'gpt-4o', // OpenAI лучше для markdown
    fallbackModel: 'claude-sonnet-4-5',
    maxTokens: 4096,
    temperature: 0.7
  }
};
```

---

## 7. Архитектура приложения

### 7.1 Общая диаграмма слоев

```
┌──────────────────────────────────────────────┐
│        Frontend (Netlify)                     │
│  React + TypeScript + Ant Design             │
│                                              │
│  Public Pages:                               │
│  ├─ Login / Register                         │
│  └─ Password Reset                           │
│                                              │
│  User Pages:                                 │
│  ├─ Dashboard (аналитика, read-only)         │
│  ├─ Events List (таблица с фильтрами)        │
│  ├─ Documents Library (библиотека)           │
│  ├─ Reports (просмотр и экспорт)             │
│  ├─ Custom Prompts (конструктор запросов)    │
│  └─ Profile (личные данные)                  │
│                                              │
│  Admin Pages:                                │
│  ├─ User Management (управление юзерами)     │
│  ├─ Brands Management (управление брендами)  │
│  ├─ Sources Management (управление источниками)│
│  ├─ Prompts Library (CRUD промптов)          │
│  ├─ Job Scheduler (расписание)               │
│  ├─ Search Runner (ручной запуск)            │
│  ├─ Documents Upload (загрузка файлов)       │
│  └─ System Logs (логи выполнения)            │
└────────────┬─────────────────────────────────┘
    │ REST API
    │ JWT Auth
    │ RLS checks
    ↓
┌──────────────────────────────────────────────┐
│      Supabase (Cloud Backend)                │
│                                              │
│  PostgreSQL Database:                        │
│  ├─ user_profiles, events, ai_prompts        │
│  ├─ search_runs, job_schedules               │
│  ├─ sources, segments, geographies           │
│  ├─ brands, brand_segments 🆕                │
│  ├─ documents, reports 🆕                    │
│  ├─ custom_prompts 🆕                        │
│  └─ llm_models, llm_usage_logs               │
│                                              │
│  Extensions:                                 │
│  ├─ uuid-ossp (UUID generation)              │
│  └─ vector (pgvector для embeddings) 🆕      │
│                                              │
│  Storage:                                    │
│  └─ market-documents bucket 🆕               │
│      ├─ pdfs/2024/12/                        │
│      ├─ presentations/2024/12/               │
│      └─ user-uploads/{user_id}/              │
│                                              │
│  Authentication & Security:                 │
│  ├─ Supabase Auth (JWT)                      │
│  └─ Row Level Security (RLS)                 │
│                                              │
│  Edge Functions (TypeScript):                │
│  ├─ ai-agents/                               │
│  │   ├─ orchestrator                         │
│  │   ├─ source-hunter                        │
│  │   ├─ content-fetcher                      │
│  │   ├─ document-processor                   │
│  │   ├─ event-extractor                      │
│  │   ├─ criticality-scorer                   │
│  │   ├─ duplicate-detector                   │
│  │   └─ alert-manager                        │
│  ├─ brands-api (CRUD брендов)                │
│  ├─ documents-api (CRUD документов)          │
│  ├─ sources-api (CRUD источников)            │
│  ├─ reports-api (генерация отчётов)          │
│  ├─ custom-prompts-api (кастомные запросы)   │
│  └─ create-user (создание пользователей)     │
│                                              │
│  Realtime (опционально):                     │
│  └─ Live обновления найденных событий        │
└────────────┬─────────────────────────────────┘
    │ API Calls
    ↓
┌──────────────────────────────────────────────┐
│     External Services                        │
│                                              │
│  OpenAI API:                                 │
│  ├─ gpt-4o (основные задачи)                 │
│  ├─ gpt-4o-mini (дешёвые операции)           │
│  └─ text-embedding-3-small (embeddings)      │
│                                              │
│  Future Providers (Phase 4+):                │
│  ├─ Anthropic Claude API                     │
│  ├─ Perplexity API (для web search)          │
│  └─ Google Gemini API                        │
│                                              │
│  Email Service (опционально):                │
│  └─ Уведомления об ошибках и алерты         │
│                                              │
│  GitHub Actions (CI/CD):                     │
│  └─ Расписание запусков Orchestrator         │
└──────────────────────────────────────────────┘
```

### 7.2 Поток данных

#### Daily Search (автоматический сбор)

```
1. GitHub Actions / Supabase Cron запускает Orchestrator в 09:00 UTC
   │
   ├─→ Orchestrator загружает job_schedules с is_active = true
   │
   ├─→ Для каждого расписания:
   │   ├─ Создаёт запись в search_runs (status: 'running')
   │   ├─ Запускает Source Hunter → выбор sources и URLs
   │   ├─ Content Fetcher → скачивание контента
   │   ├─ Document Processor → сохранение в documents + embeddings
   │   ├─ Event Extractor → создание events
   │   ├─ Criticality Scorer → оценка критичности
   │   ├─ Duplicate Detector → проверка дублей
   │   └─ Alert Manager → уведомления о критичных событиях
   │
   └─→ Обновляет job_schedules (last_run_at, next_run_at, last_run_status)
```

#### Weekly/Monthly Report (RAG-based)

```
1. User/Admin заходит в Reports → "Создать отчёт"
   │
   ├─→ Выбирает период (last 7 days / last month / custom)
   │
   ├─→ Выбирает фильтры (brands, segments, geographies, criticality)
   │
   ├─→ Frontend отправляет запрос в Edge Function reports-api
   │
   ├─→ Report Generator:
   │   ├─ Retrieval: выборка events + documents из БД
   │   ├─ Augmentation: подготовка контекста для LLM
   │   ├─ Generation: OpenAI gpt-4o генерирует отчёт (Markdown)
   │   ├─ Сохранение в reports таблицу
   │   └─ Опционально: генерация PDF/DOCX
   │
   └─→ Frontend показывает отчёт + кнопки скачивания
```

#### Custom Prompt (пользовательский запрос)

```
1. User заходит в Custom Prompts → "Создать запрос"
   │
   ├─→ Wizard (3 шага):
   │   ├─ Шаг 1: Выбор цели (find events / analyze trends / compare competitors)
   │   ├─ Шаг 2: Фильтры (brands, segments, geographies, event_types, date_range)
   │   └─ Шаг 3: Дополнительные инструкции + preview промпта
   │
   ├─→ Frontend отправляет запрос в Edge Function custom-prompts-api
   │
   ├─→ Custom Prompt Runner:
   │   ├─ Создаёт запись в custom_prompts (status: 'running')
   │   ├─ Retrieval: выборка данных по фильтрам
   │   ├─ LLM: OpenAI gpt-4o обрабатывает промпт
   │   ├─ Сохранение результата в custom_prompts.result_data
   │   └─ Обновление status: 'completed'
   │
   └─→ Frontend показывает результат
```

#### User Upload (загрузка собственных документов)

```
1. User/Admin заходит в Documents → "Загрузить документ"
   │
   ├─→ Drag & Drop файла (PDF, DOCX, PPTX)
   │
   ├─→ Frontend загружает файл в Supabase Storage:
   │   └─ bucket: market-documents/user-uploads/{user_id}/{filename}
   │
   ├─→ Frontend отправляет метаданные в Edge Function documents-api
   │
   ├─→ Document Processor:
   │   ├─ Извлечение текста из файла
   │   ├─ Генерация embeddings (OpenAI text-embedding-3-small)
   │   ├─ Mention extraction (brands, segments, geographies)
   │   ├─ Сохранение в documents (document_type: 'user-upload')
   │   └─ created_by = auth.uid()
   │
   └─→ Frontend показывает документ в библиотеке
```

---

## 8. Система авторизации и ролей

### 8.1 Модель ролей

#### Администратор (role: 'admin')
Полный доступ к системе:
- ✅ Управление пользователями (создание, редактирование, деактивация)
- ✅ Управление брендами (CRUD) 🆕
- ✅ Управление источниками (CRUD) 🆕
- ✅ Управление библиотекой промптов (CRUD)
- ✅ Настройка расписания выполнения джобов (cron schedule)
- ✅ Просмотр всех событий и документов
- ✅ Загрузка и удаление документов
- ✅ Скачивание отчетов
- ✅ Ручной запуск AI-поиска
- ✅ Просмотр логов и статистики выполнения
- ✅ Настройка параметров системы
- ✅ Управление дубликатами (merge/delete)

#### Обычный пользователь (role: 'user')
Ограниченный доступ:
- ✅ Просмотр событий (только чтение)
- ✅ Просмотр документов (только чтение)
- ✅ Фильтрация и поиск событий/документов
- ✅ Просмотр дашбордов и аналитики
- ✅ Создание кастомных промптов 🆕
- ✅ Просмотр отчётов (свои и общие)
- ✅ Скачивание отчетов (Excel/CSV/PDF)
- ✅ Загрузка собственных документов (в user-uploads) 🆕
- ❌ Редактирование данных
- ❌ Управление промптами
- ❌ Управление брендами/источниками
- ❌ Управление пользователями
- ❌ Настройка расписания

### 8.2 Row Level Security (RLS) Policies

**Для таблицы brands:**
```sql
-- Все могут видеть бренды
CREATE POLICY "Everyone can view brands"
  ON brands FOR SELECT TO authenticated USING (true);

-- Только админы могут управлять брендами
CREATE POLICY "Only admins can manage brands"
  ON brands FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Для таблицы documents:**
```sql
-- Все могут видеть документы
CREATE POLICY "Everyone can view documents"
  ON documents FOR SELECT TO authenticated USING (true);

-- Админы могут управлять всеми документами
CREATE POLICY "Admins can manage all documents"
  ON documents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Пользователи могут загружать свои документы
CREATE POLICY "Users can upload own documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND document_type = 'user-upload'
  );
```

**Для таблицы custom_prompts:**
```sql
-- Пользователи видят только свои промпты
CREATE POLICY "Users can view own prompts"
  ON custom_prompts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Пользователи могут создавать свои промпты
CREATE POLICY "Users can create own prompts"
  ON custom_prompts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

**Для таблицы reports:**
```sql
-- Пользователи видят свои отчёты + админы видят все
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 9. Ключевые функциональные модули

### 9.1 Модуль брендов (Admin only) 🆕

**Module:** `modules/admin/brands/`

#### Компоненты:

**BrandsManager.tsx**
- Таблица всех брендов (Ant Design Table)
- Фильтры: category (premium/middle/budget), country, active
- Поиск по названию
- CRUD кнопки (Create, Edit, Delete)

**BrandFormModal.tsx**
- Форма создания/редактирования бренда
- Поля:
  - name (text, required)
  - manufacturer (text)
  - country (select: Япония, Китай, Россия, Корея, Швеция, etc.)
  - category (select: premium, middle, budget)
  - website_url (url)
  - logo_url (url или upload)
  - description (textarea)
- Multi-select для связи с сегментами
- Валидация через zod

**BrandCard.tsx**
- Карточка бренда (для grid view)
- Логотип, название, категория
- Связанные сегменты (badges)

**Hooks:**
- `useBrands()` - React Query hook для брендов
- `useBrandSegments()` - управление связями

**API:**
- GET /brands - список брендов
- POST /brands - создать бренд (admin only)
- PATCH /brands/:id - обновить
- DELETE /brands/:id - удалить

---

### 9.2 Модуль документов (User + Admin) 🆕

**Module:** `modules/documents/`

#### Компоненты:

**DocumentsLibrary.tsx**
- Таблица всех сохранённых документов
- Фильтры:
  - type (article, pdf, presentation, etc.)
  - date range
  - brands (multi-select)
  - segments (multi-select)
  - geographies (multi-select)
- Full-text search по content_text
- Preview PDF/DOCX через iframe

**DocumentDetailModal.tsx**
- Полная информация о документе
- Предпросмотр контента
- Список связанных событий
- Кнопка скачивания (если файл)

**DocumentUploader.tsx**
- Drag & Drop для загрузки файлов
- Поддержка PDF, DOCX, PPTX
- Автоматическая обработка (text extraction + embedding)
- Progress bar для загрузки

**SemanticSearchBar.tsx**
- Поле для семантического поиска
- Использует embeddings для поиска похожих документов
- Показывает similarity score

**Hooks:**
- `useDocuments()` - загрузка списка
- `useDocumentUpload()` - загрузка файлов
- `useSemanticSearch()` - семантический поиск

**API:**
- GET /documents - список с фильтрами
- GET /documents/:id - детали документа
- POST /documents - upload (user + admin)
- POST /documents/search - семантический поиск
- DELETE /documents/:id - удалить (admin only)

---

### 9.3 Модуль источников (Admin only)

**Module:** `modules/admin/sources/`

#### Компоненты:

**SourcesManager.tsx**
- Таблица всех источников
- Фильтры: type, active, frequency, priority
- Поиск по названию
- CRUD операции

**SourceFormModal.tsx**
- Форма создания/редактирования источника
- Поля:
  - name (text, required)
  - source_type (select)
  - website_url (url)
  - telegram_channel (text)
  - description (textarea)
  - priority (1-5)
  - frequency (daily/weekly/monthly)
- Валидация через zod

**SourceUrlsManager.tsx**
- Управление конкретными URL внутри источника
- Типы URL: news, products, blog, press-release
- Добавление/удаление URL

**Hooks:**
- `useSources()` - React Query hook для источников
- `useSourceUrls()` - управление URL

**API:**
- GET /sources - список источников
- POST /sources - создать источник (admin only)
- PATCH /sources/:id - обновить
- DELETE /sources/:id - удалить

---

### 9.4 Модуль отчётов (User + Admin)

**Module:** `modules/reports/`

#### Компоненты:

**ReportsPage.tsx**
- Список всех отчётов (saved reports)
- Кнопка "Создать новый отчёт"
- Фильтры: type, date range, status

**ReportBuilder.tsx**
- Wizard (3 шага):
  - Шаг 1: Тип отчёта (daily-digest / weekly-analytics / monthly-summary)
  - Шаг 2: Период (date range picker)
  - Шаг 3: Фильтры (brands, segments, geographies, criticality)
- Preview промпта перед генерацией

**ReportViewer.tsx**
- Отображение сгенерированного отчёта (Markdown → HTML)
- Кнопки экспорта (PDF, DOCX, Excel)
- Секции:
  - Executive Summary
  - Критичные события (4-5)
  - Анализ по компаниям
  - Анализ по сегментам
  - Тренды
  - Рекомендации

**Hooks:**
- `useReports()` - загрузка списка отчётов
- `useGenerateReport()` - генерация нового отчёта

**API:**
- GET /reports - список отчётов
- POST /reports - создать отчёт (запуск Report Generator)
- GET /reports/:id - детали отчёта
- DELETE /reports/:id - удалить (admin only)

---

### 9.5 Модуль кастомных промптов (User + Admin) 🆕

**Module:** `modules/prompts/custom/`

#### Компоненты:

**CustomPromptBuilder.tsx**
- Step-by-step wizard (3 шага):
  - Шаг 1: Выбор цели
    - "Найти события" (find events)
    - "Анализ трендов" (analyze trends)
    - "Сравнить конкурентов" (compare competitors)
  - Шаг 2: Фильтры
    - brands (multi-select)
    - segments (multi-select)
    - geographies (multi-select)
    - event_types (multi-select)
    - date_range (date picker)
  - Шаг 3: Дополнительные инструкции
    - Текстовое поле для custom instructions
    - Preview финального промпта

**CustomPromptLibrary.tsx**
- Просмотр сохранённых промптов
- Кнопка "Запустить" для повторного выполнения
- История выполнения

**CustomPromptResult.tsx**
- Отображение результатов выполнения
- Если result_type = 'events' → таблица событий
- Если result_type = 'report' → markdown отчёт
- Если result_type = 'analysis' → structured data

**Hooks:**
- `useCustomPrompts()` - CRUD для промптов
- `useRunPrompt()` - запуск промпта

**API:**
- GET /custom-prompts - список промптов пользователя
- POST /custom-prompts - создать промпт
- POST /custom-prompts/:id/run - запустить промпт
- DELETE /custom-prompts/:id - удалить

---

## 10. Интеграция с OpenAI API

### 10.1 Основное использование

```typescript
// lib/openai/client.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Типизированные интерфейсы
interface EventExtractionResult {
  events: MarketEvent[];
  total_found: number;
}

interface CriticalityScore {
  event_id: string;
  criticality_level: 1 | 2 | 3 | 4 | 5;
  reasoning: string;
  factors: string[];
}

// Event Extraction
export async function extractEvents(
  documentText: string
): Promise<EventExtractionResult> {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2048,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `You are a market research AI for the Russian climate equipment market.
Extract all marketing events from the text.
Return ONLY valid JSON (no markdown).
Format: { "events": [{ "date": "YYYY-MM-DD", "event_type": "promo"|"price"|"contract"|"partnership"|"pr"|"tender"|"regulation", "company": "...", "description": "...", "channel": "B2B"|"B2C"|"B2G" }], "total_found": number }`
      },
      {
        role: "user",
        content: documentText
      }
    ]
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  // Type-safe parsing
  const result: EventExtractionResult = JSON.parse(content);
  return result;
}

// Criticality Scoring
export async function scoreEventCriticality(
  events: MarketEvent[]
): Promise<CriticalityScore[]> {
  const eventDescriptions = events.map((e, i) => `${i}. ${e.description}`).join('\n');

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `Rate each event's criticality (1-5):
1 - Low (routine promos, minor updates)
2 - Below average (standard promos)
3 - Medium (significant promos, product updates)
4 - High (large contracts, partnerships)
5 - Critical (100M+ deals, M&A, regulations)

Return JSON: { "scores": [{ "index": 0, "criticality_level": 1-5, "reasoning": "...", "factors": ["...", "..."] }] }`
      },
      {
        role: "user",
        content: eventDescriptions
      }
    ]
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(content);
  return parsed.scores.map((score: any, i: number) => ({
    event_id: events[i].id,
    criticality_level: score.criticality_level,
    reasoning: score.reasoning,
    factors: score.factors
  }));
}

// Embeddings Generation
export async function generateEmbedding(
  text: string
): Promise<number[]> {
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });

  return response.data[0].embedding; // 1536 dimensions
}
```

### 10.2 Стоимость и лимиты (MVP)

```
OpenAI API Pricing (декабрь 2024):

gpt-4o:
- Input: $2.50 per 1M tokens
- Output: $10.00 per 1M tokens

gpt-4o-mini:
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

text-embedding-3-small:
- $0.02 per 1M tokens

Примерные затраты на 1 daily search:
- Content Fetcher: $0 (без LLM)
- Document Processor: ~$0.01 (embeddings + mention extraction с gpt-4o-mini)
- Event Extractor: ~$0.05 (gpt-4o, ~10K tokens input/output)
- Criticality Scorer: ~$0.02 (gpt-4o, ~5K tokens)
- Duplicate Detector: ~$0.01 (embeddings)

ИТОГО: ~$0.09-0.15 за 1 daily search

Масштабирование:
- 1 поиск/день: ~$2.7-4.5/месяц
- 3 поиска/день (daily + 2 custom): ~$8-13/месяц
- Weekly/Monthly reports (4 раза в месяц): ~$0.8-1.6/месяц

Общая стоимость LLM: ~$10-15/месяц
```

---

## 11. Supabase Storage

### 11.1 Структура bucket

**Bucket name:** `market-documents`

**Структура папок:**
```
market-documents/
├─ pdfs/2024/12/
│  ├─ {source_id}_{timestamp}.pdf
│  └─ ...
├─ presentations/2024/12/
│  ├─ {source_id}_{timestamp}.pptx
│  └─ ...
├─ user-uploads/{user_id}/
│  ├─ {filename}.pdf
│  ├─ {filename}.docx
│  └─ ...
└─ reports/{report_id}/
   ├─ report.pdf
   ├─ report.docx
   └─ report.xlsx
```

### 11.2 Storage Policies (RLS)

```sql
-- Все авторизованные пользователи могут читать документы
CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'market-documents');

-- Админы могут всё
CREATE POLICY "Admins can manage all documents"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'market-documents' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Пользователи могут загружать только в свою папку
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'market-documents' AND
  (storage.foldername(name))[1] = 'user-uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Пользователи могут удалять только свои файлы
CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'market-documents' AND
  (storage.foldername(name))[1] = 'user-uploads' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

### 11.3 Upload/Download API

```typescript
// lib/storage/documents.ts
import { supabase } from '@/lib/supabase';

// Upload file
export async function uploadDocument(
  file: File,
  userId: string,
  metadata?: { title?: string; description?: string }
): Promise<{ path: string; url: string }> {
  const timestamp = Date.now();
  const filename = `${timestamp}_${file.name}`;
  const path = `user-uploads/${userId}/${filename}`;

  const { data, error } = await supabase.storage
    .from('market-documents')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('market-documents')
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl
  };
}

// Download file
export async function downloadDocument(
  path: string
): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('market-documents')
    .download(path);

  if (error) throw error;
  return data;
}

// Delete file
export async function deleteDocument(
  path: string
): Promise<void> {
  const { error } = await supabase.storage
    .from('market-documents')
    .remove([path]);

  if (error) throw error;
}

// Get file URL
export function getDocumentUrl(path: string): string {
  const { data } = supabase.storage
    .from('market-documents')
    .getPublicUrl(path);

  return data.publicUrl;
}
```

---

## 12. Типы отслеживаемых событий

| Тип события | Описание | Примеры |
|-------------|---------|---------|
| **promo** | Маркетинговые акции, скидки, промо-кампании | 15% скидка на кондиционеры, бесплатная доставка |
| **price** | Изменение цен на продукцию | Повышение цены на 5% с 01.01.2025 |
| **contract** | Крупные контракты, тендеры, закупки | Контракт на 50 млн руб. на поставку VRF систем |
| **partnership** | Партнёрства, дистрибуция, альянсы | Соглашение о дистрибуции с OZON |
| **pr** | Пресс-релизы, анонсы, новости компаний | Новая линейка продуктов, назначение CEO |
| **tender** | Госзакупки, коммерческие тендеры | Закупка 500 кондиционеров для поликлиник |
| **regulation** | Сертификация, стандарты, законы | Новый ГОСТ на энергоэффективность |

---

## 13. Структура проекта

```
MarketMonitor/
│
├── frontend/                          # React приложение (Netlify)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/                  # Аутентификация
│   │   │   ├── admin/                 # Admin панель
│   │   │   │   ├── users/
│   │   │   │   ├── brands/            # 🆕 Управление брендами
│   │   │   │   ├── sources/
│   │   │   │   ├── prompts/
│   │   │   │   └── scheduler/
│   │   │   ├── events/                # Просмотр событий
│   │   │   ├── documents/             # 🆕 Библиотека документов
│   │   │   ├── reports/               # 🆕 Отчёты
│   │   │   ├── prompts/               # 🆕 Кастомные промпты
│   │   │   └── analytics/             # Дашборды
│   │   │
│   │   ├── shared/                    # Переиспользуемый код
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   ├── forms/
│   │   │   │   └── ui/
│   │   │   ├── types/
│   │   │   ├── utils/
│   │   │   └── hooks/
│   │   │
│   │   ├── lib/                       # Библиотеки
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts
│   │   │   │   ├── auth.ts
│   │   │   │   └── storage.ts
│   │   │   ├── openai/                # 🆕 OpenAI клиент
│   │   │   │   ├── client.ts
│   │   │   │   ├── embeddings.ts
│   │   │   │   └── config.ts
│   │   │   ├── types.ts
│   │   │   └── constants.ts
│   │   │
│   │   ├── pages/                     # Страницы
│   │   ├── store/                     # Zustand состояние
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   └── package.json
│
├── supabase/                          # Backend
│   ├── migrations/
│   │   ├── 001-004_*.sql              # ✅ Применены (Phase 1-2)
│   │   ├── 005_sources_and_segments.sql # ✅ Применена (Phase 3)
│   │   ├── 006_seed_sources.sql       # ✅ Применена (Phase 3)
│   │   └── 007_brands_and_documents.sql # 🚀 TODO (Phase 3)
│   │
│   ├── functions/                     # Edge Functions
│   │   ├── agents/                    # 🆕 AI Agents
│   │   │   ├── orchestrator/
│   │   │   ├── source-hunter/
│   │   │   ├── content-fetcher/
│   │   │   ├── document-processor/
│   │   │   ├── event-extractor/
│   │   │   ├── criticality-scorer/
│   │   │   ├── duplicate-detector/
│   │   │   └── alert-manager/
│   │   │
│   │   ├── brands-api/                # 🆕 CRUD брендов
│   │   ├── documents-api/             # 🆕 CRUD документов
│   │   ├── sources-api/
│   │   ├── reports-api/               # 🆕 Генерация отчётов
│   │   ├── custom-prompts-api/        # 🆕 Кастомные промпты
│   │   └── create-user/
│   │
│   └── config.toml
│
├── docs/
│   ├── architecture.md                # 👈 ЭТОТ ФАЙЛ
│   ├── progress.md                    # Отслеживание
│   └── api.md                         # API документация
│
├── .github/
│   └── workflows/
│       ├── scheduled-search.yml       # Daily Orchestrator
│       └── deploy.yml                 # Deploy on main
│
├── CLAUDE.md                          # AI контекст
├── DEVELOPMENT_STATUS.md              # Текущий статус
├── AI_AGENTS_ARCHITECTURE.md          # Детали агентов
├── ROADMAP.md                         # Долгосрочный план
├── README.md                          # Главный README
└── .gitignore
```

---

## 14. Безопасность

### 14.1 Аутентификация
- ✅ JWT токены через Supabase Auth
- ✅ Автоматическое обновление токенов (refresh)
- ✅ Logout и отзыв сессий
- ✅ Email-based verification для новых аккаунтов

### 14.2 Авторизация
- ✅ Row Level Security (RLS) на уровне БД
- ✅ Проверка роли в каждом Edge Function
- ✅ Frontend checks для UX (не показываем кнопки админа для user)
- ✅ Backend enforces permissions (ALWAYS!)

### 14.3 Защита данных
- ✅ API ключи (SUPABASE_URL, ANON_KEY) в .env.local
- ✅ Service Role Key в GitHub Secrets (для Edge Functions и CI/CD)
- ✅ OpenAI API key в Supabase Secrets
- ✅ CORS настройки (только разрешенные домены)
- ✅ Rate limiting для AI запросов (избежать abuse)
- ✅ Валидация всех входных данных
- ✅ SQL injection защита (параметризованные запросы)
- ✅ XSS защита (Sanitize HTML в описаниях событий)

### 14.4 Storage Security
- ✅ RLS policies для market-documents bucket
- ✅ Authenticated users: READ всех документов
- ✅ Admins: READ, WRITE, DELETE всех документов
- ✅ Users: WRITE только в user-uploads/{user_id}/
- ✅ File type validation (PDF, DOCX, PPTX, XLSX только)
- ✅ File size limits (max 50MB per file)

### 14.5 .gitignore validation
❌ **НИКОГДА НЕ КОММИТИТЬ:**
- `.env`, `.env.local`, `.env.production`
- API keys, secrets
- Приватные данные пользователей
- `node_modules/`
- Временные файлы

✅ **ОБЯЗАТЕЛЬНО В .gitignore:**
```
.env
.env.local
.env.production
node_modules/
dist/
.DS_Store
*.log
```

---

## 15. Развертывание и CI/CD

### 15.1 Окружения

**Development (локально):**
- Supabase local (Docker) или cloud project (dev)
- React dev server (npm run dev)
- Edge Functions локально (supabase functions serve)

**Production:**
- Основной Supabase проект
- Main branch в GitHub
- Deploy на Netlify
- Настроить CORS и Security Headers

### 15.2 GitHub Actions

#### Scheduled Daily Search

```yaml
# .github/workflows/scheduled-search.yml
name: Daily Market Search

on:
  schedule:
    - cron: '0 9 * * *'  # 09:00 UTC каждый день = 12:00 MSK
  workflow_dispatch:    # Ручной запуск

jobs:
  orchestrator:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Orchestrator
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/agents/orchestrator \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{ "trigger": "scheduled", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'" }'
```

#### Deploy to Netlify

```yaml
# .github/workflows/deploy.yml
name: Deploy to Netlify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm install

      - name: Build frontend
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2.0
        with:
          publish-dir: './dist'
          production-branch: main
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## Заключение

MarketMonitor v2.0 - это современное AI-powered приложение с Multi-Agent архитектурой для автоматизированного мониторинга климатического рынка России.

### Ключевые преимущества архитектуры:

- 🤖 **Multi-Agent Pipeline** - специализированные агенты для каждой задачи
- 💾 **Полное сохранение контента** - documents DB + Supabase Storage + embeddings
- 📊 **RAG-based отчёты** - анализ накопленных данных, а не одноразовый поиск
- 🔍 **Семантический поиск** - pgvector + OpenAI embeddings (1536 dimensions)
- 🏢 **Управляемые справочники** - бренды, источники, сегменты через админ-панель
- 🎯 **Гибкие промпты** - стандартные + кастомные от пользователей
- 🔐 **Безопасность** - RLS на уровне БД, JWT auth, Storage policies
- 📈 **Масштабируемость** - Supabase + OpenAI API, готово к multi-provider
- 💰 **Token Economy** - ~$10-15/месяц на LLM в MVP

**MVP:** 6 недель разработки (5 фаз)

**См. также:**
- [DEVELOPMENT_STATUS.md](../DEVELOPMENT_STATUS.md) - текущий прогресс
- [AI_AGENTS_ARCHITECTURE.md](../AI_AGENTS_ARCHITECTURE.md) - детали агентов
- [ROADMAP.md](../ROADMAP.md) - долгосрочный план
- [CLAUDE.md](../CLAUDE.md) - AI контекст для разработки

---

**Версия:** 2.0 (AI Agents Architecture)
**Дата обновления:** 2024-12-11
**Автор:** Claude Code + User Team
