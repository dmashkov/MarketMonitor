# TODO List - MarketMonitor

**Последнее обновление:** 2025-12-16
**Версия:** 0.8.0
**Статус:** Phase 3 ✅ Complete, Phase 4 Parts 1-4 ✅ Complete, 🎯 NEW ARCHITECTURE Ready for Implementation
**AI Provider:** OpenAI API (gpt-4o + gpt-4o-mini) + Perplexity API (sonar)
**Frontend:** Netlify Deploy
**Architecture:** Scope-Aware + Segment-Aware Query Generation (3 Monitoring Profiles)

**См. также:**
- [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) - текущий статус
- [AI_AGENTS_ARCHITECTURE_V3.md](AI_AGENTS_ARCHITECTURE_V3.md) - новая архитектура ⭐
- [ROADMAP.md](ROADMAP.md) - долгосрочный план

---

## ⚠️ ОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ

Перед началом разработки ПРОЧИТАЙ: **CLAUDE.md**

### ✅ Все разработчики ДОЛЖНЫ соблюдать:

1. **Модульная архитектура** (НЕ монолитная!)
   - Каждый модуль в папке со своими компонентами, hooks, types, api
   - Модули могут импортировать только из shared/ и lib/
   - Модули НЕ должны импортировать друг из друга напрямую

2. **Строгая типизация** (NO ANY!)
   - 🚫 НИКОГДА не использовать `any`, `unknown`
   - ✅ Все функции имеют явные параметры и return типы
   - ✅ Все API ответы типизированы через interface
   - ✅ Edge Functions type-safe responses

3. **OpenAI API** (не Claude!)
   - 🚫 НЕ использовать Anthropic Claude
   - ✅ Использовать OpenAI (GPT-4o, GPT-4o-mini, text-embedding-3-small)
   - ✅ Переменная окружения: `OPENAI_API_KEY`

4. **Netlify Deploy**
   - ✅ Все переменные окружения в `.env.local`
   - ✅ `.env` файл в `.gitignore` (никогда не коммитить!)
   - ✅ Build оптимизирован для SPA на Netlify

---

## 🚀 PHASE 4: AI Agents Implementation (IN PROGRESS)

### ✅ PHASE 3 ЗАВЕРШЕНА (Phase 3 Complete)

**Дата:** 2025-12-12

✅ **Completed:**
- [x] Migration 009: Documents table with pgvector
- [x] Supabase Storage bucket configured
- [x] 9 Edge Functions deployed
- [x] 4 Admin Modules (Brands, Sources, Documents, Users)
- [x] Full CRUD operations working
- [x] RLS policies applied
- [x] Type-safe code (NO ANY)

---

## 🎯 PHASE 4 PART 4B: Scope-Aware Architecture Implementation (НОВОЕ - 2025-12-16)

**Priority:** ⭐ CRITICAL - Architectural Foundation
**Time Estimate:** 2-3 часа
**Описание:** Реализация Scope-Aware + Segment-Aware Query Generation

### Task 1: Database Migrations (30 минут)

#### A. Migration 027: Source Type Priorities
- [ ] Создать `supabase/migrations/027_source_types_priority.sql`
- [ ] Добавить column `priority INT DEFAULT 3` к `source_types`
- [ ] Seed priorities:
  - `priority = 5` для distributor, manufacturer, government, tender_platform
  - `priority = 3` для association
  - `priority = 2` для business_media, analytics
- [ ] Создать index `idx_source_types_priority`
- [ ] Применить миграцию на Supabase

**Files:**
- `supabase/migrations/027_source_types_priority.sql`

**Commands:**
```bash
# Применить миграцию
SUPABASE_ACCESS_TOKEN="your-token" npx supabase db push
```

---

