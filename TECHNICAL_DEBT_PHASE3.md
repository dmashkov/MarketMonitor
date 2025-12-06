# 📋 Технический Долг - Phase 3: Source Management

**Дата создания:** 2024-12-07
**Статус:** В процессе исправления
**Приоритет:** 🔥 Высокий

---

## 📊 Общий Прогресс Phase 3

```
Phase 3.1 Database Schema           ████████████████████ 100% ✅ DONE
Phase 3.2 Backend API               ████████████████████ 100% ✅ CREATED (not deployed)
Phase 3.3 Frontend UI                ░░░░░░░░░░░░░░░░░░░░   0% ⏳ TODO
Phase 3.4 Specialized Prompts        ░░░░░░░░░░░░░░░░░░░░   0% ⏳ TODO
Phase 3.5 Dynamic Source Loading     ░░░░░░░░░░░░░░░░░░░░   0% ⏳ TODO

ИТОГО Phase 3:                      ████░░░░░░░░░░░░░░░░  40%
```

---

## ✅ ЧТО СДЕЛАНО

### 1. Database Schema (100% ✅)

**Файлы:**
- ✅ `supabase/migrations/005_sources_and_segments.sql` (12,887 bytes)
- ✅ `supabase/migrations/006_seed_sources_data.sql` (18,141 bytes)

**Созданные таблицы:**
- ✅ `segments` - 8 сегментов оборудования (RAC, VRF, Chiller, AHU, Industrial Heat, Heat Pump, Ventilation, Refrigeration)
- ✅ `geographies` - РФ + 7 федеральных округов + 4 города
- ✅ `source_types` - 6 типов источников
- ✅ `sources` - источники для мониторинга
- ✅ `source_urls` - конкретные URL для парсинга
- ✅ Расширена `events` - добавлены: `source_id`, `criticality_level`, `segment_id`, `geography_id`
- ✅ Расширена `ai_prompts` - добавлены: `segment_id`, `geography_id`, `search_depth`
- ✅ `prompt_segments` - Many-to-Many связь промптов и сегментов

**Seed данные (Migration 006):**
- ✅ **15 источников:**
  - Дистрибьюторы: Русклимат, Даичи, АЯК, Бриз
  - Производители: MIDEA, GREE, HAIER, TCL, HISENSE
  - СМИ: Forbes, Ведомости, Коммерсантъ, РБК
  - Ассоциации: АВОК, АПИК
- ✅ **3 примера специализированных промптов:**
  - Daily RAC Акции (ежедневный поиск акций)
  - Weekly VRF Проекты (еженедельный поиск проектов)
  - Monthly Market Trends (ежемесячные тренды)
- ✅ **7+ конкретных URL** для мониторинга

**RLS Policies:**
- ✅ Read access для всех пользователей
- ✅ Write access только для admin
- ✅ Все таблицы защищены

### 2. Backend API (100% ✅ Created)

**Edge Functions созданы:**
- ✅ `supabase/functions/sources-api/` - CRUD для источников
  - GET /sources - список с фильтрами (type, active, frequency, priority)
  - GET /sources/:id - детали источника
  - POST /sources - создать (admin only)
  - PATCH /sources/:id - обновить (admin only)
  - DELETE /sources/:id - удалить (admin only)

- ✅ `supabase/functions/source-urls-api/` - управление URL
  - GET /source-urls?source_id=xxx
  - POST /source-urls - добавить URL
  - PATCH /source-urls/:id - обновить
  - DELETE /source-urls/:id - удалить

- ✅ `supabase/functions/segments-api/` - сегменты
  - GET /segments - список сегментов
  - POST /segments - создать (admin only)

- ✅ `supabase/functions/geographies-api/` - география
  - GET /geographies - список с фильтрами
  - GET /geographies/:id/children - дочерние зоны (иерархия)

- ✅ `supabase/functions/ai-search/` - AI поиск
  - Использует `gpt-4o-search-preview`
  - Реальный веб-поиск климатических новостей
  - Работает! ✅

### 3. TypeScript Types (100% ✅)

**Обновлены типы:** `frontend/src/shared/types/`
- ✅ `SegmentEntity`
- ✅ `Geography`
- ✅ `Source`
- ✅ `SourceType`
- ✅ `SourceUrl`
- ✅ `CriticalityLevel` (1-5)
- ✅ `SearchDepth` ('daily' | 'weekly' | 'monthly')
- ✅ Расширены `MarketEvent` и `AIPrompt`

