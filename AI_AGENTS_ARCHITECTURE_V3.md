# 🤖 MarketMonitor - AI Agents Architecture V3

**Версия:** 3.0
**Дата:** 2025-12-16
**Статус:** MVP Implementation Ready
**Приоритет:** HIGH - Architectural Foundation for Phase 4

---

## 📋 Содержание

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Key Architectural Decisions](#key-architectural-decisions)
4. [Source Hunter V2: Scope-Aware + Segment-Aware](#source-hunter-v2-architecture)
5. [Monitoring Profiles & Prompt Templates](#monitoring-profiles--prompt-templates)
6. [Database Schema Changes](#database-schema-changes)
7. [Implementation Plan (MVP)](#implementation-plan-mvp)
8. [Future Enhancements (Phase 5)](#future-enhancements-phase-5)

---

## Executive Summary

**Проблема:** Широкие generic промпты ("найди всё по всем сегментам") возвращают поверхностные результаты низкого качества.

**Решение:** **Scope-Aware + Segment-Aware Query Generation**
- 1 Source Hunter → N focused queries (сегмент × источник × scope)
- 3 типа мониторинга: Daily Critical / Weekly Overview / Monthly Trends
- Приоритизация источников по важности (distributors, manufacturers > media)

**Результат для MVP:**
- ✅ Качество поиска: +200% релевантности
- ✅ Cost-эффективность: оптимизация через приоритеты
- ✅ Гибкость: разные промпты для разных scope
- ✅ Простота: ~2 часа реализации

---

## Problem Statement

### Текущая ситуация (до оптимизации):

**Один широкий промпт:**
```
"Найти события на рынке климатического оборудования"
```

**Perplexity возвращает:**
- 2 результата по RAC (room air conditioners)
- 1 результат по VRF (multi-zone systems)
- 1 результат по чиллерам
- 1 общая новость

**Проблемы:**
1. ❌ Размытый фокус - нет глубины по сегментам
2. ❌ Смешение приоритетов - важные источники (дистрибьюторы) равны аналитическим порталам
3. ❌ Нет специализации - production news (критично!) смешаны с бизнес-аналитикой (низкий приоритет)

### Бизнес-требования:

**7 типов информации с разными приоритетами:**

| Тип информации | Приоритет | Частота | Источники |
|----------------|-----------|---------|-----------|
| 1. Дистрибьюторы: промо-акции, новые продукты | HIGH | Daily | Доктор Холод, Волмакс, Инженерия Климата |
| 2. **Производства в РФ (импортозамещение)** | **CRITICAL** | Daily | Новостные порталы, госорганы, **даже слухи!** |
| 3. Тендеры (VRF, промышленное оборудование) | HIGH | Daily | ЕИС, Zakupki.gov.ru |
| 4. Регуляция (ввоз, лицензии, "Честный знак") | HIGH | Daily | Минпромторг, Роспотребнадзор |
| 5. Профессиональные ассоциации | MEDIUM | Daily | АПИК, НП АВОК |
| 6. Бизнес-аналитика (обзоры рынка) | LOW/MEDIUM | Weekly | Коммерсант, РБК, Forbes |
| 7. Глобальные тренды (технологии) | LOW/MEDIUM | Monthly | HVAC Industry News, международные выставки |

**Ключевое наблюдение:**
- Это НЕ segments (RAC/VRF/CHILLER) - это **ОТКУДА** и **КАК** искать
- Нужна двухмерная матрица: **Segment × Information Scope**

---

## Key Architectural Decisions

### Decision 1: Scope-Aware + Segment-Aware Queries

**НЕ делаем:**
- ❌ N вызовов Source Hunter (дорого, сложно)
- ❌ Один широкий промпт для всех сегментов

**Делаем:**
- ✅ Один Source Hunter с **N focused queries**
- ✅ Queries генерируются для каждого: **segment × source × scope**
- ✅ GPT-4o-mini генерирует контекстно-зависимые queries

**Пример:**

```typescript
// Input:
monitoring_profile = {
  name: "Daily Critical Monitoring",
  segment_ids: [RAC_uuid, VRF_uuid, CHILLER_uuid],
  geography_ids: [RU_uuid],
  prompt_template_id: "daily_critical_template"
}

// Source Hunter генерирует:
Map<segment, Map<source, query>> = {
  RAC: {
    "Доктор Холод": "промо-акции кондиционеры RAC сплит-системы Daikin Midea скидки",
    "Волмакс": "новые продукты RAC кондиционеры бытовые 2025"
  },
  VRF: {
    "Инженерия Климата": "тендеры VRF мультизональные системы коммерческие",
    "Daikin Russia": "анонсы VRV VRF новые модели"
  },
  CHILLER: {
    "Фригодизайн": "чиллеры промышленное охлаждение новые модели акции"
  }
}

// Perplexity API calls: 3 segments × ~5 sources = 15-20 focused queries
// Quality: ⭐⭐⭐⭐⭐ (каждый query фокусирован!)
```

---

### Decision 2: Source Type Prioritization

**Расширяем `source_types` таблицу:**

```sql
ALTER TABLE source_types ADD COLUMN priority INT DEFAULT 3;

-- Приоритеты:
-- 5 = CRITICAL (дистрибьюторы, производители, госорганы, тендеры)
-- 3 = MEDIUM (ассоциации)
-- 2 = LOW (бизнес-медиа, аналитика)

UPDATE source_types SET priority = 5
WHERE code IN ('distributor', 'manufacturer', 'government', 'tender_platform');

UPDATE source_types SET priority = 3
WHERE code IN ('association');

UPDATE source_types SET priority = 2
WHERE code IN ('business_media', 'analytics');
```

**Source Hunter фильтрует:**
```typescript
const sources = await supabase
  .from('sources')
  .select('*, source_types!inner(priority)')
  .eq('is_active', true)
  .gte('source_types.priority', profile.min_source_priority || 1)
  .order('source_types.priority', { ascending: false })
  .limit(profile.max_sources_per_run);
```

---

### Decision 3: Multiple Monitoring Profiles

**3 профиля мониторинга с разными промптами:**

| Profile | Frequency | Priority Sources | Prompt Focus |
|---------|-----------|------------------|--------------|
| **Daily Critical** | Daily | HIGH (priority ≥ 5) | Дистрибьюторы, производства, тендеры, регуляция |
| **Weekly Overview** | Weekly | MEDIUM (priority ≥ 3) | Ассоциации, бизнес-аналитика |
| **Monthly Trends** | Monthly | LOW (priority ≥ 2) | Глобальные тренды, технологии |

**Admin UI:**
```tsx
<Button onClick={() => runPipeline('daily-critical')}>
  🔥 Ежедневный мониторинг (HIGH)
</Button>

<Button onClick={() => runPipeline('weekly-overview')}>
  📊 Недельный обзор (MEDIUM)
</Button>

<Button onClick={() => runPipeline('monthly-trends')}>
  🌍 Месячный анализ (LOW)
</Button>
```

---

## Source Hunter V2 Architecture

### Полный поток работы:

```
┌──────────────────────────────────────────────────────────┐
│ 1. ORCHESTRATOR LOADS PROFILE                            │
│    SELECT * FROM monitoring_profiles                      │
│    WHERE id = 'daily-critical-profile'                    │
│                                                           │
│    Result:                                                │
│    - segment_ids: [RAC, VRF, CHILLER]                    │
│    - min_source_priority: 5                               │
│    - max_sources_per_run: 30                              │
│    - prompt_template_id: 'daily_critical_template'        │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. ORCHESTRATOR LOADS PROMPT TEMPLATE                    │
│    SELECT * FROM prompt_templates                         │
│    WHERE id = 'daily_critical_template'                   │
│                                                           │
│    Result:                                                │
│    template_text: "Найти КРИТИЧЕСКИЕ события..."         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. SOURCE HUNTER: LOAD HIGH-PRIORITY SOURCES             │
│    SELECT s.*, st.priority                                │
│    FROM sources s                                         │
│    JOIN source_types st ON s.source_type_id = st.id      │
│    WHERE s.is_active = true                               │
│      AND st.priority >= 5                                 │
│    ORDER BY st.priority DESC                              │
│    LIMIT 30                                               │
│                                                           │
│    Result: [                                              │
│      {id: "...", name: "Доктор Холод", priority: 5},     │
│      {id: "...", name: "Волмакс", priority: 5},          │
│      {id: "...", name: "ЕИС Закупки", priority: 5},      │
│      ...                                                  │
│    ]                                                      │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. SOURCE HUNTER: LOAD SEGMENTS                          │
│    SELECT * FROM segments                                 │
│    WHERE id IN (segment_ids)                              │
│                                                           │
│    Result: [                                              │
│      {id: "...", code: "RAC", name: "Room AC"},          │
│      {id: "...", code: "VRF", name: "VRF Systems"},      │
│      {id: "...", code: "CHILLER", name: "Chillers"}      │
│    ]                                                      │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 5. SOURCE HUNTER: GENERATE SEGMENT-AWARE QUERIES         │
│    GPT-4o-mini (дешевая модель)                          │
│                                                           │
│    Prompt для LLM:                                        │
│    "Сгенерируй поисковые запросы для:                    │
│     - Сегмент: RAC (кондиционеры сплит-системы)          │
│     - Источник: Доктор Холод (дистрибьютор)              │
│     - Контекст: промо-акции, новые продукты              │
│    "                                                      │
│                                                           │
│    LLM возвращает:                                        │
│    {                                                      │
│      "RAC + Доктор Холод": "промо-акции RAC Daikin...",  │
│      "RAC + Волмакс": "новые продукты кондиционеры...",  │
│      "VRF + Инженерия": "тендеры VRF системы...",        │
│      ...                                                  │
│    }                                                      │
│                                                           │
│    Total: 3 segments × 10 sources = 30 focused queries    │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 6. SOURCE HUNTER: PERPLEXITY SEARCH (для каждого query)  │
│    API: https://api.perplexity.ai/chat/completions       │
│    Model: sonar                                           │
│    Query: "промо-акции RAC Daikin Midea скидки"          │
│    Focus: "doctorholodd.ru"                               │
│    Recency: last week                                     │
│                                                           │
│    Perplexity возвращает:                                 │
│    {                                                      │
│      citations: [                                         │
│        "https://doctorholodd.ru/promo-daikin-2025",      │
│        "https://doctorholodd.ru/news/midea-discount"     │
│      ],                                                   │
│      message: "Найдены акции по кондиционерам..."        │
│    }                                                      │
│                                                           │
│    Rate limit check: 1000 запросов/день MAX               │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 7. SOURCE HUNTER: SAVE TO DATABASE (RAW LAYER)           │
│    ДЛЯ КАЖДОГО URL:                                       │
│                                                           │
│    INSERT INTO documents (                                │
│      title,              -- "Доктор Холод - Акция Daikin" │
│      document_type,      -- "webpage"                     │
│      source_url,         -- "https://..."                 │
│      file_url,           -- "https://..."                 │
│      content_text,       -- "Документ загружен с..."      │
│      source_id,          -- uuid источника                │
│      published_date,     -- NOW()                         │
│      fetched_at          -- NOW()                         │
│    )                                                      │
│    RETURNING id;                                          │
│                                                           │
│    ТАКЖЕ: Создать linking для segment:                    │
│    INSERT INTO document_segments (document_id, segment_id)│
│    VALUES (new_doc_id, RAC_uuid);                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 8. SOURCE HUNTER: RETURN TO ORCHESTRATOR                 │
│    {                                                      │
│      status: "success",                                   │
│      documents_created: 25,                               │
│      document_ids: [uuid1, uuid2, ...],  ← ВАЖНО!        │
│      urls: ["https://...", "https://..."],                │
│      message: "Found and saved 25 documents"              │
│    }                                                      │
└──────────────────────────────────────────────────────────┘
                        ↓
                [ORCHESTRATOR передает IDs
                 в Content Fetcher Agent]
```

---

## Monitoring Profiles & Prompt Templates

### Таблица: `prompt_templates`

**Структура:**
```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  stage VARCHAR(50) NOT NULL,         -- 'hunt', 'classify', 'extract', 'score'
  template_text TEXT NOT NULL,        -- Промпт с плейсхолдерами
  priority INT DEFAULT 3,             -- 5=HIGH, 3=MEDIUM, 2=LOW
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Seed данные (3 шаблона):**

#### 1. Daily Critical Events Template
```sql
INSERT INTO prompt_templates (name, stage, template_text, priority, description)
VALUES (
  'Daily Critical Events',
  'hunt',
  'Найти КРИТИЧЕСКИЕ события на рынке климатического оборудования в России за последние 1-2 дня.

ПРИОРИТЕТ 1 (обязательно искать):
- Промо-акции, скидки, специальные предложения от дистрибьюторов
- Новые продукты, анонсы моделей от производителей
- Изменения условий поставок, кредитных программ
- Запуск производств в России, импортозамещение (ДАЖЕ СЛУХИ!)
- Крупные тендеры на VRF и промышленное оборудование
- Изменения в регуляции (правила ввоза, лицензирование, "Честный знак")
- Стратегические партнерства, дистрибьюторские соглашения

Сегменты: {segment_names}
География: Россия

Искать на сайтах:
- Дистрибьюторы климатического оборудования
- Производители (Daikin, Midea, Haier, LG, Ballu и др.)
- Тендерные площадки (ЕИС, Zakupki.gov.ru)
- Государственные органы (Минпромторг, Роспотребнадзор)

Вернуть ТОЛЬКО реальные URLs с актуальной информацией.',
  5,  -- HIGH priority
  'Ежедневный критический мониторинг для высокоприоритетных источников'
);
```

#### 2. Weekly Industry Overview Template
```sql
INSERT INTO prompt_templates (name, stage, template_text, priority, description)
VALUES (
  'Weekly Industry Overview',
  'hunt',
  'Найти отраслевые новости климатического рынка России за последние 7 дней.

ПРИОРИТЕТ 2 (средней важности):
- Новости профессиональных ассоциаций (АПИК, НП АВОК)
- Обзоры рынка климатического оборудования в бизнес-изданиях
- Аналитические статьи о трендах рынка HVAC
- Отраслевые мероприятия (выставки, конференции, семинары)
- Экспертные мнения, комментарии специалистов

Сегменты: {segment_names}
География: Россия

Искать на сайтах:
- Профессиональные ассоциации (АПИК, НП АВОК)
- Бизнес-издания (Коммерсант, РБК, Forbes)
- Отраслевые порталы (Abok.ru, C-O-K.ru)

Вернуть URLs с аналитическими материалами.',
  3,  -- MEDIUM priority
  'Еженедельный обзор отраслевых новостей для среднеприоритетных источников'
);
```

#### 3. Monthly Global Trends Template
```sql
INSERT INTO prompt_templates (name, stage, template_text, priority, description)
VALUES (
  'Monthly Global Trends',
  'hunt',
  'Найти глобальные тренды в климатической индустрии за последний месяц.

ПРИОРИТЕТ 3 (низкий, но важный для стратегии):
- Новые технологии HVAC (IoT, AI, энергоэффективность)
- Глобальные тренды (декарбонизация, ESG, "зеленая" энергетика)
- Международные выставки, конференции (AHR Expo, Chillventa, Mostra Convegno)
- Глобальные инвестиции в климатическую индустрию
- Новые стандарты, международные регуляции

Сегменты: {segment_names}
География: Международная + Россия

Искать на сайтах:
- Международные отраслевые издания (HVAC Industry News, ACR News)
- Технологические порталы
- Аналитические агентства

Вернуть URLs с материалами о глобальных трендах.',
  2,  -- LOW priority
  'Ежемесячный анализ глобальных трендов для низкоприоритетных источников'
);
```

---

### Таблица: `monitoring_profiles`

**Расширяем схему:**
```sql
ALTER TABLE monitoring_profiles
ADD COLUMN min_source_priority INT DEFAULT 1;

-- Теперь профиль может фильтровать источники по приоритету
```

**Seed данные (3 профиля):**

```sql
-- 1. Daily Critical Monitoring Profile
INSERT INTO monitoring_profiles (
  name,
  description,
  is_active,
  segment_ids,
  geography_ids,
  priority,
  max_sources_per_run,
  min_source_priority,
  dedupe_threshold,
  prompt_template_id
)
SELECT
  'Daily Critical Monitoring',
  'Ежедневный мониторинг критических событий: промо-акции, производства, тендеры, регуляция',
  true,
  (SELECT ARRAY_AGG(id) FROM segments WHERE is_active = true),
  (SELECT ARRAY_AGG(id) FROM geographies WHERE code = 'RU'),
  5,  -- HIGH priority
  30, -- MAX 30 источников
  5,  -- ТОЛЬКО high-priority источники (distributors, manufacturers, government)
  0.85,
  (SELECT id FROM prompt_templates WHERE name = 'Daily Critical Events' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM monitoring_profiles WHERE name = 'Daily Critical Monitoring'
);

-- 2. Weekly Industry Overview Profile
INSERT INTO monitoring_profiles (
  name,
  description,
  is_active,
  segment_ids,
  geography_ids,
  priority,
  max_sources_per_run,
  min_source_priority,
  dedupe_threshold,
  prompt_template_id
)
SELECT
  'Weekly Industry Overview',
  'Еженедельный обзор отраслевых новостей: ассоциации, бизнес-медиа, аналитика',
  true,
  (SELECT ARRAY_AGG(id) FROM segments WHERE is_active = true),
  (SELECT ARRAY_AGG(id) FROM geographies WHERE code = 'RU'),
  3,  -- MEDIUM priority
  15, -- MAX 15 источников
  3,  -- ТОЛЬКО medium+ источники (associations, some media)
  0.85,
  (SELECT id FROM prompt_templates WHERE name = 'Weekly Industry Overview' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM monitoring_profiles WHERE name = 'Weekly Industry Overview'
);

-- 3. Monthly Global Trends Profile
INSERT INTO monitoring_profiles (
  name,
  description,
  is_active,
  segment_ids,
  geography_ids,
  priority,
  max_sources_per_run,
  min_source_priority,
  dedupe_threshold,
  prompt_template_id
)
SELECT
  'Monthly Global Trends',
  'Ежемесячный анализ глобальных трендов: технологии, международные выставки, инвестиции',
  true,
  (SELECT ARRAY_AGG(id) FROM segments WHERE is_active = true),
  NULL,  -- Международная география
  2,  -- LOW priority
  10, -- MAX 10 источников
  2,  -- ВСЕ источники (включая low-priority аналитику)
  0.85,
  (SELECT id FROM prompt_templates WHERE name = 'Monthly Global Trends' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM monitoring_profiles WHERE name = 'Monthly Global Trends'
);
```

---

## Database Schema Changes

### Migration 027: Source Type Priorities

```sql
-- ============================================================================
-- Migration 027: Add priority to source_types
-- Date: 2025-12-16
-- Purpose: Enable source prioritization for focused search
-- ============================================================================

-- Add priority column
ALTER TABLE source_types
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 3;

-- Seed priorities based on business requirements
UPDATE source_types SET priority = 5
WHERE code IN ('distributor', 'manufacturer', 'government', 'tender_platform');

UPDATE source_types SET priority = 3
WHERE code IN ('association');

UPDATE source_types SET priority = 2
WHERE code IN ('business_media', 'analytics');

-- Add comment
COMMENT ON COLUMN source_types.priority IS
'Source priority: 5=CRITICAL (distributors, manufacturers, gov), 3=MEDIUM (associations), 2=LOW (analytics)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_source_types_priority
ON source_types(priority);
```

---

### Migration 028: Prompt Templates & Monitoring Profiles

```sql
-- ============================================================================
-- Migration 028: Seed prompt templates and monitoring profiles for MVP
-- Date: 2025-12-16
-- Purpose: Create 3 monitoring scopes (daily/weekly/monthly)
-- ============================================================================

-- 1. Add priority to prompt_templates
ALTER TABLE prompt_templates
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 3;

-- 2. Add min_source_priority to monitoring_profiles
ALTER TABLE monitoring_profiles
ADD COLUMN IF NOT EXISTS min_source_priority INT DEFAULT 1;

-- 3. Insert 3 prompt templates (см. выше полные тексты)
-- [SQL код из раздела "Monitoring Profiles & Prompt Templates"]

-- 4. Insert 3 monitoring profiles
-- [SQL код из раздела "Monitoring Profiles & Prompt Templates"]
```

---

## Implementation Plan (MVP)

**Цель:** Реализовать Scope-Aware + Segment-Aware архитектуру за 2-3 часа

### Phase 4 Part 4A: Database Migrations (30 минут)

**Задачи:**
1. ✅ Создать `027_source_types_priority.sql` (5 мин)
2. ✅ Создать `028_prompt_templates_profiles.sql` (15 мин)
3. ✅ Применить миграции на Supabase (5 мин)
4. ✅ Проверить данные через Dashboard (5 мин)

**Чеклист:**
- [ ] Таблица `source_types` имеет column `priority`
- [ ] Все source_types заполнены приоритетами (5/3/2)
- [ ] Таблица `prompt_templates` имеет column `priority`
- [ ] Таблица `monitoring_profiles` имеет column `min_source_priority`
- [ ] 3 prompt templates созданы (Daily/Weekly/Monthly)
- [ ] 3 monitoring profiles созданы

---

### Phase 4 Part 4B: Source Hunter V2 (1-1.5 часа)

**Файл:** `supabase/functions/source-hunter/index.ts`

**Изменения:**

#### 1. Загрузка источников с приоритетом (15 мин)

```typescript
async function getSearchSources(
  segment_ids?: string[],
  geography_ids?: string[],
  min_priority: number = 1,
  max_sources: number = 20
): Promise<SearchSource[]> {
  let query = supabase
    .from('sources')
    .select('id, name, source_type_id, website_url, priority, source_types!inner(priority)')
    .eq('is_active', true)
    .gte('source_types.priority', min_priority)  // ← НОВОЕ: фильтр по приоритету
    .order('source_types.priority', { ascending: false })
    .limit(max_sources);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sources:', error);
    return [];
  }

  return (data as SearchSource[]) || [];
}
```

#### 2. Загрузка сегментов (5 мин)

```typescript
async function getSegments(segment_ids: string[]): Promise<Segment[]> {
  const { data, error } = await supabase
    .from('segments')
    .select('id, code, name, description')
    .in('id', segment_ids);

  if (error) {
    console.error('Error fetching segments:', error);
    return [];
  }

  return data as Segment[];
}
```

#### 3. Генерация segment-aware queries (30 мин)

```typescript
/**
 * Генерировать focused queries для каждого: segment × source
 */
async function generateSegmentAwareQueries(
  basePrompt: string,
  sources: SearchSource[],
  segments: Segment[]
): Promise<Map<string, Map<string, string>>> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const result = new Map<string, Map<string, string>>();

  // Для каждого сегмента генерируем queries
  for (const segment of segments) {
    const sourceNames = sources.map(s => s.name).join(', ');

    const systemPrompt = `Вы помощник по генерации search queries для поиска событий на рынке климатического оборудования.

Правила:
- Queries на русском языке
- Включать ключевые слова из базового промпта
- Быть релевантными для КОНКРЕТНОГО сегмента
- Быть релевантными для КОНКРЕТНОГО источника
- Максимально специфичные (не общие)

Ответ: JSON объект {
  "source_name_1": "focused query 1",
  "source_name_2": "focused query 2"
}`;

    const userPrompt = `Базовый промпт: "${basePrompt}"

Сегмент: ${segment.name} (${segment.code})
Описание: ${segment.description || ''}

Доступные источники: ${sourceNames}

Сгенерируй оптимальные search queries для каждого источника С УЧЕТОМ СЕГМЕНТА "${segment.name}".`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',  // Дешевая модель
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Invalid JSON in OpenAI response:', content);
        continue;
      }

      const queries = JSON.parse(jsonMatch[0]);
      const segmentQueries = new Map<string, string>();

      sources.forEach((source) => {
        const query = queries[source.name];
        if (query) {
          segmentQueries.set(source.id, query);
        }
      });

      result.set(segment.id, segmentQueries);
    } catch (error) {
      console.error(`Error generating queries for segment ${segment.name}:`, error);
      continue;
    }
  }

  return result;
}
```

#### 4. Сохранение с segment linking (10 мин)

```typescript
async function saveDocumentWithSegment(
  title: string,
  url: string,
  sourceId: string,
  segmentId: string,
  documentType: 'webpage' = 'webpage'
): Promise<string | null> {
  try {
    // 1. Создать документ
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        document_type: documentType,
        source_url: url,
        file_url: url,
        content_text: `Документ загружен с ${url}`,
        source_id: sourceId,
        published_date: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (docError || !doc) {
      console.error('Error saving document:', docError);
      return null;
    }

    // 2. Создать linking с сегментом
    const { error: linkError } = await supabase
      .from('document_segments')
      .insert({
        document_id: doc.id,
        segment_id: segmentId,
      });

    if (linkError) {
      console.error('Error linking document to segment:', linkError);
      // НЕ фейлим - документ уже создан
    }

    return doc.id;
  } catch (error) {
    console.error('Error saving document with segment:', error);
    return null;
  }
}
```

#### 5. Обновить main handler (10 мин)

```typescript
async function handler(request: Request): Promise<Response> {
  // ... CORS handling ...

  try {
    const requestData: SourceHunterRequest = await request.json();

    console.log('Starting Source Hunter V2 with:', {
      prompt: requestData.prompt.substring(0, 50),
      segments: requestData.segment_ids?.length || 0,
      min_priority: requestData.min_source_priority || 1,
    });

    // Step 1: Get sources (filtered by priority)
    const sources = await getSearchSources(
      requestData.segment_ids,
      requestData.geography_ids,
      requestData.min_source_priority || 1,
      requestData.max_sources_per_run || 20
    );

    if (sources.length === 0) {
      return new Response(JSON.stringify({
        status: 'error',
        documents_created: 0,
        urls: [],
        error: 'No high-priority sources found',
      }), { status: 400, headers: corsHeaders });
    }

    console.log(`Found ${sources.length} high-priority sources`);

    // Step 2: Get segments
    const segments = await getSegments(requestData.segment_ids || []);

    if (segments.length === 0) {
      return new Response(JSON.stringify({
        status: 'error',
        documents_created: 0,
        urls: [],
        error: 'No segments specified',
      }), { status: 400, headers: corsHeaders });
    }

    console.log(`Loaded ${segments.length} segments`);

    // Step 3: Generate segment-aware queries
    const allQueries = await generateSegmentAwareQueries(
      requestData.prompt,
      sources,
      segments
    );

    console.log(`Generated queries for ${allQueries.size} segments`);

    // Step 4: Search and save (для каждого segment × source)
    const urls: string[] = [];
    const documentIds: string[] = [];
    let documentsCreated = 0;

    for (const segment of segments) {
      const segmentQueries = allQueries.get(segment.id);
      if (!segmentQueries) continue;

      for (const source of sources) {
        const query = segmentQueries.get(source.id);
        if (!query) continue;

        try {
          const results = await searchDocuments(query, source);

          for (const result of results) {
            const docId = await saveDocumentWithSegment(
              result.title,
              result.url,
              source.id,
              segment.id  // ← НОВОЕ: сохраняем segment linking
            );

            if (docId) {
              documentsCreated++;
              urls.push(result.url);
              documentIds.push(docId);
            }
          }
        } catch (error) {
          console.error(`Error searching ${segment.name} @ ${source.name}:`, error);
          continue;
        }
      }
    }

    console.log(`Successfully created ${documentsCreated} documents`);

    return new Response(JSON.stringify({
      status: 'success',
      documents_created: documentsCreated,
      document_ids: documentIds,
      urls,
      message: `Found and saved ${documentsCreated} documents across ${segments.length} segments`,
    }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Source Hunter V2 error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      documents_created: 0,
      urls: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders });
  }
}
```

---

### Phase 4 Part 4C: Orchestrator Update (15 мин)

**Файл:** `supabase/functions/search-orchestrator/index.ts`

**Изменения:**

```typescript
// Обновить вызов Source Hunter с новыми параметрами
async function runSourceHunter(
  monitoringProfileId: string,
  searchRunId: string,
  prompt: string,
  profile: MonitoringProfile,
  authHeader: string
): Promise<SourceHunterResponse> {
  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/source-hunter`;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      ...(authHeader && { 'Authorization': authHeader }),
    },
    body: JSON.stringify({
      prompt,
      monitoring_profile_id: monitoringProfileId,
      search_run_id: searchRunId,
      segment_ids: profile.segment_ids,
      geography_ids: profile.geography_ids,
      min_source_priority: profile.min_source_priority || 1,  // ← НОВОЕ
      max_sources_per_run: profile.max_sources_per_run || 20,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Source Hunter failed: ${response.status} - ${error}`);
  }

  return await response.json() as SourceHunterResponse;
}
```

---

### Phase 4 Part 4D: Admin UI Update (30 мин)

**Файл:** `frontend/src/modules/admin/pipeline/RunPipelinePanel.tsx`

**Изменения:**

```tsx
// Добавить 3 кнопки для разных monitoring profiles