#### B. Migration 028: Prompt Templates & Monitoring Profiles
- [ ] Создать `supabase/migrations/028_prompt_templates_profiles.sql`
- [ ] Добавить `priority INT` к `prompt_templates`
- [ ] Добавить `min_source_priority INT DEFAULT 1` к `monitoring_profiles`
- [ ] Seed 3 prompt templates:
  - Daily Critical Events (priority 5)
  - Weekly Industry Overview (priority 3)
  - Monthly Global Trends (priority 2)
- [ ] Seed 3 monitoring profiles (linked to templates)
- [ ] Применить миграцию на Supabase

**Files:**
- `supabase/migrations/028_prompt_templates_profiles.sql`

**Validation:**
```sql
-- Проверить данные
SELECT * FROM source_types ORDER BY priority DESC;
SELECT * FROM prompt_templates;
SELECT * FROM monitoring_profiles;
```

---

### Task 2: Source Hunter V2 Implementation (1-1.5 часа)

#### A. Update getSearchSources() - Priority Filtering (15 мин)
- [ ] Добавить параметр `min_priority` к функции
- [ ] Фильтровать источники: `source_types.priority >= min_priority`
- [ ] ORDER BY priority DESC
- [ ] LIMIT по `max_sources`

**File:** `supabase/functions/source-hunter/index.ts`

**Code:**
```typescript
async function getSearchSources(
  segment_ids?: string[],
  geography_ids?: string[],
  min_priority: number = 1,
  max_sources: number = 20
): Promise<SearchSource[]> {
  // См. AI_AGENTS_ARCHITECTURE_V3.md, раздел "Source Hunter V2"
}
```

---

#### B. Add getSegments() Helper (5 мин)
- [ ] Создать функцию `getSegments(segment_ids: string[])`
- [ ] Загружать `id, code, name, description` из таблицы `segments`

**Code:**
```typescript
async function getSegments(segment_ids: string[]): Promise<Segment[]> {
  const { data } = await supabase
    .from('segments')
    .select('id, code, name, description')
    .in('id', segment_ids);
  return data as Segment[];
}
```

---

#### C. Add generateSegmentAwareQueries() (30 мин)
- [ ] Создать функцию для генерации focused queries
- [ ] Для каждого segment: вызвать GPT-4o-mini
- [ ] Передать: basePrompt, segment info, sources list
- [ ] Вернуть: `Map<segment_id, Map<source_id, query>>`

**Code:**
```typescript
async function generateSegmentAwareQueries(
  basePrompt: string,
  sources: SearchSource[],
  segments: Segment[]
): Promise<Map<string, Map<string, string>>> {
  // См. AI_AGENTS_ARCHITECTURE_V3.md, раздел "Source Hunter V2"
  // Использовать gpt-4o-mini для query generation
}
```

---

#### D. Update saveDocument() - Add Segment Linking (10 мин)
- [ ] Переименовать в `saveDocumentWithSegment()`
- [ ] После создания документа: INSERT в `document_segments`
- [ ] Параметры: `title, url, sourceId, segmentId, documentType`

**Code:**
```typescript
async function saveDocumentWithSegment(
  title: string,
  url: string,
  sourceId: string,
  segmentId: string,
  documentType: 'webpage' = 'webpage'
): Promise<string | null> {
  // 1. Create document
  // 2. Link to segment via document_segments
  // См. AI_AGENTS_ARCHITECTURE_V3.md
}
```

---

#### E. Update Main Handler (10 мин)
- [ ] Добавить `min_source_priority` к `SourceHunterRequest`
- [ ] Вызвать `getSegments()`
- [ ] Вызвать `generateSegmentAwareQueries()`
- [ ] Loop: для каждого segment × source → searchDocuments()
- [ ] Сохранять с `saveDocumentWithSegment()`

**Changes:**
```typescript
interface SourceHunterRequest {
  prompt: string;
  segment_ids?: string[];
  geography_ids?: string[];
  min_source_priority?: number;  // ← НОВОЕ
  max_sources_per_run?: number;
}
```

---

### Task 3: Orchestrator Update (15 мин)

#### Update runSourceHunter() Call
- [ ] Добавить `min_source_priority` к body запроса
- [ ] Передавать `profile.min_source_priority || 1`

