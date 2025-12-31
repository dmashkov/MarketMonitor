# 🤖 MarketMonitor - AI Agents Architecture
**Версия:** 2.0  
**Дата:** 2024-12-07  
**Статус:** Ready for Implementation

---

## 📋 Содержание

1. [Контекст проекта](#контекст-проекта)
2. [Ключевые принципы архитектуры](#ключевые-принципы-архитектуры)
3. [Обновленная схема базы данных](#обновленная-схема-базы-данных)
4. [Архитектура AI-агентов](#архитектура-ai-агентов)
5. [Детальное описание агентов](#детальное-описание-агентов)
6. [Flow выполнения](#flow-выполнения)
7. [Custom Prompts система](#custom-prompts-система)
8. [Админ-панель для справочников](#админ-панель-для-справочников)
9. [LLM Provider Management](#llm-provider-management-управление-ai-провайдерами)
10. [План реализации](#план-реализации)
11. [Технические детали](#технические-детали)

---

## Контекст проекта

### Что такое MarketMonitor?

Web-приложение для автоматизированного мониторинга климатического рынка России с использованием AI.

**Целевая аудитория:**
- Руководители компаний
- Коммерческий департамент
- Продуктовые менеджеры
- Маркетологи

**Основная задача:**
Ежедневный сбор информации о активностях рынка (акции, цены, контракты, новые продукты, партнерства) с автоматической оценкой критичности событий.

### Референс: Perplexity отчет

Пользователь предоставил пример отчета от Perplexity (см. `Monitoring-Climat-Market-Nov-2025.pdf`), который включает:
- Executive Summary с ключевыми инсайтами
- Таблицы событий с датами, компаниями, критичностью
- Детализацию по компаниям
- Анализ трендов
- Конкурентный анализ
- Рекомендации

**Цель:** Сделать такие отчеты АВТОМАТИЧЕСКИ с накоплением истории и возможностью анализа трендов.

### Текущее состояние проекта

**Реализовано (Phase 1-2):**
- ✅ Аутентификация через Supabase Auth
- ✅ Ролевая модель (admin/user)
- ✅ Базовая таблица events
- ✅ Таблица ai_prompts
- ✅ Таблица job_schedules
- ✅ Деплой на Netlify

**Реализовано (Phase 3 - 40%):**
- ✅ Миграции 005-006: таблицы sources, segments, geographies, source_types, source_urls
- ✅ Seed данные: 15+ источников, 8 сегментов, география РФ
- ✅ TypeScript типы обновлены (+200 строк)

**TODO (Phase 3):**
- 🚀 Backend API (Edge Functions) для CRUD справочников
- 🚀 Frontend UI для админ-панели
- 🚀 AI Agents система (основная задача этого документа)

---

## Ключевые принципы архитектуры

### 1. Разделение сбора и анализа

**Было (неправильно):**
- Daily/Weekly/Monthly промпты каждый раз ищут НОВЫЕ данные
- Нет накопления истории
- Повторения и дубликаты

**Стало (правильно):**
- **Daily Search** - ежедневный сбор первичных данных (новости, акции, цены)
- **Reports** - анализ СУЩЕСТВУЮЩИХ данных из БД (weekly/monthly)
- **Custom Prompts** - возможность запустить свой запрос

### 2. Полное сохранение контента

**Сохраняем не только события, но и исходники:**
- PDF документы → Supabase Storage
- Презентации (PPTX) → Supabase Storage
- HTML статьи → content_html в БД
- Извлеченный текст → content_text для поиска
- Embeddings → для семантического поиска

**Зачем:**
- Повторный анализ в будущем
- Ссылки на источники для пользователей
- Возможность добавлять свои материалы (user uploads)

### 3. Multi-agent система

Вместо одного большого промпта → несколько специализированных агентов:

1. **Source Hunter** - определяет, ГДЕ искать
2. **Content Fetcher** - скачивает контент
3. **Document Processor** - сохраняет ПОЛНОСТЬЮ в Storage/БД
4. **Event Extractor** - извлекает структурированные события
5. **Criticality Scorer** - оценивает важность (1-5)
6. **Duplicate Detector** - находит повторы
7. **Report Generator** - создает отчеты
8. **Alert Manager** - уведомления о критичных событиях

### 4. Управляемые справочники

**Все справочники редактируются через админ-панель:**
- Источники (sources)
- Бренды (brands) 🆕
- Сегменты (segments)
- География (geographies)
- Типы источников (source_types)

### 5. Гибкие промпты

**Библиотека промптов:**
- Стандартные (daily, weekly, monthly)
- Кастомные (создаются пользователями)
- С параметрами (brands, segments, geographies, event_types)

---

## Обновленная схема базы данных

### Новые таблицы (дополнение к существующим)

#### 1. `brands` - справочник брендов

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- "Daikin", "Midea", "Haier"
  manufacturer TEXT, -- "Daikin Industries", "Midea Group"
  country TEXT, -- "Япония", "Китай", "Россия"
  category TEXT CHECK (category IN ('premium', 'middle', 'budget')),
  is_active BOOLEAN DEFAULT true,
  logo_url TEXT,
  website_url TEXT,
  description TEXT,
  metadata JSONB, -- { market_share: "15%", segments: [...] }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Связь бренда с сегментами (Many-to-Many)
CREATE TABLE brand_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false, -- основной сегмент бренда
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(brand_id, segment_id)
);

-- Триггер updated_at
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view brands"
  ON brands FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage brands"
  ON brands FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- То же для brand_segments
ALTER TABLE brand_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view brand_segments"
  ON brand_segments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage brand_segments"
  ON brand_segments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Seed данные:**

```sql
-- Вставка брендов
INSERT INTO brands (name, manufacturer, country, category, website_url) VALUES
('Daikin', 'Daikin Industries', 'Япония', 'premium', 'https://daikin.ru'),
('Mitsubishi Electric', 'Mitsubishi Electric Corporation', 'Япония', 'premium', 'https://mitsubishielectric.ru'),
('Haier', 'Haier Group', 'Китай', 'middle', 'https://haier.ru'),
('Midea', 'Midea Group', 'Китай', 'middle', 'https://midea.ru'),
('TCL', 'TCL Corporation', 'Китай', 'middle', 'https://tcl.ru'),
('Gree', 'Gree Electric', 'Китай', 'middle', 'https://gree.ru'),
('Ballu', 'Ballu (российская сборка)', 'Россия', 'budget', 'https://ballu.ru'),
('Centek', 'Centek', 'Россия', 'budget', 'https://centek.ru'),
('Lessar', 'Lessar', 'Россия', 'budget', 'https://lessar.ru'),
('Royal Clima', 'Royal Clima', 'Россия', 'budget', 'https://royalclima.ru'),
('Electrolux', 'Electrolux', 'Швеция', 'middle', 'https://electrolux.ru'),
('LG', 'LG Electronics', 'Южная Корея', 'middle', 'https://lg.com/ru');

-- Связь брендов с сегментами (примеры)
WITH brand_ids AS (
  SELECT id, name FROM brands
),
segment_ids AS (
  SELECT id, code FROM segments
)
INSERT INTO brand_segments (brand_id, segment_id, is_primary)
SELECT b.id, s.id, (s.code = 'RAC') -- RAC как primary для большинства
FROM brand_ids b
CROSS JOIN segment_ids s
WHERE 
  (b.name = 'Daikin' AND s.code IN ('RAC', 'VRF', 'CHILLER')) OR
  (b.name = 'Midea' AND s.code IN ('RAC', 'VRF')) OR
  (b.name = 'Haier' AND s.code IN ('RAC', 'VRF')) OR
  (b.name = 'Ballu' AND s.code IN ('RAC', 'AHU', 'VENTILATION'));
```

#### 2. `documents` - хранилище контента

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Основная информация
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT CHECK (document_type IN (
    'article',      -- статья
    'report',       -- отчет
    'presentation', -- презентация
    'pdf',          -- PDF документ
    'press-release',-- пресс-релиз
    'analytics',    -- аналитика
    'user-upload'   -- загруженный пользователем
  )) NOT NULL,
  
  -- Контент
  content_text TEXT, -- извлеченный текст (для поиска)
  content_html TEXT, -- HTML версия (если есть)
  file_url TEXT,     -- ссылка на файл в Supabase Storage
  file_size INTEGER, -- размер в байтах
  file_format TEXT,  -- "pdf", "docx", "pptx", "html"
  
  -- Метаданные источника
  source_id UUID REFERENCES sources(id),
  source_url TEXT,   -- откуда взято
  published_date DATE,
  detected_at TIMESTAMP DEFAULT NOW(),
  
  -- Связи (массивы UUID для быстрой фильтрации)
  brand_ids UUID[], -- бренды, упомянутые в документе
  segment_ids UUID[], -- сегменты
  geography_ids UUID[], -- географии
  
  -- Векторное представление для семантического поиска
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small
  
  -- Статус
  is_processed BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  processing_error TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Индексы для производительности
CREATE INDEX idx_documents_source ON documents(source_id);
CREATE INDEX idx_documents_published ON documents(published_date DESC);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_brands ON documents USING GIN(brand_ids);
CREATE INDEX idx_documents_segments ON documents USING GIN(segment_ids);
CREATE INDEX idx_documents_detected ON documents(detected_at DESC);

-- Полнотекстовый поиск (русский язык)
CREATE INDEX idx_documents_fts ON documents 
  USING gin(to_tsvector('russian', coalesce(content_text, '')));

-- Векторный поиск (требует pgvector extension)
-- CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX idx_documents_embedding ON documents 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Триггер updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view documents"
  ON documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage all documents"
  ON documents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can upload own documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND document_type = 'user-upload');
```

#### 3. Обновление таблицы `events`

```sql
-- Добавляем новые поля к существующей таблице events
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id),
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS extracted_data JSONB,
  ADD COLUMN IF NOT EXISTS additional_sources TEXT[],
  ADD COLUMN IF NOT EXISTS criticality_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS criticality_factors TEXT[];

-- Связь события с несколькими брендами (Many-to-Many)
CREATE TABLE IF NOT EXISTS event_brands (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, brand_id)
);

-- RLS для event_brands
ALTER TABLE event_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view event_brands"
  ON event_brands FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage event_brands"
  ON event_brands FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Индексы
CREATE INDEX IF NOT EXISTS idx_events_brand ON events(brand_id);
CREATE INDEX IF NOT EXISTS idx_events_document ON events(document_id);
```

#### 4. `reports` - сохраненные отчеты

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Основная информация
  title TEXT NOT NULL,
  report_type TEXT CHECK (report_type IN (
    'daily-digest',    -- ежедневная сводка
    'weekly-analytics', -- еженедельная аналитика
    'monthly-summary',  -- месячная сводка
    'custom-query'      -- кастомный запрос
  )) NOT NULL,
  
  -- Период
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  
  -- Фильтры, использованные для генерации
  filters JSONB, -- { brands: [...], segments: [...], geographies: [...], event_types: [...] }
  
  -- Контент отчета
  content_markdown TEXT,
  content_html TEXT,
  
  -- Метаданные
  events_count INTEGER DEFAULT 0,
  documents_count INTEGER DEFAULT 0,
  key_insights TEXT[], -- массив ключевых инсайтов
  
  -- Статус
  status TEXT CHECK (status IN ('generating', 'completed', 'failed')) DEFAULT 'generating',
  error_message TEXT,
  
  -- Файлы (ссылки на Storage)
  pdf_url TEXT,
  docx_url TEXT,
  excel_url TEXT,
  
  generated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Индексы
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_dates ON reports(date_from, date_to);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_by ON reports(created_by);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can create reports"
  ON reports FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can manage all reports"
  ON reports FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 5. `custom_prompts` - кастомные запросы пользователей

```sql
CREATE TABLE custom_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Текст промпта
  prompt_text TEXT NOT NULL,
  
  -- Параметры фильтрации
  brand_ids UUID[],
  segment_ids UUID[],
  geography_ids UUID[],
  event_types TEXT[], -- ["promo", "price", "contract", ...]
  date_from DATE,
  date_to DATE,
  
  -- Тип результата
  result_type TEXT CHECK (result_type IN ('events', 'report', 'analysis')) DEFAULT 'events',
  result_data JSONB,
  
  -- Статус выполнения
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  
  -- Переиспользование
  is_saved BOOLEAN DEFAULT false, -- сохранить для повторного использования
  name TEXT, -- название сохраненного промпта
  description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Индексы
CREATE INDEX idx_custom_prompts_user ON custom_prompts(user_id);
CREATE INDEX idx_custom_prompts_status ON custom_prompts(status);
CREATE INDEX idx_custom_prompts_saved ON custom_prompts(is_saved) WHERE is_saved = true;

-- RLS
ALTER TABLE custom_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prompts"
  ON custom_prompts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own prompts"
  ON custom_prompts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own prompts"
  ON custom_prompts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
```

#### 6. Обновление `search_runs` для агентов

```sql
-- Обновляем существующую таблицу search_runs
ALTER TABLE search_runs
  ADD COLUMN IF NOT EXISTS agent_timings JSONB, -- { source_hunter: 2.5s, content_fetcher: 15s, ... }
  ADD COLUMN IF NOT EXISTS sources_checked INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_created INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicates_merged INTEGER DEFAULT 0;
```

---

## Архитектура AI-агентов

### Общая схема

```
┌─────────────────────────────────────────────────────────┐
│              ORCHESTRATOR (Главный дирижер)              │
│  Edge Function: orchestrator/index.ts                   │
│  Запускается: по расписанию (cron) или вручную          │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   DAILY      │  │   CUSTOM     │  │   REPORT     │
  │   SEARCH     │  │   PROMPTS    │  │   GENERATOR  │
  │   (сбор)     │  │   (запросы)  │  │   (анализ)   │
  └──────────────┘  └──────────────┘  └──────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                  ┌──────────────────┐
                  │  SEARCH PIPELINE │
                  └──────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ Agent 1: │      │ Agent 2: │      │ Agent 3: │
  │ Source   │─────▶│ Content  │─────▶│ Document │
  │ Hunter   │      │ Fetcher  │      │ Processor│
  └──────────┘      └──────────┘      └──────────┘
                                            │
                  ┌─────────────────────────┼─────────────────────────┐
                  ▼                         ▼                         ▼
        ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
        │   Agent 4:   │          │   Agent 5:   │          │   Agent 6:   │
        │   Event      │          │   Embedding  │          │   Criticality│
        │  Extractor   │          │   Generator  │          │   Scorer     │
        └──────────────┘          └──────────────┘          └──────────────┘
                  │                         │                         │
                  └─────────────────────────┼─────────────────────────┘
                                            ▼
                                  ┌──────────────────┐
                                  │    Agent 7:      │
                                  │    Duplicate     │
                                  │    Detector      │
                                  └──────────────────┘
                                            │
                                            ▼
                                  ┌──────────────────┐
                                  │    DATABASE      │
                                  │  + documents     │
                                  │  + events        │
                                  │  + brands        │
                                  └──────────────────┘
```

### Принцип работы

**1. Orchestrator** - главный координатор:
- Запускается по расписанию (GitHub Actions Cron или Supabase Cron)
- Определяет, какие промпты запускать сегодня (daily/weekly/monthly)
- Для каждого промпта запускает Search Pipeline
- Обновляет статус в `search_runs`
- Обрабатывает ошибки

**2. Search Pipeline** - последовательная обработка:
```
Source Hunter → Content Fetcher → Document Processor → 
→ Event Extractor → Embedding Generator → Criticality Scorer → 
→ Duplicate Detector → Save to DB
```

**3. Report Generator** - отдельный процесс:
- Работает с СУЩЕСТВУЮЩИМИ данными из БД
- Генерирует daily/weekly/monthly отчеты
- Сохраняет в таблицу `reports`
- Экспортирует в PDF/DOCX/Excel

---

## Детальное описание агентов

### Agent 1: Source Hunter

**Файл:** `supabase/functions/agents/source-hunter/index.ts`

**Назначение:** Определяет, ГДЕ искать информацию для данного промпта

**Входные данные:**
```typescript
interface SourceHunterInput {
  prompt: AIPrompt; // промпт из БД с параметрами
}
```

**Выходные данные:**
```typescript
interface SearchStrategy {
  prioritySources: Source[]; // VIP источники (priority >= 8)
  regularSources: Source[];  // Обычные источники
  webSearchQueries: string[]; // Дополнительные поисковые запросы
}
```

**Алгоритм:**

```typescript
async function sourceHunter(prompt: AIPrompt): Promise<SearchStrategy> {
  // 1. Получить источники по параметрам промпта
  const { data: sources } = await supabase
    .from('sources')
    .select(`
      *,
      source_urls(*),
      source_type:source_types(*)
    `)
    .eq('is_active', true)
    .eq('check_frequency', prompt.search_depth) // daily/weekly/monthly
    .order('priority', { ascending: false });
  
  // 2. Фильтровать по сегменту (если указан)
  let filteredSources = sources;
  if (prompt.segment_id) {
    // Источники, релевантные этому сегменту
    filteredSources = sources.filter(s => 
      isSourceRelevantForSegment(s, prompt.segment_id)
    );
  }
  
  // 3. Разделить на приоритетные и обычные
  const prioritySources = filteredSources.filter(s => s.priority >= 8);
  const regularSources = filteredSources.filter(s => s.priority < 8);
  
  // 4. Построить веб-поисковые запросы
  const webSearchQueries = buildWebSearchQueries(prompt);
  
  return {
    prioritySources,
    regularSources,
    webSearchQueries,
  };
}

function buildWebSearchQueries(prompt: AIPrompt): string[] {
  const queries: string[] = [];
  
  const segment = prompt.segment?.name || 'климатическое оборудование';
  const geography = prompt.geography?.name || 'Россия';
  const dateRange = getDateRangeText(prompt.search_depth);
  
  // Основные типы событий
  queries.push(`${segment} акции ${geography} ${dateRange}`);
  queries.push(`${segment} цены ${geography} ${dateRange}`);
  queries.push(`${segment} контракты ${geography} ${dateRange}`);
  queries.push(`${segment} новости ${geography} ${dateRange}`);
  
  return queries;
}

function getDateRangeText(depth: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date();
  if (depth === 'daily') return 'последние 24 часа';
  if (depth === 'weekly') return 'последняя неделя';
  return 'последний месяц';
}
```

**Метрики:**
- Время выполнения: ~1-2 секунды
- Стоимость: $0 (только запросы к БД)

---

### Agent 2: Content Fetcher

**Файл:** `supabase/functions/agents/content-fetcher/index.ts`

**Назначение:** Загружает реальный контент из источников

**Входные данные:**
```typescript
interface ContentFetcherInput {
  strategy: SearchStrategy; // от Source Hunter
}
```

**Выходные данные:**
```typescript
interface FetchedContent {
  source_id: string | null;
  source_url: string;
  type: 'news' | 'promo' | 'blog' | 'web-search';
  raw_content: string; // HTML или текст
  fetched_at: Date;
}[]
```

**Алгоритм:**

```typescript
async function contentFetcher(strategy: SearchStrategy): Promise<FetchedContent[]> {
  const content: FetchedContent[] = [];
  
  // 1. ПРИОРИТЕТНЫЕ источники - прямой fetch
  for (const source of strategy.prioritySources) {
    for (const sourceUrl of source.source_urls) {
      try {
        // Используем web_fetch (или axios/fetch)
        const response = await fetch(sourceUrl.url);
        const html = await response.text();
        
        content.push({
          source_id: source.id,
          source_url: sourceUrl.url,
          type: sourceUrl.url_type,
          raw_content: html,
          fetched_at: new Date(),
        });
        
        // Обновить last_checked_at в БД
        await supabase
          .from('source_urls')
          .update({ last_checked_at: new Date() })
          .eq('id', sourceUrl.id);
        
      } catch (error) {
        console.error(`Failed to fetch ${sourceUrl.url}:`, error);
        // Продолжаем с другими источниками
      }
    }
  }
  
  // 2. Обычные источники (лимит: топ-20 по priority)
  const topRegularSources = strategy.regularSources.slice(0, 20);
  for (const source of topRegularSources) {
    // Аналогично prioritySources
    // ... (код опущен для краткости)
  }
  
  // 3. WEB SEARCH через OpenAI (если нужно дополнить)
  for (const query of strategy.webSearchQueries) {
    try {
      const searchResults = await openAIWebSearch(query);
      
      // Фильтруем только релевантные домены
      const filtered = searchResults.filter(result => 
        isRelevantDomain(result.url)
      );
      
      // Фетчим топ-5 результатов
      for (const result of filtered.slice(0, 5)) {
        const response = await fetch(result.url);
        const html = await response.text();
        
        content.push({
          source_id: null,
          source_url: result.url,
          type: 'web-search',
          raw_content: html,
          fetched_at: new Date(),
        });
      }
      
    } catch (error) {
      console.error(`Web search failed for "${query}":`, error);
    }
  }
  
  return content;
}

// OpenAI Web Search через tool
async function openAIWebSearch(query: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `Найди информацию по запросу: "${query}". 
                  Верни топ-10 релевантных ссылок с кратким описанием каждой.`
      }
    ],
    tools: [{
      type: "web_search",
      name: "web_search"
    }]
  });
  
  // Обработать результаты и извлечь URLs
  return parseSearchResults(response);
}

function isRelevantDomain(url: string): boolean {
  const relevantDomains = [
    'rusklimate.ru',
    'daichi.ru',
    'midea.ru',
    'haier.ru',
    'avok.ru',
    'climatexpo.ru',
    'forbes.ru',
    'vedomosti.ru',
    'kommersant.ru',
    'rbc.ru',
  ];
  
  return relevantDomains.some(domain => url.includes(domain));
}
```

**Метрики:**
- Время выполнения: ~10-30 секунд (зависит от количества источников)
- Стоимость: ~$0.005-0.01 (OpenAI web_search)

---

### Agent 3: Document Processor (НОВЫЙ!)

**Файл:** `supabase/functions/agents/document-processor/index.ts`

**Назначение:** Обрабатывает и сохраняет ПОЛНЫЙ контент в БД + Storage

**Входные данные:**
```typescript
interface DocumentProcessorInput {
  content: FetchedContent[];
}
```

**Выходные данные:**
```typescript
interface ProcessedDocument {
  id: string;
  title: string;
  document_type: DocumentType;
  content_text: string;
  file_url?: string; // если PDF/PPTX
  brand_ids: string[];
  segment_ids: string[];
  geography_ids: string[];
  embedding: number[]; // 1536 floats
  events: Event[]; // извлеченные события
}[]
```

**Алгоритм:**

```typescript
async function documentProcessor(fetchedContent: FetchedContent[]): Promise<ProcessedDocument[]> {
  const processedDocuments: ProcessedDocument[] = [];
  
  for (const content of fetchedContent) {
    try {
      // 1. Определить тип документа
      const docType = detectDocumentType(content);
      
      // 2. Извлечь текст и сохранить файл (если нужно)
      let cleanText = '';
      let fileUrl: string | null = null;
      
      if (docType === 'pdf' || docType === 'presentation') {
        // Сохранить файл в Supabase Storage
        fileUrl = await uploadToStorage(content.raw_content, content.source_url);
        
        // Извлечь текст из PDF/PPTX
        cleanText = await extractTextFromFile(fileUrl, docType);
        
      } else {
        // HTML → чистый текст
        cleanText = htmlToText(content.raw_content);
      }
      
      // 3. Создать embedding для семантического поиска
      const embedding = await createEmbedding(cleanText);
      
      // 4. Извлечь упоминания брендов, сегментов, географии через AI
      const mentions = await extractMentions(cleanText);
      
      // 5. Сохранить документ в БД
      const { data: document } = await supabase
        .from('documents')
        .insert({
          title: extractTitle(content),
          description: extractSummary(cleanText),
          document_type: docType,
          content_text: cleanText.substring(0, 50000), // лимит для БД
          content_html: content.raw_content.substring(0, 100000),
          file_url: fileUrl,
          file_size: content.raw_content.length,
          file_format: detectFileFormat(content.source_url),
          source_id: content.source_id,
          source_url: content.source_url,
          published_date: extractDate(content),
          brand_ids: mentions.brand_ids,
          segment_ids: mentions.segment_ids,
          geography_ids: mentions.geography_ids,
          embedding: embedding,
          is_processed: true,
        })
        .select()
        .single();
      
      processedDocuments.push(document);
      
    } catch (error) {
      console.error(`Failed to process ${content.source_url}:`, error);
    }
  }
  
  return processedDocuments;
}

// Определение типа документа
function detectDocumentType(content: FetchedContent): DocumentType {
  const url = content.source_url.toLowerCase();
  
  if (url.endsWith('.pdf')) return 'pdf';
  if (url.endsWith('.pptx') || url.endsWith('.ppt')) return 'presentation';
  if (url.includes('/press-release') || url.includes('/news/')) return 'press-release';
  if (url.includes('/analytics') || url.includes('/report')) return 'analytics';
  
  // Анализируем HTML содержимое
  const text = content.raw_content.toLowerCase();
  if (text.includes('пресс-релиз') || text.includes('press release')) {
    return 'press-release';
  }
  if (text.includes('аналитический отчет') || text.includes('analytics')) {
    return 'analytics';
  }
  
  return 'article'; // по умолчанию
}

// Загрузка в Supabase Storage
async function uploadToStorage(content: string, originalUrl: string): Promise<string> {
  const fileName = `documents/${new Date().getFullYear()}/${
    new Date().getMonth() + 1
  }/${uuidv4()}_${extractFileName(originalUrl)}`;
  
  const { data, error } = await supabase.storage
    .from('market-documents')
    .upload(fileName, content, {
      contentType: detectMimeType(originalUrl),
      upsert: false,
    });
  
  if (error) throw error;
  
  // Получить публичный URL
  const { data: publicUrlData } = supabase.storage
    .from('market-documents')
    .getPublicUrl(fileName);
  
  return publicUrlData.publicUrl;
}

// Извлечение текста из PDF (пример с pdf-parse)
async function extractTextFromFile(fileUrl: string, docType: DocumentType): Promise<string> {
  if (docType === 'pdf') {
    // Скачиваем PDF
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    
    // Используем pdf-parse или аналог
    const pdf = await pdfParse(Buffer.from(buffer));
    return pdf.text;
  }
  
  if (docType === 'presentation') {
    // Используем mammoth или Apache Tika
    // Для PPTX нужна специальная библиотека
    // Можно использовать Google Cloud Document AI API
    return ''; // TODO: реализовать
  }
  
  return '';
}

// Конвертация HTML в чистый текст
function htmlToText(html: string): string {
  // Удаляем скрипты, стили
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Удаляем HTML теги
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Декодируем HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  
  // Удаляем лишние пробелы
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Создание embedding через OpenAI
async function createEmbedding(text: string): Promise<number[]> {
  // Ограничиваем длину текста (макс ~8000 токенов)
  const truncatedText = text.substring(0, 32000); // ~8000 tokens
  
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 dimensions
    input: truncatedText,
  });
  
  return response.data[0].embedding;
}

// Извлечение упоминаний брендов/сегментов/географии через AI
async function extractMentions(text: string): Promise<{
  brand_ids: string[];
  segment_ids: string[];
  geography_ids: string[];
}> {
  const prompt = `
Проанализируй текст и извлеки упоминания:

**БРЕНДЫ:** Daikin, Mitsubishi Electric, Haier, Midea, TCL, Gree, Ballu, Centek, Lessar, Royal Clima, Electrolux, LG, и другие производители климатической техники

**СЕГМЕНТЫ:** 
- RAC (бытовые кондиционеры, сплит-системы)
- VRF (мультизональные системы, Variable Refrigerant Flow)
- Chiller (чиллеры, промышленное холодильное оборудование)
- AHU (приточно-вытяжные установки)
- Вентиляция
- Тепловые насосы
- Промышленное тепловое оборудование

**ГЕОГРАФИЯ:** Москва, Санкт-Петербург, Екатеринбург, Новосибирск, Самара, Краснодар, Россия, федеральные округа

ТЕКСТ ДЛЯ АНАЛИЗА:
${text.substring(0, 4000)}

Верни ТОЛЬКО JSON (без markdown):
{
  "brands": ["Daikin", "Haier"],
  "segments": ["RAC", "VRF"],
  "geographies": ["Москва", "Россия"]
}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // дешевая модель для extraction
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });
  
  const mentions = JSON.parse(response.choices[0].message.content);
  
  // Конвертируем названия в UUID из БД
  const brand_ids = await getBrandIdsByNames(mentions.brands || []);
  const segment_ids = await getSegmentIdsByNames(mentions.segments || []);
  const geography_ids = await getGeographyIdsByNames(mentions.geographies || []);
  
  return { brand_ids, segment_ids, geography_ids };
}

// Вспомогательные функции для конвертации названий в UUID
async function getBrandIdsByNames(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  
  const { data } = await supabase
    .from('brands')
    .select('id')
    .in('name', names);
  
  return data?.map(b => b.id) || [];
}

async function getSegmentIdsByNames(codes: string[]): Promise<string[]> {
  if (codes.length === 0) return [];
  
  const { data } = await supabase
    .from('segments')
    .select('id')
    .in('code', codes);
  
  return data?.map(s => s.id) || [];
}

async function getGeographyIdsByNames(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  
  const { data } = await supabase
    .from('geographies')
    .select('id')
    .in('name', names);
  
  return data?.map(g => g.id) || [];
}

// Извлечение заголовка из контента
function extractTitle(content: FetchedContent): string {
  const html = content.raw_content;
  
  // Попытка найти <title>
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  
  // Попытка найти <h1>
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  
  // Используем URL как заголовок
  return content.source_url.split('/').pop() || 'Untitled';
}

// Извлечение краткого summary
function extractSummary(text: string): string {
  // Берем первые 200 символов
  return text.substring(0, 200) + '...';
}

// Извлечение даты публикации
function extractDate(content: FetchedContent): Date {
  // Можно парсить из HTML или использовать текущую дату
  return new Date();
}
```

**Метрики:**
- Время выполнения: ~20-60 секунд (зависит от количества документов)
- Стоимость: ~$0.01-0.02 (OpenAI embeddings + extraction)

---

### Agent 4: Event Extractor

**Файл:** `supabase/functions/agents/event-extractor/index.ts`

**Назначение:** Извлекает структурированные события из документов

**Входные данные:**
```typescript
interface EventExtractorInput {
  documents: ProcessedDocument[];
  prompt: AIPrompt; // для контекста
}
```

**Выходные данные:**
```typescript
interface ExtractedEvent {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  company: string;
  event_type: EventType;
  segment: string;
  geography: string;
  channel: Channel;
  key_figures: Record<string, any>; // { discount: "20%", contract_value: "100 млн" }
  document_id: string;
  source_url: string;
}[]
```

**Алгоритм:**

```typescript
async function eventExtractor(
  documents: ProcessedDocument[],
  prompt: AIPrompt
): Promise<ExtractedEvent[]> {
  const allEvents: ExtractedEvent[] = [];
  
  for (const doc of documents) {
    try {
      const text = doc.content_text;
      
      // Если текст слишком длинный - чанкуем
      const chunks = chunkText(text, 8000); // ~8000 tokens per chunk
      
      for (const chunk of chunks) {
        const extractionPrompt = buildExtractionPrompt(chunk, prompt, doc);
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.3, // низкая для точности
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT_EXTRACTOR
            },
            {
              role: "user",
              content: extractionPrompt
            }
          ],
          response_format: { type: "json_object" }
        });
        
        const extracted = JSON.parse(response.choices[0].message.content);
        
        // Добавляем метаданные
        for (const event of extracted.events || []) {
          allEvents.push({
            ...event,
            document_id: doc.id,
            source_url: doc.source_url,
          });
        }
      }
      
    } catch (error) {
      console.error(`Failed to extract events from document ${doc.id}:`, error);
    }
  }
  
  return allEvents;
}

const SYSTEM_PROMPT_EXTRACTOR = `
Ты - эксперт по извлечению структурированных данных о климатическом рынке России.

ЗАДАЧА: Из текста извлеки ВСЕ события, связанные с:
1. Маркетинговыми активностями (промо, акции, скидки, спецпредложения)
2. Изменениями цен
3. Изменениями условий оплаты/поставки/гарантии
4. Новыми продуктами и линейками
5. Крупными контрактами и проектами (B2B, B2G, B2C)
6. Стратегическими партнерствами (с девелоперами, ритейлом, корпорациями)
7. Открытием/расширением производств
8. Технологическими инновациями (IoT, инверторы, энергоэффективность)
9. Выставками и мероприятиями
10. Тендерами и госзаказами
11. PR-активностью и медиа-кампаниями
12. Изменениями в регулировании

ФОРМАТ ОТВЕТА (строго JSON, БЕЗ markdown):
{
  "events": [
    {
      "title": "Краткое название события (до 100 символов)",
      "description": "Детальное описание с датами, цифрами, фактами",
      "date": "YYYY-MM-DD",
      "company": "Название компании",
      "event_type": "promo|price|payment_terms|product|contract|partnership|production|tech|exhibition|tender|pr|regulation",
      "segment": "RAC|VRF|Chiller|AHU|Industrial|HeatPump|Ventilation|Refrigeration",
      "geography": "Москва|Россия|Санкт-Петербург|...",
      "channel": "B2B|B2G|B2C|B2B2C",
      "key_figures": {
        "discount": "10%",
        "contract_value": "100 млн руб",
        "duration": "до 31 декабря",
        "quantity": "500 единиц"
      }
    }
  ]
}

ПРАВИЛА:
1. Извлекай ТОЛЬКО факты, НЕТ домыслов и предположений
2. Если дата не указана явно - пропусти событие
3. Если нет конкретики (цифр, названий компаний) - НЕ включай
4. Одно событие = один объект в массиве
5. Все ключевые цифры помещай в key_figures
6. Если событие касается нескольких сегментов - укажи основной
7. НИКОГДА не выдумывай information - только то, что есть в тексте
`;

function buildExtractionPrompt(
  text: string,
  prompt: AIPrompt,
  doc: ProcessedDocument
): string {
  return `
КОНТЕКСТ ДОКУМЕНТА:
- Источник: ${doc.source_url}
- Тип: ${doc.document_type}
- Дата публикации: ${doc.published_date}

ФОКУС ПОИСКА (из промпта):
- Сегмент: ${prompt.segment?.name || 'все сегменты'}
- География: ${prompt.geography?.name || 'вся Россия'}
- Глубина: ${prompt.search_depth}

ЦЕЛЕВЫЕ КОМПАНИИ:
- Дистрибьюторы: Русклимат, Бриз, АЯК, КлиматПроф, Даичи
- Производители: MIDEA, Haier, TCL, Daikin, Mitsubishi, Gree, Ballu, Centek

ТЕКСТ ДЛЯ АНАЛИЗА:
${text}

Извлеки все релевантные события в формате JSON (без markdown backticks).
`;
}

// Разбивка текста на чанки
function chunkText(text: string, maxTokens: number): string[] {
  // Простая эвристика: ~4 символа = 1 токен
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChars;
    
    // Пытаемся найти границу параграфа
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n\n', end);
      if (lastNewline > start) {
        end = lastNewline;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end;
  }
  
  return chunks;
}
```

**Метрики:**
- Время выполнения: ~30-90 секунд
- Стоимость: ~$0.02-0.05 (зависит от объема текста)

---

### Agent 5: Embedding Generator

**Файл:** `supabase/functions/agents/embedding-generator/index.ts`

**Назначение:** Создает векторные представления для семантического поиска

**Примечание:** Уже встроен в Document Processor, но может использоваться отдельно для обновления существующих документов.

```typescript
async function embeddingGenerator(documentIds: string[]): Promise<void> {
  for (const docId of documentIds) {
    const { data: doc } = await supabase
      .from('documents')
      .select('content_text')
      .eq('id', docId)
      .single();
    
    if (!doc) continue;
    
    const embedding = await createEmbedding(doc.content_text);
    
    await supabase
      .from('documents')
      .update({ embedding })
      .eq('id', docId);
  }
}
```

---

### Agent 6: Criticality Scorer

**Файл:** `supabase/functions/agents/criticality-scorer/index.ts`

**Назначение:** Оценивает критичность событий (1-5)

**Алгоритм:** (как описано ранее - батчинг по 10 событий)

**Промпт:**

```typescript
const SYSTEM_PROMPT_SCORER = `
Ты - аналитик конкурентной разведки климатического рынка России.

ЗАДАЧА: Оцени критичность событий по шкале 1-5:

**1 - НИЗКАЯ (рутинные новости)**
- Обновления веб-сайтов
- Мелкие локальные акции (<5% скидка, один город)
- Незначительные анонсы без деталей
Примеры: "Обновлен каталог на сайте", "Акция -3% в Самаре"

**2 - СРЕДНЯЯ (локальные события)**
- Локальные промо-акции (скидки 5-15%, несколько городов)
- Небольшие контракты (<10 млн руб)
- Участие в мелких локальных мероприятиях
Примеры: "Скидка -10% на RAC в Екатеринбурге", "Контракт 5 млн на поставку"

**3 - ОБЫЧНАЯ (стандартные события)**
- Типовые промо-кампании (скидки 15-30%, федеральные)
- Средние контракты (10-50 млн руб)
- Участие в отраслевых выставках
- Запуск стандартных продуктов
Примеры: "Чёрная пятница -25%", "Контракт на 30 млн", "Участие в АВОК"

**4 - ВЫСОКАЯ (важные события)**
- Крупные сделки (50-500 млн руб)
- Стратегические партнерства (с девелоперами федерального уровня, крупным ритейлом)
- Крупные выставки (>500 участников)
- Запуск инновационных продуктов (IoT, энергоэффективность класса A+++)
- Открытие региональных представительств
Примеры: "Контракт с ПИК на 200 млн", "Партнерство с Леруа Мерлен", "Запуск IoT кондиционера"

**5 - КРИТИЧЕСКАЯ (индустриальные сдвиги)**
- Открытие/расширение производства в РФ
- Мега-контракты (>500 млн руб)
- Стратегические соглашения с застройщиками федерального масштаба (ПИК, Самолет, Эталон)
- Изменения технических регламентов, законов, ГОСТ
- Банкротство крупных игроков рынка
- Уход/приход крупных производителей на рынок
Примеры: "Haier открывает завод VRF в России", "Новый ГОСТ для кондиционеров", "Daikin объявил об уходе"

КОНТЕКСТ ДЛЯ ОЦЕНКИ:
- Масштаб (локальное=1-2, региональное=2-3, федеральное=3-4, индустриальное=5)
- Финансовый объем (если указан)
- Стратегическая важность (краткосрочная=1-3, долгосрочная=4-5)
- Влияние на конкуренцию (слабое=1-2, среднее=3, сильное=4-5)

ФОРМАТ ОТВЕТА (JSON):
{
  "scores": [
    {
      "event_index": 0,
      "criticality": 1-5,
      "reasoning": "краткое объяснение (1-2 предложения)",
      "factors": ["фактор1", "фактор2", "фактор3"]
    }
  ]
}
`;
```

---

### Agent 7: Duplicate Detector

**Файл:** `supabase/functions/agents/duplicate-detector/index.ts`

**Назначение:** Находит и объединяет повторяющиеся события

**Алгоритм:** (как описано ранее - cosine similarity через embeddings)

**Ключевые функции:**

```typescript
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

function mergeEvents(existing: Event, newEvent: ScoredEvent): Event {
  return {
    id: existing.id, // Сохраняем ID существующего
    
    // Берем лучшее описание (более детальное)
    description: newEvent.description.length > existing.description.length
      ? newEvent.description
      : existing.description,
    
    // Объединяем source_urls
    source_url: existing.source_url,
    additional_sources: [
      ...(existing.additional_sources || []),
      newEvent.source_url
    ],
    
    // Максимальная критичность
    criticality_level: Math.max(
      existing.criticality_level,
      newEvent.criticality_level
    ),
    
    // Обновляем detected_at
    detected_at: newEvent.detected_at,
    updated_at: new Date(),
    
    // Остальные поля - из существующего
    ...existing,
  };
}
```

**Порог дедупликации:** similarity > 0.85

---

### Agent 8: Report Generator

**Файл:** `supabase/functions/agents/report-generator/index.ts`

**Назначение:** Создает аналитические отчеты из существующих данных

**Типы отчетов:**

1. **Daily Digest** - оперативная сводка за день
2. **Weekly Analytics** - еженедельный аналитический отчет
3. **Monthly Summary** - месячная сводка с трендами

**Промпты для каждого типа:** (как описано ранее)

---

### Agent 9: Alert Manager

**Файл:** `supabase/functions/agents/alert-manager/index.ts`

**Назначение:** Отправляет уведомления о критичных событиях (criticality >= 4)

**Каналы уведомлений:**
- Telegram (приоритет)
- Email (админам)
- In-app alerts (таблица `alerts` в БД)

---

## Flow выполнения

### Daily Search Flow (ежедневный)

```
09:00 UTC - GitHub Actions Cron triggers Orchestrator
  │
  ├─ Orchestrator загружает активные daily промпты из БД
  │
  ├─ Для каждого промпта:
  │  │
  │  ├─ Создать search_run (status: 'running')
  │  │
  │  ├─ [Agent 1] Source Hunter (2 сек)
  │  │   Output: { prioritySources, regularSources, webQueries }
  │  │
  │  ├─ [Agent 2] Content Fetcher (15 сек)
  │  │   Output: [{ url, raw_content }, ...] (~20-50 документов)
  │  │
  │  ├─ [Agent 3] Document Processor (30 сек)
  │  │   - Сохранить в Storage (PDF/PPTX)
  │  │   - Сохранить в documents table
  │  │   - Создать embeddings
  │  │   Output: ProcessedDocument[]
  │  │
  │  ├─ [Agent 4] Event Extractor (40 сек)
  │  │   - Извлечь события из документов
  │  │   Output: ExtractedEvent[] (~10-50 событий)
  │  │
  │  ├─ [Agent 6] Criticality Scorer (10 сек)
  │  │   - Оценить критичность каждого
  │  │   Output: ScoredEvent[]
  │  │
  │  ├─ [Agent 7] Duplicate Detector (15 сек)
  │  │   - Найти дубликаты в БД
  │  │   - Мерджить или создать новые
  │  │   Output: FinalEvent[]
  │  │
  │  ├─ Сохранить в events table
  │  │
  │  ├─ Обновить search_run (status: 'success', events_found: N)
  │  │
  │  └─ [Agent 9] Alert Manager (если criticality >= 4)
  │      - Telegram уведомления
  │      - Email админам
  │
  └─ ИТОГО на 1 промпт: ~120 секунд (2 минуты)
     ИТОГО на 10 промптов: ~20 минут
```

### Weekly Report Flow (еженедельный)

```
Пятница 18:00 UTC - Cron triggers Report Generator
  │
  ├─ Report Generator (weekly-analytics)
  │
  ├─ Query events from DB (last 7 days)
  │  SELECT * FROM events WHERE date >= NOW() - INTERVAL '7 days'
  │
  ├─ Query documents from DB (для контекста)
  │
  ├─ AI анализ (GPT-4o)
  │  - Executive Summary
  │  - Ключевые события
  │  - Тренды и паттерны
  │  - Конкурентный анализ
  │  - Рекомендации
  │
  ├─ Генерация Markdown отчета
  │
  ├─ Сохранить в reports table
  │
  └─ Конвертация в PDF/DOCX (опционально)
     - Upload to Storage
     - Update report.pdf_url
```

### Custom Prompt Flow (по требованию)

```
User в UI → Custom Prompt Builder → Создание промпта
  │
  ├─ Сохранить в custom_prompts (status: 'pending')
  │
  ├─ Trigger Custom Prompt Runner
  │
  ├─ Определить, нужен ли новый поиск или достаточно данных в БД
  │
  ├─ Если данных достаточно:
  │  └─ Query DB с фильтрами (brands, segments, geographies, dates)
  │     → Генерация отчета → Вернуть пользователю
  │
  └─ Если нужен новый поиск:
     ├─ Запустить Search Pipeline (как Daily Search)
     └─ Генерация отчета → Вернуть пользователю
```

---

## Custom Prompts система

### UI: Custom Prompt Builder

**Компонент:** `CustomPromptBuilder.tsx`

**Шаги:**

1. **Выбор цели:**
   - "Найти события" (events)
   - "Проанализировать тренды" (analysis)
   - "Сравнить конкурентов" (comparison)

2. **Фильтры:**
   - Multi-select: Бренды (из справочника brands)
   - Multi-select: Сегменты (из справочника segments)
   - Multi-select: География (из справочника geographies)
   - Multi-select: Типы событий (promo, price, contract, ...)
   - Date range: Период

3. **Дополнительные инструкции:**
   - Textarea: "Фокус на IoT решениях", "Сравни с Q3 2024"

4. **Формат результата:**
   - Таблица
   - Аналитический отчет
   - Ключевые инсайты

**Генерация промпта:**

```typescript
function buildCustomPrompt(params: CustomPromptParams): string {
  let prompt = '';
  
  // Цель
  if (params.goal === 'find-events') {
    prompt = `Найди все события за период ${params.date_from} - ${params.date_to}`;
  } else if (params.goal === 'analyze-trends') {
    prompt = `Проанализируй тренды и паттерны за период ${params.date_from} - ${params.date_to}`;
  } else {
    prompt = `Сравни активность конкурентов за период ${params.date_from} - ${params.date_to}`;
  }
  
  // Фильтры
  if (params.brands.length > 0) {
    prompt += `\nБренды: ${params.brands.map(b => b.name).join(', ')}`;
  }
  if (params.segments.length > 0) {
    prompt += `\nСегменты: ${params.segments.map(s => s.name).join(', ')}`;
  }
  if (params.geographies.length > 0) {
    prompt += `\nГеография: ${params.geographies.map(g => g.name).join(', ')}`;
  }
  if (params.event_types.length > 0) {
    prompt += `\nТипы событий: ${params.event_types.join(', ')}`;
  }
  
  // Кастомные инструкции
  if (params.custom_instructions) {
    prompt += `\n\nДополнительно:\n${params.custom_instructions}`;
  }
  
  // Формат
  if (params.output_format === 'table') {
    prompt += `\n\nВерни результаты в виде таблицы.`;
  } else if (params.output_format === 'report') {
    prompt += `\n\nСоздай детальный аналитический отчет.`;
  }
  
  return prompt;
}
```

### Библиотека сохраненных промптов

**Таблица:** `custom_prompts` где `is_saved = true`

**UI:**
- Список сохраненных промптов
- Кнопка "Использовать"
- Кнопка "Редактировать"
- Кнопка "Запустить сейчас"

---

## Админ-панель для справочников

### Модули

```
/frontend/src/modules/admin/
├─ sources/          ✅ Phase 3 (уже в плане)
│  ├─ SourcesManager.tsx
│  ├─ SourceFormModal.tsx
│  └─ SourceUrlsManager.tsx
│
├─ brands/           🆕 НОВЫЙ
│  ├─ BrandsManager.tsx
│  ├─ BrandFormModal.tsx
│  └─ BrandSegmentsManager.tsx
│
├─ segments/         🆕 НОВЫЙ
│  ├─ SegmentsManager.tsx
│  └─ SegmentFormModal.tsx
│
├─ geographies/      🆕 НОВЫЙ
│  ├─ GeographiesManager.tsx
│  └─ GeographyFormModal.tsx
│
└─ documents/        🆕 НОВЫЙ
   ├─ DocumentsLibrary.tsx    (просмотр сохраненных)
   ├─ DocumentUploader.tsx    (загрузка своих)
   └─ DocumentViewer.tsx      (просмотр PDF/DOCX)
```

### Edge Functions для CRUD

**Требуются новые Edge Functions:**

1. `brands-api` - CRUD для brands и brand_segments
2. `segments-api` - CRUD для segments (уже в плане Phase 3)
3. `geographies-api` - CRUD для geographies (уже в плане Phase 3)
4. `documents-api` - CRUD для documents (просмотр, поиск, удаление)

---

## LLM Provider Management (Управление AI провайдерами)

### Обзор

**Проблема:** Разные AI модели лучше справляются с разными задачами. Например:
- Perplexity - отлично для веб-поиска и сбора данных
- GPT-4o - оптимален для извлечения структурированных данных
- GPT-4o-mini - дешевый для простых задач (mentions extraction)
- Claude Opus 4 - премиум качество для сложных аналитических отчетов

**Решение:** Система управления LLM провайдерами позволяет:
- Добавлять несколько AI провайдеров (OpenAI, Anthropic, Perplexity, Google)
- Конфигурировать, какая модель используется для какой задачи
- Безопасно хранить API ключи (pgcrypto шифрование)
- A/B тестировать разные модели
- Отслеживать стоимость и качество
- Автоматический fallback при ошибках

### Архитектура

```
┌─────────────────────────────────────────────────────┐
│        ADMIN UI (LLM Configuration)                 │
│  - Управление провайдерами                          │
│  - Настройка API ключей (зашифровано)               │
│  - Конфигурация задач                               │
│  - Статистика использования                         │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│         Edge Function: llm-providers-api            │
│  - Шифрование API ключей (pgp_sym_encrypt)         │
│  - CRUD для провайдеров и моделей                   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                  │
│  - llm_providers (encrypted API keys)               │
│  - llm_models (pricing, capabilities)               │
│  - llm_task_configs (primary, fallback, A/B)        │
│  - llm_usage_logs (cost tracking)                   │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│        UniversalLLMClient (Shared Library)          │
│  - Единый интерфейс для всех провайдеров            │
│  - Автоматический выбор модели                      │
│  - Расшифровка API ключей                           │
│  - Логирование использования                        │
│  - Fallback на резервную модель                     │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ OpenAI  │      │Anthropic│      │Perplexity│
   │   API   │      │   API   │      │   API   │
   └─────────┘      └─────────┘      └─────────┘
```

### База данных (Migration 008)

#### 1. Таблица `llm_providers` - провайдеры AI

```sql
-- Включаем pgcrypto для шифрования
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE llm_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Основная информация
  name TEXT NOT NULL UNIQUE, -- "OpenAI", "Anthropic", "Perplexity"
  code TEXT NOT NULL UNIQUE, -- "openai", "anthropic", "perplexity"
  api_endpoint TEXT, -- "https://api.openai.com/v1"

  -- API ключ (зашифрованный через pgcrypto)
  api_key_encrypted TEXT, -- pgp_sym_encrypt(api_key, encryption_key)
  api_key_last_4 TEXT, -- Последние 4 символа для UI: "...ab12"
  api_key_updated_at TIMESTAMP,

  -- Статус
  is_active BOOLEAN DEFAULT true,

  -- Метаданные
  metadata JSONB, -- { rate_limit: "3500 RPM", region: "us-east" }

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_llm_providers_code ON llm_providers(code);
CREATE INDEX idx_llm_providers_active ON llm_providers(is_active);

-- Триггер updated_at
CREATE TRIGGER update_llm_providers_updated_at
  BEFORE UPDATE ON llm_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view providers (without keys)"
  ON llm_providers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage providers"
  ON llm_providers FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Seed данные:**

```sql
INSERT INTO llm_providers (name, code, api_endpoint, is_active) VALUES
('OpenAI', 'openai', 'https://api.openai.com/v1', true),
('Anthropic', 'anthropic', 'https://api.anthropic.com/v1', true),
('Perplexity', 'perplexity', 'https://api.perplexity.ai', true),
('Google AI', 'google', 'https://generativelanguage.googleapis.com/v1', true);
```

#### 2. Таблица `llm_models` - модели с ценами

```sql
CREATE TABLE llm_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES llm_providers(id) ON DELETE CASCADE,

  -- Основная информация
  name TEXT NOT NULL, -- "GPT-4o", "Claude Opus 4", "Perplexity Sonar"
  code TEXT NOT NULL, -- "gpt-4o", "claude-opus-4", "sonar-pro"

  -- Технические характеристики
  context_window INTEGER, -- 128000 для GPT-4o
  max_output_tokens INTEGER, -- 16384

  -- Pricing (за 1 миллион токенов)
  input_price_per_million DECIMAL(10, 4), -- $2.50
  output_price_per_million DECIMAL(10, 4), -- $10.00

  -- Возможности
  supports_json_mode BOOLEAN DEFAULT false,
  supports_function_calling BOOLEAN DEFAULT false,
  supports_vision BOOLEAN DEFAULT false,
  supports_web_search BOOLEAN DEFAULT false,

  -- Рекомендации использования
  recommended_for TEXT[], -- ["extraction", "analysis", "scoring"]

  -- Статус
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(provider_id, code)
);

-- Индексы
CREATE INDEX idx_llm_models_provider ON llm_models(provider_id);
CREATE INDEX idx_llm_models_active ON llm_models(is_active);
CREATE INDEX idx_llm_models_recommended ON llm_models USING GIN(recommended_for);

-- RLS
ALTER TABLE llm_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view models"
  ON llm_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage models"
  ON llm_models FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Seed данные:**

```sql
WITH provider_ids AS (
  SELECT id, code FROM llm_providers
)
INSERT INTO llm_models (
  provider_id,
  name,
  code,
  context_window,
  max_output_tokens,
  input_price_per_million,
  output_price_per_million,
  supports_json_mode,
  supports_function_calling,
  supports_web_search,
  recommended_for
)
-- OpenAI модели
SELECT
  p.id,
  'GPT-4o',
  'gpt-4o',
  128000,
  16384,
  2.50,
  10.00,
  true,
  true,
  true,
  ARRAY['extraction', 'analysis', 'scoring', 'web_search']
FROM provider_ids p WHERE p.code = 'openai'

UNION ALL

SELECT
  p.id,
  'GPT-4o-mini',
  'gpt-4o-mini',
  128000,
  16384,
  0.15,
  0.60,
  true,
  true,
  false,
  ARRAY['mentions', 'simple_extraction', 'classification']
FROM provider_ids p WHERE p.code = 'openai'

UNION ALL

SELECT
  p.id,
  'text-embedding-3-small',
  'text-embedding-3-small',
  8191,
  NULL,
  0.02,
  0.00,
  false,
  false,
  false,
  ARRAY['embeddings', 'semantic_search']
FROM provider_ids p WHERE p.code = 'openai'

UNION ALL

-- Anthropic модели
SELECT
  p.id,
  'Claude Opus 4.5',
  'claude-opus-4-5-20251101',
  200000,
  16384,
  15.00,
  75.00,
  true,
  true,
  false,
  ARRAY['complex_analysis', 'report_generation', 'strategic_insights']
FROM provider_ids p WHERE p.code = 'anthropic'

UNION ALL

SELECT
  p.id,
  'Claude Sonnet 4.5',
  'claude-sonnet-4-5-20250929',
  200000,
  16384,
  3.00,
  15.00,
  true,
  true,
  false,
  ARRAY['analysis', 'extraction', 'scoring']
FROM provider_ids p WHERE p.code = 'anthropic'

UNION ALL

-- Perplexity модели
SELECT
  p.id,
  'Perplexity Sonar Pro',
  'sonar-pro',
  127072,
  8192,
  3.00,
  15.00,
  true,
  false,
  true,
  ARRAY['web_search', 'data_collection', 'fact_checking']
FROM provider_ids p WHERE p.code = 'perplexity'

UNION ALL

SELECT
  p.id,
  'Perplexity Sonar',
  'sonar',
  127072,
  8192,
  1.00,
  1.00,
  true,
  false,
  true,
  ARRAY['web_search', 'quick_search']
FROM provider_ids p WHERE p.code = 'perplexity'

UNION ALL

-- Google модели
SELECT
  p.id,
  'Gemini 1.5 Pro',
  'gemini-1.5-pro',
  1000000,
  8192,
  1.25,
  5.00,
  true,
  true,
  true,
  ARRAY['long_context', 'multimodal']
FROM provider_ids p WHERE p.code = 'google'

UNION ALL

SELECT
  p.id,
  'Gemini 1.5 Flash',
  'gemini-1.5-flash',
  1000000,
  8192,
  0.075,
  0.30,
  true,
  true,
  false,
  ARRAY['fast_extraction', 'classification']
FROM provider_ids p WHERE p.code = 'google';
```

#### 3. Таблица `llm_task_configs` - конфигурация задач

```sql
CREATE TABLE llm_task_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Тип задачи
  task_type TEXT NOT NULL UNIQUE, -- "web_search", "extraction", "scoring", etc.
  task_description TEXT,

  -- Основная модель
  primary_model_id UUID REFERENCES llm_models(id),

  -- Резервная модель (fallback при ошибке)
  fallback_model_id UUID REFERENCES llm_models(id),

  -- A/B тестирование
  enable_ab_testing BOOLEAN DEFAULT false,
  ab_test_model_id UUID REFERENCES llm_models(id),
  ab_test_percentage INTEGER DEFAULT 10, -- процент запросов для A/B теста

  -- Параметры
  temperature DECIMAL(3, 2) DEFAULT 0.5,
  max_tokens INTEGER,

  -- Метаданные
  metadata JSONB, -- { retry_count: 3, timeout: 30000 }

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_llm_task_configs_task ON llm_task_configs(task_type);

-- Триггер
CREATE TRIGGER update_llm_task_configs_updated_at
  BEFORE UPDATE ON llm_task_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE llm_task_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view task configs"
  ON llm_task_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage task configs"
  ON llm_task_configs FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Seed данные (примеры конфигураций):**

```sql
-- Вспомогательная функция для получения model_id по коду
CREATE OR REPLACE FUNCTION get_model_id(provider_code TEXT, model_code TEXT)
RETURNS UUID AS $$
  SELECT m.id
  FROM llm_models m
  JOIN llm_providers p ON m.provider_id = p.id
  WHERE p.code = provider_code AND m.code = model_code
$$ LANGUAGE SQL;

-- Конфигурации задач
INSERT INTO llm_task_configs (
  task_type,
  task_description,
  primary_model_id,
  fallback_model_id,
  enable_ab_testing,
  ab_test_model_id,
  ab_test_percentage,
  temperature,
  max_tokens
) VALUES
(
  'web_search',
  'Веб-поиск источников через search engine',
  get_model_id('perplexity', 'sonar-pro'),
  get_model_id('openai', 'gpt-4o'),
  true,
  get_model_id('google', 'gemini-1.5-pro'),
  20,
  0.3,
  4096
),
(
  'event_extraction',
  'Извлечение структурированных событий из текста',
  get_model_id('openai', 'gpt-4o'),
  get_model_id('anthropic', 'claude-sonnet-4-5-20250929'),
  false,
  NULL,
  0,
  0.3,
  16384
),
(
  'criticality_scoring',
  'Оценка критичности событий (1-5)',
  get_model_id('openai', 'gpt-4o'),
  get_model_id('anthropic', 'claude-sonnet-4-5-20250929'),
  false,
  NULL,
  0,
  0.2,
  2048
),
(
  'mentions_extraction',
  'Извлечение упоминаний брендов/сегментов/географии',
  get_model_id('openai', 'gpt-4o-mini'),
  get_model_id('google', 'gemini-1.5-flash'),
  false,
  NULL,
  0,
  0.0,
  1024
),
(
  'duplicate_detection',
  'Определение дубликатов событий',
  get_model_id('openai', 'gpt-4o'),
  get_model_id('google', 'gemini-1.5-pro'),
  false,
  NULL,
  0,
  0.1,
  2048
),
(
  'report_generation',
  'Генерация аналитических отчетов (высокое качество)',
  get_model_id('anthropic', 'claude-opus-4-5-20251101'),
  get_model_id('anthropic', 'claude-sonnet-4-5-20250929'),
  true,
  get_model_id('openai', 'gpt-4o'),
  10,
  0.7,
  16384
),
(
  'embeddings',
  'Создание векторных представлений для семантического поиска',
  get_model_id('openai', 'text-embedding-3-small'),
  NULL,
  false,
  NULL,
  0,
  NULL,
  NULL
);

-- Удаляем вспомогательную функцию
DROP FUNCTION get_model_id(TEXT, TEXT);
```

#### 4. Таблица `llm_usage_logs` - логирование использования

```sql
CREATE TABLE llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Ссылка на модель
  model_id UUID REFERENCES llm_models(id),
  task_type TEXT,

  -- Метрики
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,

  -- Стоимость (рассчитывается автоматически)
  cost_usd DECIMAL(10, 6),

  -- Производительность
  latency_ms INTEGER,

  -- Качество (для A/B тестирования)
  was_ab_test BOOLEAN DEFAULT false,
  quality_score INTEGER, -- 1-5, опционально для A/B тестов

  -- Статус
  status TEXT CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,

  -- Метаданные запроса
  metadata JSONB, -- { search_run_id, document_id, event_id, etc. }

  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Индексы
CREATE INDEX idx_llm_usage_logs_model ON llm_usage_logs(model_id);
CREATE INDEX idx_llm_usage_logs_task ON llm_usage_logs(task_type);
CREATE INDEX idx_llm_usage_logs_created ON llm_usage_logs(created_at DESC);
CREATE INDEX idx_llm_usage_logs_ab_test ON llm_usage_logs(was_ab_test) WHERE was_ab_test = true;

-- RLS
ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all usage logs"
  ON llm_usage_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert usage logs"
  ON llm_usage_logs FOR INSERT TO authenticated
  WITH CHECK (true);
```

### Функции для шифрования/расшифровки API ключей

```sql
-- Функция для шифрования API ключа
CREATE OR REPLACE FUNCTION encrypt_api_key(
  api_key TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(api_key, encryption_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для расшифровки API ключа
CREATE OR REPLACE FUNCTION decrypt_api_key(
  encrypted_api_key TEXT,
  encryption_key TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_api_key, 'base64'), encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для использования в Edge Functions
CREATE OR REPLACE FUNCTION decrypt_provider_api_key(
  provider_id UUID,
  encryption_key TEXT
) RETURNS TEXT AS $$
DECLARE
  encrypted_key TEXT;
BEGIN
  SELECT api_key_encrypted INTO encrypted_key
  FROM llm_providers
  WHERE id = provider_id AND is_active = true;

  IF encrypted_key IS NULL THEN
    RAISE EXCEPTION 'Provider not found or inactive';
  END IF;

  RETURN decrypt_api_key(encrypted_key, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Backend: Shared CORS Configuration (ВАЖНО!)

**Файл:** `supabase/functions/_shared/cors.ts`

```typescript
// Общие CORS заголовки для всех Edge Functions
// Рекомендация: Supabase больше НЕ предоставляет настройки CORS через Dashboard
// CORS обрабатывается вручную в коде каждой функции
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**Примечание:**
- ⚠️ **Supabase убрал настройки CORS из Dashboard** (2024-2025)
- ✅ **CORS headers должны быть в коде каждой функции**
- ✅ **OPTIONS запрос ВСЕГДА должен обрабатываться ПЕРВЫМ**
- 📖 См. [официальную документацию](https://supabase.com/docs/guides/functions/cors)

---

### Backend: Edge Function `llm-providers-api`

**Файл:** `supabase/functions/llm-providers-api/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts'; // Используем общий файл

serve(async (req) => {
  // ⚠️ ВАЖНО: OPTIONS должен быть ПЕРВЫМ!
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const method = req.method;

    // GET /llm-providers - список провайдеров (БЕЗ ключей)
    if (method === 'GET' && url.pathname === '/llm-providers') {
      const { data, error } = await supabase
        .from('llm_providers')
        .select('id, name, code, api_endpoint, is_active, api_key_last_4, api_key_updated_at, metadata, created_at, updated_at')
        .order('name');

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /llm-providers - создать провайдера с зашифрованным ключом
    if (method === 'POST' && url.pathname === '/llm-providers') {
      const body = await req.json();
      const { name, code, api_endpoint, api_key } = body;

      if (!name || !code || !api_key) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured');
      }

      // Шифруем API ключ
      const { data: encryptedData } = await supabase.rpc('encrypt_api_key', {
        api_key,
        encryption_key: encryptionKey,
      });

      const api_key_last_4 = api_key.slice(-4);

      const { data, error } = await supabase
        .from('llm_providers')
        .insert({
          name,
          code,
          api_endpoint,
          api_key_encrypted: encryptedData,
          api_key_last_4,
          api_key_updated_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Не возвращаем зашифрованный ключ
      delete data.api_key_encrypted;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    }

    // PATCH /llm-providers/:id/api-key - обновить API ключ
    if (method === 'PATCH' && url.pathname.match(/^\/llm-providers\/[^/]+\/api-key$/)) {
      const providerId = url.pathname.split('/')[2];
      const body = await req.json();
      const { api_key } = body;

      if (!api_key) {
        return new Response(
          JSON.stringify({ error: 'Missing api_key' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY not configured');
      }

      // Шифруем новый ключ
      const { data: encryptedData } = await supabase.rpc('encrypt_api_key', {
        api_key,
        encryption_key: encryptionKey,
      });

      const api_key_last_4 = api_key.slice(-4);

      const { data, error } = await supabase
        .from('llm_providers')
        .update({
          api_key_encrypted: encryptedData,
          api_key_last_4,
          api_key_updated_at: new Date().toISOString(),
        })
        .eq('id', providerId)
        .select()
        .single();

      if (error) throw error;

      delete data.api_key_encrypted;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE /llm-providers/:id - удалить провайдера
    if (method === 'DELETE' && url.pathname.match(/^\/llm-providers\/[^/]+$/)) {
      const providerId = url.pathname.split('/')[2];

      const { error } = await supabase
        .from('llm_providers')
        .delete()
        .eq('id', providerId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Backend: UniversalLLMClient (Shared Library)

**Файл:** `supabase/functions/_shared/universal-llm-client.ts`

```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0';

export interface LLMRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' } | null;
}

export interface LLMResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;
  model: string;
  latency_ms: number;
}

export class UniversalLLMClient {
  constructor(
    private supabase: SupabaseClient,
    private taskType: string,
    private encryptionKey: string
  ) {}

  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // 1. Получить конфигурацию для этого типа задачи
      const config = await this.getTaskConfig();

      // 2. Выбрать модель (primary или A/B тест)
      const modelId = this.selectModel(config);

      // 3. Получить данные модели и провайдера
      const { model, provider } = await this.getModelAndProvider(modelId);

      // 4. Расшифровать API ключ
      const apiKey = await this.decryptApiKey(provider.id);

      // 5. Вызвать соответствующий API
      let response: LLMResponse;

      switch (provider.code) {
        case 'openai':
          response = await this.callOpenAI(model, apiKey, request, config);
          break;
        case 'anthropic':
          response = await this.callAnthropic(model, apiKey, request, config);
          break;
        case 'perplexity':
          response = await this.callPerplexity(model, apiKey, request, config);
          break;
        case 'google':
          response = await this.callGoogle(model, apiKey, request, config);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider.code}`);
      }

      response.latency_ms = Date.now() - startTime;

      // 6. Логировать использование
      await this.logUsage(model, response, 'success');

      return response;

    } catch (error) {
      const latency_ms = Date.now() - startTime;

      // Попытка fallback
      const config = await this.getTaskConfig();
      if (config.fallback_model_id) {
        console.warn(`Primary model failed, trying fallback...`);

        try {
          const fallbackResponse = await this.callWithModel(config.fallback_model_id, request);
          await this.logUsage(null, fallbackResponse, 'success', 'fallback_used');
          return fallbackResponse;
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      }

      // Логируем ошибку
      await this.logError(error.message, latency_ms);

      throw error;
    }
  }

  private selectModel(config: any): string {
    // A/B тестирование
    if (config.enable_ab_testing && config.ab_test_model_id) {
      const random = Math.random() * 100;
      if (random < config.ab_test_percentage) {
        return config.ab_test_model_id;
      }
    }

    return config.primary_model_id;
  }

  private async getTaskConfig() {
    const { data, error } = await this.supabase
      .from('llm_task_configs')
      .select('*')
      .eq('task_type', this.taskType)
      .single();

    if (error || !data) {
      throw new Error(`Task config not found for: ${this.taskType}`);
    }

    return data;
  }

  private async getModelAndProvider(modelId: string) {
    const { data, error } = await this.supabase
      .from('llm_models')
      .select(`
        *,
        provider:llm_providers(*)
      `)
      .eq('id', modelId)
      .single();

    if (error || !data) {
      throw new Error(`Model not found: ${modelId}`);
    }

    return { model: data, provider: data.provider };
  }

  private async decryptApiKey(providerId: string): Promise<string> {
    const { data, error } = await this.supabase.rpc('decrypt_provider_api_key', {
      provider_id: providerId,
      encryption_key: this.encryptionKey,
    });

    if (error || !data) {
      throw new Error('Failed to decrypt API key');
    }

    return data;
  }

  private async callOpenAI(
    model: any,
    apiKey: string,
    request: LLMRequest,
    config: any
  ): Promise<LLMResponse> {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: model.code,
      messages: request.messages as any,
      temperature: request.temperature ?? config.temperature,
      max_tokens: request.max_tokens ?? config.max_tokens,
      response_format: request.response_format,
    });

    const usage = completion.usage!;

    return {
      content: completion.choices[0].message.content || '',
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      cost_usd: this.calculateCost(model, usage.prompt_tokens, usage.completion_tokens),
      model: model.code,
      latency_ms: 0, // будет установлено позже
    };
  }

  private async callAnthropic(
    model: any,
    apiKey: string,
    request: LLMRequest,
    config: any
  ): Promise<LLMResponse> {
    const anthropic = new Anthropic({ apiKey });

    // Конвертируем формат OpenAI в Anthropic
    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');

    const response = await anthropic.messages.create({
      model: model.code,
      system: systemMessage?.content,
      messages: userMessages as any,
      temperature: request.temperature ?? config.temperature,
      max_tokens: request.max_tokens ?? config.max_tokens ?? 4096,
    });

    const usage = response.usage;

    return {
      content: response.content[0].type === 'text' ? response.content[0].text : '',
      usage: {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: usage.input_tokens + usage.output_tokens,
      },
      cost_usd: this.calculateCost(model, usage.input_tokens, usage.output_tokens),
      model: model.code,
      latency_ms: 0,
    };
  }

  private async callPerplexity(
    model: any,
    apiKey: string,
    request: LLMRequest,
    config: any
  ): Promise<LLMResponse> {
    // Perplexity использует OpenAI-совместимый API
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.code,
        messages: request.messages,
        temperature: request.temperature ?? config.temperature,
        max_tokens: request.max_tokens ?? config.max_tokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();
    const usage = data.usage;

    return {
      content: data.choices[0].message.content,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      cost_usd: this.calculateCost(model, usage.prompt_tokens, usage.completion_tokens),
      model: model.code,
      latency_ms: 0,
    };
  }

  private async callGoogle(
    model: any,
    apiKey: string,
    request: LLMRequest,
    config: any
  ): Promise<LLMResponse> {
    // Google Generative AI implementation
    // TODO: Implement using Google's SDK
    throw new Error('Google provider not yet implemented');
  }

  private calculateCost(model: any, promptTokens: number, completionTokens: number): number {
    const inputCost = (promptTokens / 1_000_000) * parseFloat(model.input_price_per_million);
    const outputCost = (completionTokens / 1_000_000) * parseFloat(model.output_price_per_million);
    return inputCost + outputCost;
  }

  private async logUsage(
    model: any | null,
    response: LLMResponse,
    status: string,
    notes?: string
  ) {
    await this.supabase.from('llm_usage_logs').insert({
      model_id: model?.id,
      task_type: this.taskType,
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
      cost_usd: response.cost_usd,
      latency_ms: response.latency_ms,
      status,
      metadata: notes ? { notes } : null,
    });
  }

  private async logError(errorMessage: string, latency_ms: number) {
    await this.supabase.from('llm_usage_logs').insert({
      task_type: this.taskType,
      latency_ms,
      status: 'error',
      error_message: errorMessage,
    });
  }

  private async callWithModel(modelId: string, request: LLMRequest): Promise<LLMResponse> {
    const { model, provider } = await this.getModelAndProvider(modelId);
    const apiKey = await this.decryptApiKey(provider.id);
    const config = await this.getTaskConfig();

    switch (provider.code) {
      case 'openai':
        return this.callOpenAI(model, apiKey, request, config);
      case 'anthropic':
        return this.callAnthropic(model, apiKey, request, config);
      case 'perplexity':
        return this.callPerplexity(model, apiKey, request, config);
      case 'google':
        return this.callGoogle(model, apiKey, request, config);
      default:
        throw new Error(`Unsupported provider: ${provider.code}`);
    }
  }
}
```

**Пример использования в агентах:**

```typescript
// В любом Edge Function
import { UniversalLLMClient } from '../_shared/universal-llm-client.ts';

const llmClient = new UniversalLLMClient(
  supabase,
  'event_extraction', // тип задачи
  Deno.env.get('ENCRYPTION_KEY')!
);

const response = await llmClient.call({
  messages: [
    {
      role: 'system',
      content: 'Ты - эксперт по извлечению событий...'
    },
    {
      role: 'user',
      content: documentText
    }
  ],
  temperature: 0.3,
  max_tokens: 16384,
  response_format: { type: 'json_object' }
});

const events = JSON.parse(response.content);
```

### Frontend: Admin UI компоненты

#### 1. ProviderApiKeyModal - безопасный ввод ключа

**Файл:** `frontend/src/modules/admin/llm-config/ProviderApiKeyModal.tsx`

```typescript
import { Modal, Form, Input, Alert, Typography } from 'antd';
import { useState } from 'react';

interface ProviderApiKeyModalProps {
  provider: {
    id: string;
    name: string;
    code: string;
    api_key_last_4?: string;
  };
  visible: boolean;
  onCancel: () => void;
  onSave: (apiKey: string) => Promise<void>;
}

export const ProviderApiKeyModal: React.FC<ProviderApiKeyModalProps> = ({
  provider,
  visible,
  onCancel,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      await onSave(values.api_key);
      form.resetFields();
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Настройка API ключа для ${provider.name}`}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Alert
        message="🔐 Безопасность API ключа"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Ключ будет зашифрован через <code>pgp_sym_encrypt</code> перед сохранением в БД</li>
            <li>
              После сохранения вы увидите только:{' '}
              <code>********{provider.api_key_last_4 || 'xxxx'}</code>
            </li>
            <li>Для изменения ключа нужно ввести новый ключ <strong>полностью</strong></li>
            <li>Ключ никогда не передается в API ответах</li>
          </ul>
        }
        type="info"
        style={{ marginBottom: 16 }}
      />

      {provider.api_key_last_4 && (
        <Alert
          message={`Текущий ключ: ********${provider.api_key_last_4}`}
          type="success"
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          name="api_key"
          label={`${provider.name} API Key`}
          rules={[
            { required: true, message: 'Введите API ключ' },
            { min: 20, message: 'API ключ слишком короткий' },
          ]}
        >
          <Input.Password
            placeholder={
              provider.code === 'openai'
                ? 'sk-...'
                : provider.code === 'anthropic'
                ? 'sk-ant-...'
                : provider.code === 'perplexity'
                ? 'pplx-...'
                : 'API ключ'
            }
            autoComplete="off"
          />
        </Form.Item>

        <Typography.Text type="secondary">
          Где взять ключ:{' '}
          <a
            href={
              provider.code === 'openai'
                ? 'https://platform.openai.com/api-keys'
                : provider.code === 'anthropic'
                ? 'https://console.anthropic.com/settings/keys'
                : provider.code === 'perplexity'
                ? 'https://www.perplexity.ai/settings/api'
                : '#'
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {provider.name} API Keys →
          </a>
        </Typography.Text>
      </Form>
    </Modal>
  );
};
```

#### 2. ProvidersManager - управление провайдерами

**Файл:** `frontend/src/modules/admin/llm-config/ProvidersManager.tsx`

```typescript
import { Table, Button, Tag, Space, Typography, Card } from 'antd';
import { KeyOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProviderApiKeyModal } from './ProviderApiKeyModal';

export const ProvidersManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Загрузка провайдеров
  const { data: providers, isLoading } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: async () => {
      const response = await fetch('/api/llm-providers');
      return response.json();
    },
  });

  // Обновление API ключа
  const updateKeyMutation = useMutation({
    mutationFn: async ({ providerId, apiKey }: { providerId: string; apiKey: string }) => {
      const response = await fetch(`/api/llm-providers/${providerId}/api-key`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
    },
  });

  const columns = [
    {
      title: 'Провайдер',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space>
          <Typography.Text strong>{name}</Typography.Text>
          <Tag color="blue">{record.code}</Tag>
        </Space>
      ),
    },
    {
      title: 'API Ключ',
      dataIndex: 'api_key_last_4',
      key: 'api_key',
      render: (last4: string | null) =>
        last4 ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            ********{last4}
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Не настроен
          </Tag>
        ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="green">Активен</Tag>
        ) : (
          <Tag color="red">Отключен</Tag>
        ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          icon={<KeyOutlined />}
          onClick={() => {
            setSelectedProvider(record);
            setModalVisible(true);
          }}
        >
          {record.api_key_last_4 ? 'Изменить ключ' : 'Добавить ключ'}
        </Button>
      ),
    },
  ];

  return (
    <Card title="🔑 Управление AI провайдерами">
      <Table
        dataSource={providers}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      {selectedProvider && (
        <ProviderApiKeyModal
          provider={selectedProvider}
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          onSave={async (apiKey) => {
            await updateKeyMutation.mutateAsync({
              providerId: selectedProvider.id,
              apiKey,
            });
          }}
        />
      )}
    </Card>
  );
};
```

#### 3. LLMConfigManager - конфигурация задач

**Файл:** `frontend/src/modules/admin/llm-config/LLMConfigManager.tsx`

```typescript
import { Tabs, Table, Select, InputNumber, Switch, Card, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const LLMConfigManager: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: taskConfigs } = useQuery({
    queryKey: ['llm-task-configs'],
    queryFn: async () => {
      const response = await fetch('/api/llm-task-configs');
      return response.json();
    },
  });

  const { data: models } = useQuery({
    queryKey: ['llm-models'],
    queryFn: async () => {
      const response = await fetch('/api/llm-models');
      return response.json();
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ taskType, updates }: any) => {
      const response = await fetch(`/api/llm-task-configs/${taskType}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-task-configs'] });
    },
  });

  const columns = [
    {
      title: 'Задача',
      dataIndex: 'task_type',
      key: 'task_type',
      render: (type: string, record: any) => (
        <div>
          <Typography.Text strong>{type}</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.task_description}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Основная модель',
      dataIndex: 'primary_model_id',
      key: 'primary_model',
      render: (modelId: string, record: any) => (
        <Select
          value={modelId}
          style={{ width: 200 }}
          onChange={(value) => {
            updateConfigMutation.mutate({
              taskType: record.task_type,
              updates: { primary_model_id: value },
            });
          }}
          options={models?.map((m: any) => ({
            value: m.id,
            label: `${m.name} ($${m.input_price_per_million}/M)`,
          }))}
        />
      ),
    },
    {
      title: 'Fallback',
      dataIndex: 'fallback_model_id',
      key: 'fallback_model',
      render: (modelId: string, record: any) => (
        <Select
          value={modelId}
          allowClear
          style={{ width: 200 }}
          onChange={(value) => {
            updateConfigMutation.mutate({
              taskType: record.task_type,
              updates: { fallback_model_id: value },
            });
          }}
          options={models?.map((m: any) => ({
            value: m.id,
            label: m.name,
          }))}
        />
      ),
    },
    {
      title: 'A/B тест',
      key: 'ab_test',
      render: (_: any, record: any) => (
        <div>
          <Switch
            checked={record.enable_ab_testing}
            onChange={(checked) => {
              updateConfigMutation.mutate({
                taskType: record.task_type,
                updates: { enable_ab_testing: checked },
              });
            }}
          />
          {record.enable_ab_testing && (
            <>
              <Select
                value={record.ab_test_model_id}
                style={{ width: 150, marginLeft: 8 }}
                onChange={(value) => {
                  updateConfigMutation.mutate({
                    taskType: record.task_type,
                    updates: { ab_test_model_id: value },
                  });
                }}
                options={models?.map((m: any) => ({
                  value: m.id,
                  label: m.name,
                }))}
              />
              <InputNumber
                value={record.ab_test_percentage}
                min={1}
                max={50}
                style={{ width: 80, marginLeft: 8 }}
                addonAfter="%"
                onChange={(value) => {
                  updateConfigMutation.mutate({
                    taskType: record.task_type,
                    updates: { ab_test_percentage: value },
                  });
                }}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card title="⚙️ Конфигурация LLM для задач">
      <Table
        dataSource={taskConfigs}
        columns={columns}
        rowKey="task_type"
        pagination={false}
      />
    </Card>
  );
};
```

#### 4. LLMUsageStats - статистика использования

**Файл:** `frontend/src/modules/admin/llm-config/LLMUsageStats.tsx`

```typescript
import { Card, Statistic, Row, Col, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { DollarOutlined, ThunderboltOutlined, FileTextOutlined } from '@ant-design/icons';

export const LLMUsageStats: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['llm-usage-stats'],
    queryFn: async () => {
      const response = await fetch('/api/llm-usage-stats');
      return response.json();
    },
  });

  const { data: recentUsage } = useQuery({
    queryKey: ['llm-usage-recent'],
    queryFn: async () => {
      const response = await fetch('/api/llm-usage-logs?limit=50');
      return response.json();
    },
  });

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего запросов (30 дней)"
              value={stats?.total_requests || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Общая стоимость (30 дней)"
              value={stats?.total_cost_usd || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="USD"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего токенов"
              value={stats?.total_tokens || 0}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Средняя задержка"
              value={stats?.avg_latency_ms || 0}
              suffix="ms"
            />
          </Card>
        </Col>
      </Row>

      <Card title="📊 Последние запросы">
        <Table
          dataSource={recentUsage}
          rowKey="id"
          size="small"
          columns={[
            {
              title: 'Задача',
              dataIndex: 'task_type',
              key: 'task_type',
            },
            {
              title: 'Модель',
              key: 'model',
              render: (record: any) => record.model?.name || 'N/A',
            },
            {
              title: 'Токены',
              dataIndex: 'total_tokens',
              key: 'tokens',
            },
            {
              title: 'Стоимость',
              dataIndex: 'cost_usd',
              key: 'cost',
              render: (cost: number) => `$${cost.toFixed(4)}`,
            },
            {
              title: 'Задержка',
              dataIndex: 'latency_ms',
              key: 'latency',
              render: (ms: number) => `${ms}ms`,
            },
            {
              title: 'Статус',
              dataIndex: 'status',
              key: 'status',
              render: (status: string) => (
                <Tag color={status === 'success' ? 'green' : 'red'}>{status}</Tag>
              ),
            },
          ]}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </>
  );
};
```

### Оптимизация стоимости

**Пример расчета стоимости:**

| Задача | Модель (до) | Стоимость (до) | Модель (после) | Стоимость (после) | Экономия |
|--------|-------------|----------------|----------------|-------------------|----------|
| Web Search | GPT-4o | $0.015 | Perplexity Sonar Pro | $0.012 | 20% |
| Event Extraction | GPT-4o | $0.020 | GPT-4o (unchanged) | $0.020 | 0% |
| Mentions Extraction | GPT-4o | $0.010 | GPT-4o-mini | $0.001 | 90% |
| Criticality Scoring | GPT-4o | $0.008 | GPT-4o (unchanged) | $0.008 | 0% |
| Duplicate Detection | GPT-4o | $0.005 | Gemini Flash | $0.0008 | 84% |
| Report Generation | GPT-4o | $0.025 | Claude Opus 4 | $0.040 | -60% (но выше качество) |
| **ИТОГО на 1 day run** | | **$0.083** | | **$0.0818** | **~1%** |

**Но с учетом качества:** Claude Opus 4 для отчетов дает значительно более качественный результат, что оправдывает +60% стоимость.

**Итоговая экономия с оптимизацией:**
- Mentions extraction: $0.010 → $0.001 = -$0.009/день × 30 = **-$0.27/месяц**
- Duplicate detection: $0.005 → $0.0008 = -$0.0042/день × 30 = **-$0.126/месяц**
- **ИТОГО экономия: ~$0.40/месяц** при улучшении качества отчетов

### Преимущества архитектуры

1. **Гибкость:** Легко добавлять новые провайдеры без изменения кода
2. **Безопасность:** API ключи хранятся зашифрованными (pgcrypto)
3. **Оптимизация:** Выбор оптимальной модели для каждой задачи
4. **Надежность:** Автоматический fallback при ошибках
5. **Прозрачность:** Полная статистика использования и стоимости
6. **A/B тестирование:** Сравнение качества разных моделей
7. **Масштабируемость:** Готово к появлению новых моделей

---

## План реализации

### Phase 3: Backend + Admin Panel (2-3 недели)

**Week 1: Database + Edge Functions**

✅ **День 1-2: Миграции**
- Создать migration `007_brands_and_documents.sql`
- Таблицы: brands, brand_segments, documents, reports, custom_prompts
- Обновить events (добавить brand_id, document_id, etc.)
- Seed данные для brands

✅ **День 3-4: Edge Functions - Brands**
- `brands-api/index.ts`
  - GET /brands
  - GET /brands/:id
  - POST /brands
  - PATCH /brands/:id
  - DELETE /brands/:id
- `brand-segments-api/index.ts`
  - POST /brand-segments (связать бренд с сегментом)
  - DELETE /brand-segments/:id

✅ **День 5-6: Edge Functions - Documents**
- `documents-api/index.ts`
  - GET /documents (с фильтрами)
  - GET /documents/:id
  - POST /documents (user upload)
  - DELETE /documents/:id
- Semantic search endpoint
  - POST /documents/search (по embedding)

✅ **День 7: Edge Functions - остальное**
- Доделать `sources-api` (уже начато)
- Доделать `segments-api`
- Доделать `geographies-api`

**Week 2: Admin UI**

✅ **День 1-2: BrandsManager**
- Таблица брендов с фильтрами
- BrandFormModal (создание/редактирование)
- Связь с сегментами (multi-select)

✅ **День 3: SegmentsManager & GeographiesManager**
- Простые CRUD интерфейсы

✅ **День 4-5: DocumentsLibrary**
- Таблица сохраненных документов
- Фильтры: type, date, brands, segments
- Просмотр PDF/DOCX через iframe
- Поиск по тексту (full-text search)
- Semantic search UI

✅ **День 6-7: Обновить SourcesManager**
- Интеграция с brands (какие бренды продает источник)
- Улучшенный UI

**Week 3: Custom Prompts UI**

✅ **День 1-3: CustomPromptBuilder**
- Step-by-step wizard
- Multi-selects для brands/segments/geographies
- Preview сгенерированного промпта
- Сохранение в библиотеку

✅ **День 4-5: PromptLibrary (кастомные)**
- Просмотр сохраненных промптов
- Запуск промптов
- История выполнения

✅ **День 6-7: Тестирование**
- E2E тесты
- Bug fixes

---

### Phase 4: AI Agents (2-3 недели)

**Week 1: Core Agents**

✅ **День 1-2: Orchestrator**
- `orchestrator/index.ts`
- Логика запуска промптов по расписанию
- Интеграция с search_runs
- Error handling

✅ **День 3-4: Source Hunter + Content Fetcher**
- `agents/source-hunter/index.ts`
- `agents/content-fetcher/index.ts`
- Интеграция с OpenAI web_search

✅ **День 5-7: Document Processor**
- `agents/document-processor/index.ts`
- Supabase Storage setup
- PDF text extraction
- Embedding generation
- Mentions extraction

**Week 2: Events & Analysis**

✅ **День 1-2: Event Extractor**
- `agents/event-extractor/index.ts`
- Промпт инжиниринг
- Chunking текста

✅ **День 3: Criticality Scorer**
- `agents/criticality-scorer/index.ts`
- Batch processing

✅ **День 4-5: Duplicate Detector**
- `agents/duplicate-detector/index.ts`
- Cosine similarity
- Merge logic

✅ **День 6-7: Report Generator**
- `agents/report-generator/index.ts`
- Промпты для daily/weekly/monthly
- PDF/DOCX export

**Week 3: Integration & Testing**

✅ **День 1-3: Alert Manager**
- `agents/alert-manager/index.ts`
- Telegram bot setup
- Email notifications

✅ **День 4-5: Custom Prompt Runner**
- `agents/custom-prompt-runner/index.ts`
- Запуск кастомных промптов

✅ **День 6-7: Full pipeline testing**
- End-to-end тесты
- Performance optimization

---

### Phase 5: Production Ready (1 неделя)

✅ **День 1-2: GitHub Actions Cron**
- Setup daily schedule
- Environment variables
- Monitoring

✅ **День 3-4: UI Polish**
- Dashboard widgets
- Real-time updates (опционально)
- Mobile responsiveness

✅ **День 5-7: Deployment & Documentation**
- Production deploy
- User guide
- Admin guide

---

## Технические детали

### OpenAI API Usage

**Модели:**
- `gpt-4o` - для extraction, scoring, report generation
- `gpt-4o-mini` - для mentions extraction (дешевле)
- `text-embedding-3-small` - для embeddings (1536 dimensions)

**Примерная стоимость:**

| Операция | Модель | Стоимость |
|----------|--------|-----------|
| Event Extraction (1 doc) | gpt-4o | ~$0.01 |
| Criticality Scoring (10 events) | gpt-4o | ~$0.005 |
| Mentions Extraction (1 doc) | gpt-4o-mini | ~$0.001 |
| Embedding Generation (1 doc) | text-embedding-3-small | ~$0.0001 |
| Report Generation | gpt-4o | ~$0.02 |
| **ИТОГО на 1 daily run (10 промптов)** | | **~$0.50-1.00/день** |
| **ИТОГО в месяц** | | **~$15-30/месяц** |

### Supabase Storage

**Bucket:** `market-documents`

**Структура:**
```
market-documents/
├─ pdfs/
│  ├─ 2024/
│  │  └─ 12/
│  │     └─ {uuid}_filename.pdf
│  └─ 2025/
├─ presentations/
│  └─ 2024/
│     └─ 12/
│        └─ {uuid}_filename.pptx
└─ user-uploads/
   └─ {user_id}/
      └─ {uuid}_filename.pdf
```

**Политики доступа:**
- Authenticated users: READ
- Admins: READ, WRITE, DELETE
- Users: WRITE только в user-uploads/{user_id}/

### pgvector для Semantic Search

**Setup:**

```sql
-- Включить расширение
CREATE EXTENSION IF NOT EXISTS vector;

-- Индекс для embeddings
CREATE INDEX idx_documents_embedding ON documents 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Поиск похожих документов:**

```sql
-- Найти топ-10 похожих документов
SELECT 
  id,
  title,
  document_type,
  1 - (embedding <=> $1::vector) as similarity
FROM documents
WHERE 1 - (embedding <=> $1::vector) > 0.7
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

### GitHub Actions Cron

**Файл:** `.github/workflows/daily-search.yml`

```yaml
name: Daily Search

on:
  schedule:
    - cron: '0 9 * * *' # Every day at 09:00 UTC (12:00 MSK)
  workflow_dispatch: # Manual trigger

jobs:
  run-daily-search:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Orchestrator
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"type": "daily"}' \
            ${{ secrets.SUPABASE_URL }}/functions/v1/orchestrator
```

### Environment Variables

**Supabase:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**OpenAI:**
- `OPENAI_API_KEY`

**Telegram (опционально):**
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

**Email (опционально):**
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`

---

## Метрики успеха

### Phase 3 (Backend + Admin)
- ✅ 4 новые Edge Functions работают
- ✅ Админ может управлять brands, sources, segments, geographies
- ✅ Админ может загружать документы
- ✅ Кастомные промпты можно создавать и сохранять

### Phase 4 (AI Agents)
- ✅ Daily search находит 20+ событий в день
- ✅ Дедупликация работает (similarity > 0.85)
- ✅ Criticality scorer точность >80%
- ✅ Report generator создает читаемые отчеты

### Phase 5 (Production)
- ✅ Система работает автоматически каждый день
- ✅ Критичные события (4-5) отправляют alerts
- ✅ UI отзывчивый и удобный
- ✅ Документация полная

---

## Следующие шаги

1. **Создать миграцию 007** для новых таблиц (brands, documents, reports, custom_prompts)
2. **Реализовать brands-api** Edge Function
3. **Создать BrandsManager UI**
4. **Протестировать полный flow**: создание бренда → фильтрация событий по бренду

**Готовы начать?** 🚀

---

**Конец документа**