---

## ⏳ ЧТО НУЖНО СДЕЛАТЬ ПОЛЬЗОВАТЕЛЮ

### ЗАДАЧА 1: Применить миграции в Supabase ⏱️ 10 минут

**Статус:** ⏳ Не применены

**Инструкции:**

#### Вариант А: Через Supabase CLI (рекомендуется)
```bash
# 1. Проверь наличие миграций
ls supabase/migrations/
# Должны быть:
# 005_sources_and_segments.sql
# 006_seed_sources_data.sql

# 2. Примени миграции
supabase db push

# 3. Проверь результат
supabase db remote changes
```

#### Вариант Б: Через Supabase Dashboard
1. Зайти в Supabase Dashboard → SQL Editor
2. Открыть файл `supabase/migrations/005_sources_and_segments.sql`
3. Скопировать весь SQL код
4. Вставить в SQL Editor и нажать **Run**
5. Повторить для `006_seed_sources_data.sql`

**Проверка успеха:**
```sql
-- Выполни в SQL Editor:
SELECT COUNT(*) FROM sources;       -- Должно вернуть 15
SELECT COUNT(*) FROM segments;      -- Должно вернуть 8
SELECT COUNT(*) FROM geographies;   -- Должно вернуть 12+
SELECT COUNT(*) FROM source_types;  -- Должно вернуть 6

-- Проверь структуру:
SELECT name, website_url FROM sources LIMIT 5;
SELECT name, code FROM segments;
```

**Ожидаемый результат:**
```
sources: 15 записей (Русклимат, MIDEA, Forbes, АВОК, и т.д.)
segments: 8 записей (RAC, VRF, Chiller, AHU, и т.д.)
geographies: 12+ записей (РФ, округа, города)
source_types: 6 записей (DISTRIBUTOR, MANUFACTURER, и т.д.)
```

---

### ЗАДАЧА 2: Задеплоить Edge Functions ⏱️ 15 минут

**Статус:** ⏳ Не задеплоены

**Инструкции:**
```bash
# Деплой всех Edge Functions:
supabase functions deploy sources-api
supabase functions deploy source-urls-api
supabase functions deploy segments-api
supabase functions deploy geographies-api

# ai-search уже задеплоен (работает!)
# Но можешь обновить, если нужно:
# supabase functions deploy ai-search
```

**Проверка успеха:**
```bash
# Список всех задеплоенных функций:
supabase functions list

# Должны быть:
# ✅ ai-search
# ✅ sources-api
# ✅ source-urls-api
# ✅ segments-api
# ✅ geographies-api
```