**File:** `supabase/functions/search-orchestrator/index.ts`

**Code:**
```typescript
body: JSON.stringify({
  prompt,
  monitoring_profile_id: monitoringProfileId,
  search_run_id: searchRunId,
  segment_ids: profile.segment_ids,
  geography_ids: profile.geography_ids,
  min_source_priority: profile.min_source_priority || 1,  // ← НОВОЕ
  max_sources_per_run: profile.max_sources_per_run || 20,
}),
```

---

### Task 4: Admin UI Update (30 мин)

#### Update RunPipelinePanel Component
- [ ] Load monitoring profiles from DB
- [ ] Display 3 cards (Daily/Weekly/Monthly)
- [ ] Show profile metadata (priority, max_sources, min_source_priority)
- [ ] Add "Запустить" button for each profile
- [ ] Call orchestrator with `profile.id`

**File:** `frontend/src/modules/admin/pipeline/RunPipelinePanel.tsx`

**UI Design:**
```tsx
<Card title="🔥 Daily Critical Monitoring">
  <Descriptions>
    <Item label="Priority">HIGH (5)</Item>
    <Item label="Max Sources">30</Item>
    <Item label="Min Source Priority">5 (distributors, manufacturers)</Item>
  </Descriptions>
  <Button onClick={() => runPipeline(dailyProfileId)}>
    Запустить
  </Button>
</Card>
```

---

### Task 5: Testing & Validation (15 мин)

#### A. Database Validation
- [ ] Проверить source_types.priority заполнены
- [ ] Проверить 3 prompt_templates созданы
- [ ] Проверить 3 monitoring_profiles созданы
- [ ] Проверить min_source_priority установлены

**Commands:**
```sql
SELECT id, code, priority FROM source_types ORDER BY priority DESC;
SELECT id, name, stage, priority FROM prompt_templates;
SELECT id, name, min_source_priority, max_sources_per_run FROM monitoring_profiles;
```

---

#### B. Source Hunter Testing
- [ ] Deploy updated `source-hunter` to Supabase
- [ ] Test via Postman/curl с `min_source_priority = 5`
- [ ] Проверить что возвращаются только high-priority sources
- [ ] Проверить segment-aware queries generation
- [ ] Проверить document_segments linking создается

**Command:**
```bash
SUPABASE_ACCESS_TOKEN="your-token" npx supabase functions deploy source-hunter
```

---

#### C. End-to-End Pipeline Test
- [ ] Deploy `search-orchestrator`
- [ ] Запустить через Admin UI кнопку "Daily Critical"
- [ ] Проверить логи: Source Hunter → Content Fetcher → Document Processor
- [ ] Проверить созданные документы в БД
- [ ] Проверить segment linking в `document_segments`

---

### Success Criteria

**Quality:**
- ✅ Queries focused on specific segments (RAC, VRF, CHILLER)
- ✅ Only high-priority sources used for Daily Critical
- ✅ Segment linking работает (`document_segments` заполняется)

**Functionality:**
- ✅ 3 кнопки в Admin UI работают
- ✅ Каждая кнопка запускает соответствующий monitoring profile
- ✅ Pipeline завершается без ошибок
- ✅ Документы создаются с правильными segment links

**Performance:**
- ✅ Source Hunter выполнение: ~30-60 seconds (3 segments × 10 sources)
- ✅ Full pipeline: ~3-5 минут

---

## 🔥 PHASE 4: IMMEDIATE TASKS (This Week)

### 1️⃣ Documents Library Finalization (1-2 часа)

**Priority:** HIGH - Quick wins to complete Phase 3

#### A. Семантический поиск
- [ ] Проверить RPC функцию `search_documents_by_embedding` в Supabase
- [ ] Если нужна - создать в БД:
  ```sql
  CREATE OR REPLACE FUNCTION search_documents_by_embedding(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
  )
  ```
