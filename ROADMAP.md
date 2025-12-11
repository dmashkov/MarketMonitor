# 🗺️ MarketMonitor Roadmap - Расширенная Функциональность

**Дата обновления:** 2024-12-11
**Версия:** 2.0 (AI Agents Architecture)
**Статус:** Phase 3 In Progress (50%) - AI Agents + Admin UI

---

## 📋 Обзор

MarketMonitor переходит на **AI Agents 2.0 Architecture** - Multi-Agent система с полным сохранением контента и RAG-based отчётами.

### Ключевые изменения архитектуры:

**БЫЛО (v0.1-0.4):**
```
Daily/Weekly/Monthly промпты → OpenAI → Events таблица
```

**СТАЛО (v0.5+):**
```
Daily Search (8 агентов) → Documents DB + Storage → RAG Reports
```

### Основные преимущества:
1. **Полное сохранение контента** - PDF, PPTX, HTML + embeddings
2. **Multi-Agent Pipeline** - специализированные агенты для каждой задачи
3. **RAG-based отчёты** - анализ накопленных данных, а не одноразовый поиск
4. **Семантический поиск** - pgvector + OpenAI embeddings (1536 dimensions)
5. **Управляемые справочники** - бренды, источники, сегменты через UI

---

## 🎯 Phase 3: AI Agents Architecture + Admin UI

**Сроки:** 3-4 недели
**Статус:** 🚀 50% (Architecture documented, Database schema ready)

### 3.1 Backend: New Database Tables (Migration 007) ⏳

#### 🆕 Новые таблицы:

**1. brands** - справочник брендов
```sql
- name, manufacturer, country, category (premium/middle/budget)
- logo_url, website_url, description
- связь brand_segments (Many-to-Many с segments)
```
**Seed:** Daikin, Mitsubishi Electric, Haier, Midea, TCL, Gree, Ballu, Centek, Lessar, Royal Clima, Electrolux, LG

**2. documents** - хранилище контента
```sql
- title, description, document_type
- content_text (FTS), content_html
- file_url (ссылка на Supabase Storage)
- brand_ids[], segment_ids[], geography_ids[] (массивы)
- embedding VECTOR(1536) - для семантического поиска
- source_id, published_date, detected_at
```

**3. reports** - сохранённые отчёты
```sql
- title, report_type (daily-digest / weekly-analytics / monthly-summary)
- date_from, date_to, filters (JSONB)
- content_markdown, content_html
- events_count, documents_count, key_insights[]
- pdf_url, docx_url, excel_url (Storage)
```

**4. custom_prompts** - кастомные запросы пользователей
```sql
- user_id, prompt_text
- brand_ids[], segment_ids[], geography_ids[], event_types[]
- result_type (events / report / analysis)
- result_data (JSONB), status (pending / running / completed)
- is_saved (для повторного использования)
```

**5. Обновление events таблицы:**
```sql
- brand_id, document_id (новые FK)
- criticality_reasoning, criticality_factors[] (для прозрачности AI)
- event_brands (Many-to-Many таблица)
```

#### 🆕 Supabase Storage:

**Bucket:** `market-documents`
```
market-documents/
├─ pdfs/2024/12/
├─ presentations/2024/12/
├─ user-uploads/{user_id}/
└─ reports/{report_id}/
```

**RLS Policies:**
- Authenticated users: READ всех документов
- Admins: READ, WRITE, DELETE всех
- Users: WRITE только в user-uploads/{user_id}/

**Extensions:**
- ✅ `uuid-ossp` (уже есть)
- 🆕 `vector` - pgvector для embeddings

---

### 3.2 Backend: Edge Functions API ⏳

**1. brands-api** (CRUD брендов)
```typescript
// GET /brands - список всех брендов (фильтры: category, country, active)
// GET /brands/:id - детали бренда
// POST /brands - создать бренд (admin only)
// PATCH /brands/:id - обновить бренд (admin only)
// DELETE /brands/:id - удалить бренд (admin only)
```

**2. documents-api** (CRUD документов)
```typescript
// GET /documents - список с фильтрами (type, brands, segments, date_range)
// GET /documents/:id - детали документа + связанные события
// POST /documents - upload файла (user + admin)
// POST /documents/search - семантический поиск по embeddings
// DELETE /documents/:id - удалить (admin only)
```