**Тестирование API (после деплоя):**
```bash
# Получить список источников:
curl https://YOUR_PROJECT.supabase.co/functions/v1/sources-api/sources \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Получить список сегментов:
curl https://YOUR_PROJECT.supabase.co/functions/v1/segments-api/segments \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

### ЗАДАЧА 3: Проверить AI Search работает с новыми источниками ⏱️ 5 минут

**Статус:** ⏳ Пока использует хардкод

**Инструкции:**
1. Открой приложение на Netlify
2. Перейди в Dashboard
3. Запусти AI Поиск (панель уже работает)
4. Проверь что находит события
5. Проверь что source_url заполнены

**Ожидаемый результат:**
- События найдены (5-15 штук)
- Все события имеют source_url
- Ссылки кликабельны и ведут на реальные статьи

---

## 🚀 ЧТО БУДЕТ ДЕЛАТЬ AI (После выполнения задач пользователя)

### ПРИОРИТЕТ 1: Доработать AI Search для динамической загрузки источников ⏱️ 2-3 часа

**Цель:** ai-search должен загружать источники из таблицы `sources`, а не использовать хардкод

**Текущая проблема:**
```typescript
// supabase/functions/ai-search/index.ts:114-122
// Сейчас хардкод:
ИСТОЧНИКИ для поиска (обязательно используй web search):
- https://rusclimate.ru/ (новости дистрибьютора)
- https://www.avok.ru/ (отраслевые новости)
- https://www.kommersant.ru/ (бизнес новости)
// ...
```

**Что надо сделать:**
1. ai-search загружает активные источники из таблицы `sources`:
   ```sql
   SELECT s.name, s.website_url, st.name as type_name
   FROM sources s
   JOIN source_types st ON s.source_type_id = st.id
   WHERE s.is_active = true
   ORDER BY s.priority DESC
   ```

2. Формирует промпт динамически:
   ```typescript
   const sourcesText = sources.map(s =>
     `- ${s.website_url} (${s.type_name}: ${s.name})`
   ).join('\n');
   ```

3. Учитывает приоритет и частоту проверки

**Файлы для изменения:**
- `supabase/functions/ai-search/index.ts` (функция `createSearchPrompt`)

---

### ПРИОРИТЕТ 2: Создать Source Management UI ⏱️ 1-2 дня

**Цель:** Admin интерфейс для управления источниками

**Модуль:** `frontend/src/modules/admin/sources/`

**Компоненты для создания:**

1. **SourcesManager.tsx** (основная страница)
   - Таблица всех источников (Ant Design Table)
   - Колонки: Name, Type, Website, Priority, Frequency, Active, Actions
   - Фильтры: type, active, frequency, priority
   - Поиск по названию
   - Кнопки: Create, Edit, Delete (admin only)

2. **SourceFormModal.tsx** (форма создания/редактирования)
   - Поля:
     - name (text, required)
     - source_type_id (select, required)
     - website_url (url)
     - telegram_channel (text)
     - description (textarea)
     - priority (number, 1-10)
     - check_frequency (select: daily/weekly/monthly)
     - is_active (checkbox)
   - Валидация через react-hook-form + zod
   - Создание и редактирование

3. **SourceUrlsManager.tsx** (управление URL)
   - Список URL для выбранного источника
   - Типы: news, products, blog, press-release
   - Добавление/удаление конкретных адресов

4. **SourceTypeTag.tsx** (цветные badges)
   - Цветная маркировка типов:
     - DISTRIBUTOR - синий
     - MANUFACTURER - зелёный
     - BUSINESS_MEDIA - оранжевый
     - TELEGRAM - фиолетовый
     - ASSOCIATION - голубой
     - INDUSTRY_PORTAL - серый

5. **Hooks:**
   - `useSources()` - React Query hook для CRUD источников
   - `useSourceUrls()` - управление URL
   - `useSegments()` - загрузка сегментов
   - `useGeographies()` - загрузка географии

6. **Integration:**
   - Добавить вкладку "Sources" в AdminPanel
   - Admin-only routing

**Структура:**
```
frontend/src/modules/admin/sources/
├── components/
│   ├── SourcesManager.tsx
│   ├── SourceFormModal.tsx
│   ├── SourceUrlsManager.tsx
│   └── SourceTypeTag.tsx
├── hooks/
│   ├── useSources.ts
│   ├── useSourceUrls.ts
│   ├── useSegments.ts
│   └── useGeographies.ts
└── index.ts
```

---

### ПРИОРИТЕТ 3: Библиотека специализированных промптов ⏱️ 1 день

**Цель:** Расширить PromptLibrary новыми полями (segment, geography, search_depth)

**Модуль:** `frontend/src/modules/admin/prompts/` (расширение)

**Компоненты для обновления:**

1. **PromptLibrary.tsx** (обновить)
   - Фильтры: segment, geography, search_depth
   - Группировка по глубине:
     - 🟢 Daily (ежедневные)
     - 🔵 Weekly (еженедельные)
     - 🟣 Monthly (ежемесячные)
   - Иконки для быстрой идентификации

2. **PromptFormModal.tsx** (обновить)
   - Новые поля:
     - segment_id (select из segments)
     - geography_id (select из geographies)
     - search_depth (radio: daily/weekly/monthly)
   - Multi-select для связи с несколькими сегментами

3. **PromptTemplates.tsx** (NEW)
   - Библиотека готовых шаблонов:
     - "Daily RAC Акции" (поиск акций бытовых кондиционеров)
     - "Weekly VRF Проекты" (контракты на VRF системы)
     - "Monthly Market Trends" (аналитика рынка)
     - "Chiller Tender Monitoring" (тендеры на чиллеры)
     - "AHU Government Contracts" (госконтракты на вентиляцию)
   - Кнопка "Использовать шаблон"

---

## 📋 ДЕТАЛЬНЫЙ ПЛАН ДЕЙСТВИЙ

### Этап 1: Пользователь (30 минут)

1. ✅ Применить миграции 005-006 (10 минут)
2. ✅ Задеплоить Edge Functions (15 минут)
3. ✅ Проверить AI Search работает (5 минут)

### Этап 2: AI - Динамическая загрузка источников (2-3 часа)

1. Обновить `ai-search/index.ts`:
   - Загрузка источников из БД
   - Динамическое формирование промпта
   - Учет приоритета
2. Тестирование
3. Деплой обновленной функции

### Этап 3: AI - Source Management UI (1-2 дня)

1. День 1:
   - Создать модуль `modules/admin/sources/`
   - SourcesManager.tsx
   - SourceFormModal.tsx
   - useSources hook
   - Интеграция в AdminPanel

2. День 2:
   - SourceUrlsManager.tsx
   - useSourceUrls hook
   - useSegments, useGeographies hooks
   - Тестирование полного flow

### Этап 4: AI - Specialized Prompts Library (1 день)

1. Обновить PromptLibrary с фильтрами
2. Обновить PromptFormModal с новыми полями
3. Создать PromptTemplates
4. Тестирование

---

## 🎯 КРИТЕРИИ УСПЕХА

### После завершения всех задач:

✅ **Database:**
- 15 источников в таблице `sources`
- 8 сегментов в `segments`
- 12+ зон в `geographies`

✅ **Backend:**
- 5 Edge Functions задеплоены и работают
- AI Search загружает источники из БД
- API возвращает данные корректно

✅ **Frontend:**
- Admin может управлять источниками через UI
- Можно добавлять/редактировать/удалять источники
- Можно управлять конкретными URL
- Библиотека промптов с фильтрами по сегментам/географии/глубине

✅ **AI Search:**
- Использует актуальный список источников из БД
- Учитывает приоритет источников
- Находит 5-15 реальных событий
- Все события имеют source_url

---

## 📊 МЕТРИКИ ПРОГРЕССА

**Текущий прогресс:**
```
Database Schema:        100% ✅
Backend API Code:       100% ✅
Backend Deployment:       0% ⏳ USER TASK
Frontend UI:              0% ⏳ AI TASK
Dynamic Sources:          0% ⏳ AI TASK
Specialized Prompts:      0% ⏳ AI TASK