- [ ] Протестировать через DocumentsLibrary UI
- [ ] Убедиться, что cosine similarity работает

#### B. Просмотр файлов
- [ ] Добавить кнопку "Скачать" в таблице документов
  - Download icon + text
  - Использовать file_url из Storage
  - Open in new tab
- [ ] Рендерить file_url как кликабельную ссылку
- [ ] Иконка PDF/DOCX/PPTX рядом с названием (FilePdfOutlined, FileWordOutlined, etc.)

#### C. UX улучшения
- [ ] Отображение размера файла в таблице (format bytes → KB/MB)
- [ ] Добавить фильтр по document_type (PDF/DOCX/PPTX/HTML)
- [ ] Превью первых 200 символов content_text в tooltip

**Files to modify:**
- `frontend/src/modules/admin/documents/DocumentsLibrary.tsx`
- Add columns: fileSize, documentType
- Add filters: documentType select
- Add actions: Download button

---

### 2️⃣ Source Hunter Agent (2-3 часа)

**Priority:** HIGH - Core Phase 4 functionality

#### Edge Function: `supabase/functions/agents/source-hunter/index.ts`

**Functionality:**
- [ ] Accept POST request with:
  - `prompt`: search query (e.g., "новые кондиционеры на рынке")
  - `segment_ids[]`: optional filters
  - `geography_ids[]`: optional filters
  - `date_range_days`: optional (default: 7)

- [ ] Query available sources from `sources` table
- [ ] Build search queries for each source
- [ ] Use OpenAI to generate web search queries
- [ ] Execute searches (via OpenAI API or web scraping)
- [ ] Extract URLs from results
- [ ] Create documents in `documents` table:
  - `title`: from search result
  - `source_id`: from source
  - `document_type`: "webpage"
  - `file_url`: search result URL
  - `published_date`: now()
  - `content_text`: summary or headline
- [ ] Queue for Document Processor Agent
- [ ] Return: `{ status: "success", documents_created: N, urls: [...] }`

**Implementation steps:**
1. Create edge function folder
2. Implement source selection logic
3. Implement search query generation
4. Implement document creation
5. Test with Postman
6. Handle errors properly

**Type-safe interfaces:**
```typescript
interface SourceHunterRequest {
  prompt: string;
  segment_ids?: string[];
  geography_ids?: string[];
  date_range_days?: number;
}

interface SourceHunterResponse {
  status: 'success' | 'error';
  documents_created: number;
  urls: string[];
  error?: string;
}
```

---

### 3️⃣ Content Fetcher Agent (1-2 часа)

**Priority:** HIGH - Depends on Source Hunter

#### Edge Function: `supabase/functions/agents/content-fetcher/index.ts`

**Functionality:**
- [ ] Accept POST request with:
  - `document_id`: UUID
  - `url`: string
  - `source_type`: 'distributor' | 'manufacturer' | 'media' | 'website'

- [ ] Fetch content from URL
  - Use Deno fetch API
  - Handle redirects
  - Timeout: 10 seconds

- [ ] Parse HTML content
  - Extract text from HTML (remove scripts, styles)
  - Use cheerio or similar
  - Extract title, description, main content

- [ ] Detect document type
  - If PDF → extract text (pdfjs or similar)
  - If Word → extract text
  - If HTML → clean text extraction

- [ ] Save content to document:
  - `content_html`: raw HTML
  - `content_text`: cleaned text
  - `title`: extracted title
  - `meta_title`: from meta tags
  - `meta_description`: from meta tags

- [ ] Queue for Document Processor
- [ ] Return: extracted content

---

### 4️⃣ Document Processor Agent (2-3 часа)

**Priority:** HIGH - Core processing

#### Edge Function: `supabase/functions/agents/document-processor/index.ts`

**Functionality:**
- [ ] Accept POST request with `document_id`

- [ ] Read document from database
- [ ] Validate content exists (content_text or content_html)