**3. reports-api** (генерация отчётов)
```typescript
// GET /reports - список отчётов (свои + общие для админов)
// POST /reports - создать отчёт (запуск Report Generator)
// GET /reports/:id - детали отчёта
// POST /reports/:id/export - экспорт в PDF/DOCX/Excel
// DELETE /reports/:id - удалить (admin only)
```

**4. custom-prompts-api** (кастомные запросы)
```typescript
// GET /custom-prompts - список промптов пользователя
// POST /custom-prompts - создать промпт
// POST /custom-prompts/:id/run - запустить промпт
// PATCH /custom-prompts/:id - обновить (сохранить)
// DELETE /custom-prompts/:id - удалить
```

**5. sources-api** (управление источниками) ✅ Уже планировалось
```typescript
// GET /sources - список всех источников
// POST /sources - создать источник (admin only)
// PATCH /sources/:id - обновить
// DELETE /sources/:id - удалить
```

---

### 3.3 Frontend: Admin UI Modules ⏳

#### Module 1: `modules/admin/brands/` 🆕

**Компоненты:**

1. **BrandsManager.tsx**
   - Таблица брендов (Ant Design Table)
   - Фильтры: category, country, active, segments
   - Поиск по названию
   - Grid view / Table view toggle

2. **BrandFormModal.tsx**
   - Форма создания/редактирования бренда
   - Multi-select для связи с сегментами
   - Upload логотипа (в Storage)
   - Валидация через zod

3. **BrandCard.tsx**
   - Карточка бренда (для grid view)
   - Логотип, категория, связанные сегменты

**Hooks:**
- `useBrands()` - React Query hook для CRUD
- `useBrandSegments()` - управление связями

---

#### Module 2: `modules/documents/` 🆕

**Компоненты:**

1. **DocumentsLibrary.tsx**
   - Таблица всех документов
   - Фильтры: type, brands, segments, geographies, date_range
   - Full-text search + семантический поиск
   - Preview PDF/DOCX через iframe

2. **DocumentUploader.tsx**
   - Drag & Drop для загрузки файлов (PDF, DOCX, PPTX)
   - Автоматическая обработка:
     - Text extraction
     - Embedding generation
     - Mention extraction (brands, segments, geographies)
   - Progress bar

3. **SemanticSearchBar.tsx** 🆕
   - Поле для семантического поиска
   - Использует embeddings
   - Показывает similarity score

4. **DocumentDetailModal.tsx**
   - Полная информация о документе
   - Предпросмотр контента
   - Список связанных событий
   - Кнопка скачивания

**Hooks:**
- `useDocuments()` - загрузка списка
- `useDocumentUpload()` - загрузка файлов
- `useSemanticSearch()` - семантический поиск

---

#### Module 3: `modules/reports/` 🆕

**Компоненты:**

1. **ReportsPage.tsx**
   - Список всех отчётов (saved reports)
   - Фильтры: type, date_range, status
   - Кнопка "Создать новый отчёт"

2. **ReportBuilder.tsx**
   - Step-by-step wizard (3 шага):
     - Шаг 1: Тип отчёта (daily-digest / weekly-analytics / monthly-summary)
     - Шаг 2: Период (date range picker)
     - Шаг 3: Фильтры (brands, segments, geographies, criticality)
   - Preview промпта перед генерацией

3. **ReportViewer.tsx**
   - Отображение отчёта (Markdown → HTML)
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

---

#### Module 4: `modules/prompts/custom/` 🆕

**Компоненты:**

1. **CustomPromptBuilder.tsx**
   - Step-by-step wizard (3 шага):
     - Шаг 1: Выбор цели (find events / analyze trends / compare competitors)
     - Шаг 2: Фильтры (brands, segments, geographies, event_types, date_range)
     - Шаг 3: Дополнительные инструкции + preview промпта

2. **CustomPromptLibrary.tsx**
   - Просмотр сохранённых промптов
   - Кнопка "Запустить" для повторного выполнения
   - История выполнения

3. **CustomPromptResult.tsx**
   - Отображение результатов:
     - events → таблица событий
     - report → markdown отчёт
     - analysis → structured data

**Hooks:**
- `useCustomPrompts()` - CRUD для промптов
- `useRunPrompt()` - запуск промпта

---

#### Module 5: `modules/admin/sources/` (обновление)

**Расширение существующего:**

1. **SourcesManager.tsx** (уже планировалось)
   - Таблица всех источников
   - Фильтры: type, active, frequency, priority

