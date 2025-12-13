# TODO List - MarketMonitor

**Последнее обновление:** 2025-12-13
**Версия:** 0.6.0
**Статус:** Phase 3 ✅ Complete, Phase 4 🚀 Starting
**AI Provider:** OpenAI API (gpt-4o + gpt-4o-mini + text-embedding-3-small)
**Frontend:** Netlify Deploy
**Architecture:** Multi-Agent System (8 specialized agents)

**См. также:**
- [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) - текущий статус
- [PROGRESS.md](PROGRESS.md) - прогресс разработки
- [AI_AGENTS_ARCHITECTURE.md](AI_AGENTS_ARCHITECTURE.md) - архитектура агентов
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