- [ ] Text extraction
  - If HTML → use cheerio to extract text
  - Clean: remove extra whitespace, normalize encoding
  - Truncate to max 5000 chars for embedding

- [ ] Generate embedding
  - Call OpenAI API: `text-embedding-3-small`
  - Model: text-embedding-3-small
  - Dimensions: 1536
  - Save to `embedding` column (vector type)

- [ ] Mentions extraction
  - Extract brand mentions (from `brands` table)
  - Extract segment mentions (from `segments` table)
  - Extract geography mentions (from `geographies` table)
  - Save to `mentioned_brands`, `mentioned_segments`, `mentioned_geographies`

- [ ] Queue for Event Extractor
- [ ] Return: `{ status: "success", embedding_generated: true }`

**Implementation notes:**
- Embedding generation cost: ~$0.002 per 1K docs
- Cache embeddings to avoid regeneration
- Batch process if possible

---

### 5️⃣ Event Extractor Agent (3-4 часа)

**Priority:** HIGH - Main business logic

#### Edge Function: `supabase/functions/agents/event-extractor/index.ts`

**Functionality:**
- [ ] Accept POST request with `document_id`

- [ ] Read document content
- [ ] If content > 2000 chars → chunk into 2000-char segments

- [ ] For each chunk, call OpenAI with extraction prompt:
```
Вы - аналитик рынка климатического оборудования.
Извлеките рыночные события из текста.
Каждое событие - отдельный JSON объект.

Формат:
{
  "title": "название события",
  "description": "описание",
  "event_type": "promo|price|contract|product|acquisition|partnership|regulatory",
  "company": "компания",
  "geography": "регион",
  "channel": "B2B|B2G|B2C",
  "relevance_score": 1-5,
  "mentioned_brands": ["Daikin", "Midea"],
  "mentioned_segments": ["RAC", "VRF"],
  "reasoning": "почему это важно"
}

Текст:
{content}

JSON массив или пусто если событий нет.
```

- [ ] Parse JSON responses (with validation)
- [ ] Validate events:
  - Required fields: title, description, event_type
  - Company must exist or create
  - Reject if relevance_score < 2

- [ ] Save events to `events` table:
  - `title`, `description`, `event_type`
  - `company`, `geography`, `channel`
  - `source_id`, `document_id` (links)
  - `mentioned_brands`, `mentioned_segments`
  - `raw_data`: full OpenAI response (JSONB)

- [ ] Return: `{ status: "success", events_created: N }`

**Cost optimization:**
- Batch 5-10 documents at once
- Use gpt-4o-mini for cost savings
- Cache embeddings to reduce API calls

---

## 🟡 PHASE 4: SECONDARY TASKS (Next 1-2 weeks)

### 6️⃣ Criticality Scorer Agent

- [ ] Edge Function: `agents/criticality-scorer/index.ts`
- [ ] Batch process 10 events at once
- [ ] Score 1-5 scale
- [ ] Save reasoning and factors
- [ ] Update events table

### 7️⃣ Duplicate Detector Agent

- [ ] Edge Function: `agents/duplicate-detector/index.ts`
- [ ] Cosine similarity search
- [ ] Merge similar events
- [ ] Threshold: 0.85

### 8️⃣ Alert Manager Agent

- [ ] Edge Function: `agents/alert-manager/index.ts`
- [ ] Telegram bot integration
- [ ] Email notifications
- [ ] In-app alerts table

### 9️⃣ Report Generator Agent

- [ ] Edge Function: `agents/report-generator/index.ts`
- [ ] Daily/Weekly/Monthly reports
- [ ] Export to PDF/DOCX
- [ ] Save to reports table

### 🔟 Orchestrator

- [ ] Edge Function: `agents/orchestrator/index.ts`
- [ ] Coordinate all agents
- [ ] Error handling + retry logic
- [ ] Progress tracking

---

## 🟠 PHASE 4: FRONTEND TASKS (Next 2 weeks)

### Custom Prompt Builder UI