2. **SourceFormModal.tsx**
   - Связь с брендами (многие ко многим) 🆕
   - Связь с сегментами 🆕

---

## 🎯 Phase 4: AI Agents Implementation

**Сроки:** 3-4 недели
**Статус:** ⏳ Планирование (Design complete)

### 4.1 Multi-Agent Pipeline (8 агентов)

```
Orchestrator → Source Hunter → Content Fetcher → Document Processor →
→ Event Extractor → Criticality Scorer → Duplicate Detector → Alert Manager

+ Report Generator (отдельный контур)
```

#### Agent 1: Orchestrator
**Задача:** Управление расписанием и запуском всех агентов.
- Читает `job_schedules` и `ai_prompts`
- Создаёт записи в `search_runs`
- Запускает агентов по порядку
- Логирует статусы и ошибки

**Время:** ~2 сек | **Стоимость:** $0 (без LLM)

---

#### Agent 2: Source Hunter
**Задача:** Определить, ГДЕ искать информацию.
- Выбирает релевантные `sources` из БД
- Формирует список `source_urls` для проверки
- Приоритизирует источники

**Время:** ~2 сек | **Стоимость:** $0 (без LLM, только БД запросы)

---

#### Agent 3: Content Fetcher
**Задача:** Загрузить контент по URL.
- Для каждого URL скачивает HTML / PDF / PPTX
- Обрабатывает ошибки (404, timeout)
- Сохраняет сырой контент

**Время:** ~15 сек | **Стоимость:** $0 (без LLM)

---

#### Agent 4: Document Processor
**Задача:** Сохранить контент в БД + Storage, сгенерировать embeddings.

**Что делает:**
1. Извлечение текста (HTML, PDF, PPTX → текст)
2. Загрузка файлов в Supabase Storage
3. Генерация embeddings (OpenAI text-embedding-3-small)
4. Mention extraction (brands, segments, geographies) через LLM
5. Сохранение в `documents` таблицу

**Время:** ~30 сек | **Стоимость:** ~$0.01-0.02

---

#### Agent 5: Event Extractor
**Задача:** Превратить текст в структурированные события.
- Вызывает OpenAI gpt-4o с промптом
- Парсит JSON ответ (типизированный!)
- Сохраняет события в `events` с привязкой к `document_id`

**Время:** ~40 сек | **Стоимость:** ~$0.05-0.10 (gpt-4o)

---

#### Agent 6: Criticality Scorer
**Задача:** Оценить важность событий (1-5).

**5-уровневая шкала:**
| Уровень | Название | Описание | Примеры |
|---------|----------|----------|---------|
| 1 | Низкая | Рутинные акции | Мелкие обновления |
| 2 | Ниже среднего | Стандартные промо | Локальные акции |
| 3 | Средняя | Значимые акции | Обновления продуктов |
| 4 | Высокая | Крупные контракты | Партнёрства |
| 5 | Критическая | Сделки на сотни млн | M&A, регулирование |

**Что делает:**
- Batch обработка ~10 событий
- Вызывает OpenAI gpt-4o
- Обновляет `criticality_level`, `criticality_reasoning`, `criticality_factors`

**Время:** ~10 сек | **Стоимость:** ~$0.02-0.03

**Критичные события (4-5):** Автоматически передаются в Alert Manager.

---

#### Agent 7: Duplicate Detector
**Задача:** Найти дубликаты событий.

**Методы:**
1. **Ключевые поля** (быстрый): date + company + event_type
2. **Embeddings** (точный): векторный поиск, similarity > 0.85

**Действия:**
- Отмечает дубликат (`is_duplicate = true`)
- Связывает с оригиналом (`duplicate_of_id`)
- НЕ удаляет автоматически (admin проверяет)

**Время:** ~15 сек | **Стоимость:** ~$0.01 (embeddings)

---

#### Agent 8: Alert Manager
**Задача:** Уведомить о критичных событиях (4-5 уровень).
- Создаёт записи в `alerts`
- Отправляет уведомления:
  - In-app notifications (MVP)
  - Email (опционально)
  - Telegram (Phase 6+)

**Время:** ~5 сек | **Стоимость:** $0 (без LLM)

---

#### Report Generator (отдельный контур)
**Задача:** Создать RAG-based отчёт.