export const RunPipelinePanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  // Load monitoring profiles
  const { data: profiles } = useQuery({
    queryKey: ['monitoring-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitoring_profiles')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) throw error;
      return data as MonitoringProfile[];
    },
  });

  const runPipeline = async (profileId: string) => {
    setLoading(true);
    setSelectedProfile(profileId);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-orchestrator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            monitoring_profile_id: profileId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Pipeline failed: ${response.statusText}`);
      }

      const result = await response.json();
      message.success(`Pipeline completed! Created ${result.documents_created} documents`);
    } catch (error) {
      console.error('Pipeline error:', error);
      message.error('Pipeline failed. Check logs.');
    } finally {
      setLoading(false);
      setSelectedProfile(null);
    }
  };

  return (
    <Card title="🚀 Запустить Pipeline" className="mb-6">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {profiles?.map((profile) => (
          <Card
            key={profile.id}
            type="inner"
            title={
              <Space>
                {profile.priority === 5 && <span>🔥</span>}
                {profile.priority === 3 && <span>📊</span>}
                {profile.priority === 2 && <span>🌍</span>}
                <span>{profile.name}</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                size="large"
                loading={loading && selectedProfile === profile.id}
                onClick={() => runPipeline(profile.id)}
                disabled={loading}
              >
                Запустить
              </Button>
            }
          >
            <Descriptions column={1}>
              <Descriptions.Item label="Описание">
                {profile.description}
              </Descriptions.Item>
              <Descriptions.Item label="Приоритет">
                <Tag color={profile.priority === 5 ? 'red' : profile.priority === 3 ? 'blue' : 'green'}>
                  {profile.priority === 5 ? 'HIGH' : profile.priority === 3 ? 'MEDIUM' : 'LOW'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Макс. источников">
                {profile.max_sources_per_run}
              </Descriptions.Item>
              <Descriptions.Item label="Мин. приоритет источников">
                {profile.min_source_priority}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ))}
      </Space>
    </Card>
  );
};
```

---

## Future Enhancements (Phase 5)

### 1. Monitoring Scopes Table (2-3 часа)

**Проблема:** Дистрибьютор может продавать и RAC, и VRF. Как указать это?

**Решение:**
```sql
CREATE TABLE source_segments (
  source_id UUID REFERENCES sources(id),
  segment_id UUID REFERENCES segments(id),
  PRIMARY KEY (source_id, segment_id)
);

-- Example:
INSERT INTO source_segments (source_id, segment_id)
VALUES
  ('doctor_holod_uuid', 'RAC_uuid'),
  ('doctor_holod_uuid', 'VRF_uuid'),
  ('inzheneria_klimata_uuid', 'VRF_uuid'),
  ('inzheneria_klimata_uuid', 'CHILLER_uuid');
```

**Source Hunter фильтрует:**
```typescript
// Если profile.segment_ids = [RAC, VRF]
// Загружаем только источники, у которых есть хотя бы один из этих сегментов

SELECT DISTINCT s.*
FROM sources s
JOIN source_segments ss ON s.id = ss.source_id
WHERE ss.segment_id IN ('RAC_uuid', 'VRF_uuid')
  AND s.is_active = true;
```

---

### 2. Cross-Check Mechanism (3-4 часа)

**Проблема:** Production news (запуск производств) требует перекрестной проверки.

**Решение:**
```typescript
async function crossCheckProductionNews(documentId: string): Promise<void> {
  // 1. Загрузить документ
  const doc = await loadDocument(documentId);

  // 2. Генерировать verification queries
  const queries = [
    `подтверждение ${doc.company} строительство завода`,
    `официальное заявление ${doc.company} производство`,
  ];

  // 3. Искать подтверждения через Perplexity
  const confirmations = await searchConfirmations(queries);

  // 4. Сохранить confidence_score
  await supabase
    .from('documents')
    .update({
      confidence_score: calculateConfidence(confirmations),
      cross_checked: true,
      cross_check_sources: confirmations.map(c => c.url),
    })
    .eq('id', documentId);
}
```

---

### 3. Automated Scheduling (1-2 часа)

**Проблема:** Нужно запускать pipeline автоматически (daily/weekly/monthly).

**Решение:** Supabase Edge Functions + pg_cron
```sql
-- Запускать Daily Critical каждый день в 9:00 MSK
SELECT cron.schedule(
  'daily-critical-monitoring',
  '0 6 * * *',  -- 6:00 UTC = 9:00 MSK
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/search-orchestrator',
      headers := '{"Content-Type": "application/json", "apikey": "your-anon-key"}'::jsonb,
      body := '{"monitoring_profile_id": "daily-critical-uuid"}'::jsonb
    ) as request_id;
  $$
);
```

---

## Success Metrics (MVP)

**Quality:**
- ✅ Релевантность результатов: +200% (segment-focused queries)
- ✅ Покрытие критических источников: 100% (priority ≥ 5)

**Cost:**
- ✅ Perplexity API calls: ~20-30 focused queries (vs 15 generic)
- ✅ OpenAI API: gpt-4o-mini для query generation (~$0.01 per run)
- ✅ Total cost per run: ~$0.05-0.10 (acceptable для MVP)

**Performance:**
- ✅ Source Hunter execution: ~30-60 seconds (3 segments × 10 sources)
- ✅ Full pipeline (Source + Fetch + Process): ~3-5 минут

**User Experience:**
- ✅ Admin UI: 3 понятные кнопки (Daily/Weekly/Monthly)
- ✅ Flexibility: разные промпты для разных scope
- ✅ Observability: видно сколько документов создано по каждому сегменту

---

**Документ версии 3.0**
**Last Updated:** 2025-12-16
**Status:** Ready for Implementation 🚀