ИТОГО Phase 3:           40%
```

**После выполнения пользователем задач:**
```
Database Schema:        100% ✅
Backend API Code:       100% ✅
Backend Deployment:     100% ✅ DONE
Frontend UI:              0% ⏳ AI TASK
Dynamic Sources:          0% ⏳ AI TASK
Specialized Prompts:      0% ⏳ AI TASK

ИТОГО Phase 3:           60%
```

**После всех работ:**
```
Database Schema:        100% ✅
Backend API Code:       100% ✅
Backend Deployment:     100% ✅
Frontend UI:            100% ✅
Dynamic Sources:        100% ✅
Specialized Prompts:    100% ✅

ИТОГО Phase 3:          100% ✅ COMPLETE
```

---

## 🔗 ССЫЛКИ НА ФАЙЛЫ

### Миграции (для применения):
- `supabase/migrations/005_sources_and_segments.sql`
- `supabase/migrations/006_seed_sources_data.sql`

### Edge Functions (для деплоя):
- `supabase/functions/sources-api/`
- `supabase/functions/source-urls-api/`
- `supabase/functions/segments-api/`
- `supabase/functions/geographies-api/`
- `supabase/functions/ai-search/` (для обновления)

### Frontend (для создания):
- `frontend/src/modules/admin/sources/` (не существует)
- `frontend/src/modules/admin/prompts/` (для расширения)

### Документация:
- `DEVELOPMENT_STATUS.md` - общий статус проекта
- `TECHNICAL_DEBT_PHASE3.md` - этот файл

---

## 📞 ВОПРОСЫ И УТОЧНЕНИЯ

**Если что-то неясно:**
1. Смотри `DEVELOPMENT_STATUS.md` - полное описание Phase 3
2. Смотри миграции в `supabase/migrations/`
3. Смотри Edge Functions в `supabase/functions/`
4. Спроси AI для уточнений

---

**Создано:** 2024-12-07
**Обновлено:** 2024-12-07
**Автор:** Claude Code + User
**Версия:** 1.0.0

---

## 🚀 СТАРТ РАБОТЫ

**Пользователь, начни с этих команд:**
```bash
# 1. Примени миграции
supabase db push

# 2. Задеплой Edge Functions
supabase functions deploy sources-api
supabase functions deploy source-urls-api
supabase functions deploy segments-api
supabase functions deploy geographies-api

# 3. Проверь результат
supabase functions list
```

**После этого напиши AI: "Миграции применены, функции задеплоены, готов к следующему этапу"**

И AI продолжит работу! 🎯