**Flow:**
1. **Retrieval:** выборка events + documents из БД по фильтрам
2. **Augmentation:** подготовка контекста для LLM
3. **Generation:** OpenAI gpt-4o генерирует отчёт (Markdown)
4. **Saving:** сохранение в `reports`, генерация PDF/DOCX

**Время:** ~60-90 сек | **Стоимость:** ~$0.20-0.40

---

### 4.2 Edge Functions для Агентов

```
supabase/functions/agents/
├─ orchestrator/
├─ source-hunter/
├─ content-fetcher/
├─ document-processor/
├─ event-extractor/
├─ criticality-scorer/
├─ duplicate-detector/
├─ alert-manager/
└─ report-generator/
```

Каждый агент - отдельная Deno Edge Function с:
- Типизированными интерфейсами (TypeScript)
- Логированием в `search_runs`
- Error handling и retry logic
- Интеграцией с UniversalLLMClient

---

### 4.3 Автоматизация (GitHub Actions)

**Scheduled Daily Search:**
```yaml
# .github/workflows/scheduled-search.yml
on:
  schedule:
    - cron: '0 9 * * *'  # 09:00 UTC = 12:00 MSK
```

**Workflow:**
1. Trigger Orchestrator
2. Orchestrator запускает всех агентов по цепочке
3. Логирует результаты в `search_runs`
4. Отправляет алерты при критичных событиях

---

## 🎯 Phase 5: Multi-Depth Search & Analytics

**Сроки:** 2-3 недели
**Статус:** ⏳ Планирование

### 5.1 Три уровня глубины поиска

| Глубина | Частота | Цель | Источники | Примеры |
|---------|---------|------|-----------|---------|
| **Daily** | Ежедневно | Быстрое реагирование | Дистрибьюторы, производители | Акции, скидки, анонсы |
| **Weekly** | Еженедельно | Широкие события | СМИ, пресс-релизы | Контракты, соглашения |
| **Monthly** | Ежемесячно | Тренды и аналитика | Ассоциации, аналитика | Обзоры рынка, прогнозы |

### 5.2 Search Run Analytics

**Module: `modules/analytics/search-runs/`**

1. **SearchRunsHistory.tsx**
   - Таблица всех поисковых запусков
   - Метрики: events_found, execution_time, success_rate
   - График: события по дням/неделям/месяцам

2. **SearchDepthAnalytics.tsx**
   - Сравнение эффективности Daily/Weekly/Monthly
   - События по глубине
   - Критичность по глубине

---

## 🎯 Phase 6: Advanced Features & Intelligence

**Сроки:** 3-4 недели
**Статус:** 🔮 Будущая оптимизация

### 6.1 Historical Data Analysis

**Module: `modules/analytics/intelligence/`**

1. **TrendAnalyzer.tsx**
   - Анализ трендов за период (1 мес, 3 мес, 6 мес, 1 год)
   - Выявление повторяющихся паттернов
   - Сезонность событий

2. **CompanyProfiler.tsx**
   - Профиль активности компании
   - История событий
   - Частота упоминаний

3. **MarketInsights.tsx**
   - AI-генерированные инсайты
   - Еженедельные/ежемесячные дайджесты

### 6.2 Telegram Integration

**Технологии:**
- Telegram Bot API
- Webhook для новых сообщений
- Автоматический парсинг каналов

**Функции:**
1. Подключение к Telegram каналам (список в sources)
2. Фильтрация релевантных сообщений через OpenAI
3. Создание событий с source_id = Telegram
4. Telegram уведомления о критичных событиях

---

## 📊 Метрики успеха

| Метрика | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---------|---------|---------|---------|---------|
| Таблиц в БД | 15+ | 15+ | 16+ | 18+ |
| Брендов | 12+ | 20+ | 30+ | 50+ |
| Источников | 15+ | 20+ | 30+ | 50+ |
| Документов/месяц | - | 100+ | 300+ | 500+ |
| Событий/день | 20+ | 30+ | 50+ | 80+ |
| Критичных событий/неделю | - | 5+ | 10+ | 15+ |
| Отчётов/месяц | - | 10+ | 20+ | 40+ |
| **Стоимость LLM/месяц** | $0 | $10-15 | $20-30 | $40-60 |

---

## 🔧 Технические требования

### Новые npm пакеты (frontend)