- [ ] Create `modules/prompts/custom/CustomPromptBuilder.tsx`
- [ ] 3-step wizard
- [ ] Step 1: Select goal (find events / analyze trends / compare)
- [ ] Step 2: Filters (brands, segments, geography, date range)
- [ ] Step 3: Custom instructions + preview
- [ ] Save & run functionality

### Events Display Updates

- [ ] Add source tracking column
- [ ] Add criticality badges (color-coded 1-5)
- [ ] Add filtering by criticality
- [ ] Add event source URL link

### Reports Viewer

- [ ] Display saved reports
- [ ] Filter by date range
- [ ] Export options (PDF, DOCX)
- [ ] Report previews

---

## ⚪ PHASE 5: FUTURE TASKS (Next 3-4 weeks)

### GitHub Actions Automation

- [ ] Create `.github/workflows/daily-search.yml`
- [ ] Schedule: `0 9 * * *` (09:00 UTC)
- [ ] Trigger orchestrator
- [ ] Environment setup

### Monitoring & Logging

- [ ] Implement Sentry or similar
- [ ] Track error rates
- [ ] Monitor token usage
- [ ] Track cost per day

### Performance Optimization

- [ ] Profile API calls
- [ ] Optimize embedding generation
- [ ] Cache results
- [ ] Batch processing

### Testing

- [ ] E2E tests for full pipeline
- [ ] Load testing (embeddings)
- [ ] Cost analysis
- [ ] Quality assessment

---

## 📋 COMPLETED ✅

### Phase 1: Foundation
- [x] React 18 + TypeScript setup
- [x] Tailwind CSS + Ant Design
- [x] Documentation

### Phase 2: MVP
- [x] Authentication (login, register, protected routes)
- [x] Events CRUD
- [x] 4 SQL migrations (001-004)
- [x] RLS policies

### Phase 3: Admin UI
- [x] Database migrations (005-009)
- [x] Supabase Storage setup
- [x] 9 Edge Functions (brands, sources, documents, users, segments, geographies)
- [x] Brands Management module
- [x] Sources Management module
- [x] Documents Library module
- [x] Users Management module
- [x] AdminPanel with 4 tabs
- [x] Full CRUD operations
- [x] Type-safe code (NO ANY)
- [x] RLS policies applied
- [x] CORS headers configured

---

## 🎯 PRIORITY MATRIX

### 🔴 CRITICAL (Must do this week)
1. Document Library finalization (1-2h)
2. Source Hunter Agent (2-3h)
3. Content Fetcher Agent (1-2h)
4. Document Processor Agent (2-3h)

### 🟡 HIGH (Should do this week)
5. Event Extractor Agent (3-4h)
6. Criticality Scorer (Next week)
7. Frontend updates (Next week)

### 🟠 MEDIUM (Next 1-2 weeks)
- Duplicate Detector
- Alert Manager
- Report Generator
- Orchestrator

### 🟢 LOW (Next 2-4 weeks)
- GitHub Actions automation
- Monitoring & logging
- Performance optimization
- Testing & polish

---

## 📊 STATS

### Phase 3 Completion
- ✅ 100% Admin UI complete
- ✅ 9 Edge Functions deployed
- ✅ 4 Admin Modules
- ✅ 5000+ lines of code
- ✅ 17 total commits

### Phase 4 Progress
- 🚀 0% (Starting)
- [ ] 5 core agents to implement
- [ ] 4 supporting agents to implement
- [ ] Full pipeline integration

---

## 🔄 AUTO-UPDATE PROTOCOL

**After each `git push`:**
1. Update CLAUDE.md (version + status)
2. Update DEVELOPMENT_STATUS.md (progress %)
3. Update PROGRESS.md (session notes)
4. Update TODO.md (this file - completed tasks)
5. Update ROADMAP.md (timeline if needed)

---

**Version:** 0.6.0
**Last Updated:** 2025-12-13
**Status:** Phase 4 Starting 🚀
**Next Update:** After next `git push`