```json
{
  "dependencies": {
    // Для работы с датами
    "date-fns": "^2.30.0",

    // Для работы с cron
    "cron-parser": "^4.9.0",
    "cronstrue": "^2.49.0",

    // Для markdown (отчёты)
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",

    // Для экспорта в DOCX
    "docx": "^8.5.0",

    // Для работы с PDF
    "pdfjs-dist": "^3.11.174",

    // Для работы с графиками (уже есть)
    "recharts": "^2.10.0"
  }
}
```

### Edge Functions (Supabase)

**Phase 3:**
1. `brands-api` - CRUD брендов
2. `documents-api` - CRUD документов + семантический поиск
3. `reports-api` - генерация отчётов
4. `custom-prompts-api` - кастомные запросы
5. `sources-api` - CRUD источников

**Phase 4:**
6. `agents/orchestrator` - управление запусками
7. `agents/source-hunter` - выбор источников
8. `agents/content-fetcher` - скачивание контента
9. `agents/document-processor` - обработка + embeddings
10. `agents/event-extractor` - извлечение событий
11. `agents/criticality-scorer` - оценка критичности
12. `agents/duplicate-detector` - поиск дубликатов
13. `agents/alert-manager` - уведомления
14. `agents/report-generator` - RAG-отчёты

**Phase 6:**
15. `telegram-webhook` - обработка Telegram сообщений

---

## 🚀 Приоритеты реализации

### Высокий приоритет (Phase 3) 🚀
1. ✅ Database schema (Migration 007) - READY
2. ⏳ Brands Management UI
3. ⏳ Documents Library UI
4. ⏳ Reports Builder UI
5. ⏳ Custom Prompts Builder UI
6. ⏳ Sources Management UI (расширение)

### Высокий приоритет (Phase 4) 🚀
7. ⏳ Orchestrator Agent
8. ⏳ Source Hunter Agent
9. ⏳ Content Fetcher Agent
10. ⏳ Document Processor Agent (+ embeddings)
11. ⏳ Event Extractor Agent
12. ⏳ Criticality Scorer Agent
13. ⏳ Duplicate Detector Agent
14. ⏳ Alert Manager Agent
15. ⏳ Report Generator Agent

### Средний приоритет (Phase 5)
16. Multi-Depth Search System
17. Search Run Analytics
18. Scheduler improvements

### Низкий приоритет (Phase 6)
19. Historical Data Analysis
20. Telegram Integration
21. Advanced AI Features

---

## 📚 Документация

### Обновлено:
- ✅ [docs/architecture.md](docs/architecture.md) - Multi-Agent Architecture описана
- ✅ [AI_AGENTS_ARCHITECTURE.md](AI_AGENTS_ARCHITECTURE.md) - детальное описание агентов
- ✅ [CLAUDE.md](CLAUDE.md) - AI контекст обновлён
- ✅ [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) - текущий прогресс

### TODO:
- 📝 docs/api.md - API endpoints documentation
- 📝 frontend/README.md - примеры использования компонентов
- 📝 supabase/functions/README.md - описание Edge Functions

---

## ❓ Открытые вопросы

1. **LLM Provider Management:**
   - ✅ MVP: только OpenAI
   - 🔮 Будущее: multi-provider (Anthropic, Perplexity, Google)
   - Где хранить API ключи? (Supabase Secrets ✅)

2. **Embeddings Storage:**
   - ✅ Хранить в documents.embedding (VECTOR(1536))
   - ✅ Использовать pgvector для семантического поиска

3. **Real-time updates:**
   - Использовать Supabase Realtime для live-обновлений событий?
   - WebSocket notifications для критичных событий?

4. **Scalability:**
   - Архивирование старых событий (>1 год)?
   - Партиционирование таблицы events по дате?

---

## 📝 Changelog

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2024-12-05 | 1.0 | Создание документа, Phase 3-7 планирование |
| 2024-12-11 | 2.0 | **AI Agents Architecture 2.0** - Multi-Agent система, Migration 007, RAG-отчёты |

---

**Следующий шаг:** Phase 3 - завершить Migration 007 + начать Admin UI

**Ответственный:** Development Team
**Дедлайн Phase 3:** 2024-12-31 (3 недели)
**Дедлайн Phase 4:** 2025-01-31 (4 недели)

---

**См. также:**
- [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) - детальный прогресс
- [AI_AGENTS_ARCHITECTURE.md](AI_AGENTS_ARCHITECTURE.md) - архитектура агентов
- [docs/architecture.md](docs/architecture.md) - полная документация
