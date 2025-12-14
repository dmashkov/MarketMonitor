# 🤖 PHASE 4: AGENT SPECIFICATIONS

**Version:** 1.0.0
**Date:** 2025-12-14
**Status:** Complete Design ✅

---

## 📋 SEQUENTIAL PIPELINE AGENTS

### 1️⃣ SOURCE HUNTER AGENT

**Purpose:** Find URLs and create initial documents

**Input:**
```typescript
{
  monitoring_profile_id: UUID,
  max_sources: number (from profile)
}
```

**Flow:**
1. Load monitoring_profile (gets segment_ids, geography_ids, etc.)
2. Query sources table (filtered by segments/geographies)
3. Generate search queries via gpt-4o-mini
4. Execute search (MOCK on MVP)
5. Create documents with minimal data

**Output:**
```typescript
{
  status: 'success' | 'error',
  documents_created: number,
  document_ids: UUID[],
  errors: Array<{ source_id: UUID, error: string }>
}
```

**Database Changes:**
```sql
INSERT INTO documents (
  title, source_url, source_id, document_type,
  fetched_at, source_type, search_run_id
)
VALUES (...)
RETURNING id
```

**LLM Calls:**
- 1x gpt-4o-mini: Generate search queries (batch for all sources)

**Cost:** ~$0.05 per run

**Duration:** ~10-15 seconds (mocked search)

**Error Handling:**
- If no sources found → error
- If query generation fails → error
- If individual search fails → log and continue

---

### 2️⃣ CONTENT FETCHER AGENT

**Purpose:** Download and extract text from URLs

**Input:**
```typescript
{
  document_ids: UUID[],
  max_size_chars: number (5000)
}
```

**Flow:**
1. For each document:
   a. GET source_url (timeout: 10s, retries: 3)
   b. Parse HTML → extract text
   c. Extract meta tags (published_date)
   d. Limit to 5000 characters
   e. Handle errors gracefully
   f. UPDATE document

**Output:**
```typescript
{
  status: 'success' | 'partial' | 'error',
  documents_updated: number,
  documents_failed: number,
  errors: Array<{ document_id: UUID, error: string }>
}
```

**Database Changes:**
```sql
UPDATE documents SET
  content_text = $1,
  published_date = $2,
  file_size = $3
WHERE id = $4
```

**No LLM Calls**

**Cost:** ~$0 (just HTTP requests)

**Duration:** ~30-60 seconds (3 retries × 10s timeout = max 30s per URL)

**Error Handling:**
- 404 → log as "not found", continue
- 403 → log as "forbidden", continue
- Timeout → retry 3 times with exponential backoff
- Parse error → save error message, continue

---

### 3️⃣ DOCUMENT PROCESSOR AGENT

**Purpose:** Classify documents and generate embeddings

**Input:**
```typescript
{
  document_ids: UUID[]
}
```

**Flow:**
1. For each document:
   a. Load document.content_text
   b. Prepare LLM prompt (substitute placeholders)
   c. Call gpt-4o: classify + extract
   d. Parse JSON response
   e. Insert into linking tables
   f. Generate embeddings (text-embedding-3-small)
   g. Clean content_text
   h. UPDATE document

**LLM Prompt Template:**
```
You are a market analyst for HVAC equipment in Russia.

Analyze the following text about {segment_type} market and classify it.

Available segments: {segments_enum}
Available event types: {event_types_enum}
Available brands: {brands_list}
Available geographies: {geographies_list}

Text to analyze:
---
{document_content_text}
---

Return JSON (strict format required):
{
  "segment_id": "uuid-or-null",
  "event_type_ids": ["uuid1", "uuid2"],
  "brand_ids": ["uuid1"],
  "geography_ids": ["uuid1"]
}

Rules:
- segment_id: main segment category (RAC, VRF, etc.)
- event_type_ids: one or more from the list
- brand_ids: companies mentioned in the text
- geography_ids: locations mentioned
- If uncertain, use null or empty array
```

**Output:**
```typescript
{
  status: 'success' | 'partial' | 'error',
  documents_processed: number,
  documents_failed: number,
  errors: Array<{ document_id: UUID, error: string }>
}
```

**Database Changes:**
```sql
INSERT INTO document_segments (document_id, segment_id) VALUES (...)
INSERT INTO document_event_types (document_id, event_type_id) VALUES (...)
INSERT INTO document_brands (document_id, brand_id) VALUES (...)
INSERT INTO document_geographies (document_id, geography_id) VALUES (...)

UPDATE documents SET
  embedding = $1,
  content_text = $2 (cleaned/canonical)
WHERE id = $3
```

**LLM Calls:**
- 1x gpt-4o per document (batch if possible)

**Cost:** ~$0.50 per 10 documents (gpt-4o pricing)

**Duration:** ~2-3 minutes (for 10 documents)

**Error Handling:**
- Invalid JSON → log error, skip linking tables, continue with embeddings
- Missing LLM key → fail entire step
- Embedding generation fails → log, continue to next document

---

### 4️⃣ DEDUP AGENT

**Purpose:** Find and mark duplicate documents

**Input:**
```typescript
{
  document_ids: UUID[]
}
```

**Flow:**
1. Load all documents with embeddings
2. For each pair of documents:
   a. Calculate cosine similarity
   b. If similarity > dedupe_threshold (0.85):
      - Mark as is_duplicate = TRUE
      - Record relationship
3. Return results

**Output:**
```typescript
{
  status: 'success',
  documents_marked: number,
  duplicates_found: number
}
```

**Database Changes:**
```sql
UPDATE documents SET is_duplicate = TRUE WHERE id IN (...)
```

**No LLM Calls**

**Cost:** ~$0 (math operations)

**Duration:** ~10-20 seconds (for 50 documents, O(n²) comparison)

**Note:** Uses pgvector cosine similarity (`<=>` operator)

---

### 5️⃣ CRITICALITY SCORER AGENT

**Purpose:** Rate importance of documents (1-5)

**Input:**
```typescript
{
  document_ids: UUID[]
}
```

**Flow:**
1. For each document:
   a. Load document + relations (brands, segments, event_types)
   b. Call gpt-4o: score importance
   c. Parse score (1-5)
   d. UPDATE document.criticality_level

**LLM Prompt Template:**
```
You are evaluating market importance of climate equipment news in Russia.

Document summary:
Title: {title}
Segments: {segment_names}
Brands: {brand_names}
Event types: {event_type_names}
Content: {content_text_first_200_chars}

Rate importance (1-5):
1 = Minor, local event, low impact
2 = Regional event, some impact
3 = Noteworthy, moderate impact
4 = Important, significant market impact
5 = Critical, affects entire market

Return JSON:
{
  "criticality_level": 1-5,
  "reasoning": "brief explanation"
}
```

**Output:**
```typescript
{
  status: 'success' | 'partial' | 'error',
  documents_scored: number,
  documents_failed: number
}
```

**Database Changes:**
```sql
UPDATE documents SET criticality_level = $1 WHERE id = $2
```

**LLM Calls:**
- 1x gpt-4o per document (batch if possible)

**Cost:** ~$0.50 per 10 documents

**Duration:** ~2-3 minutes

---

### 6️⃣ EVENT EXTRACTOR AGENT

**Purpose:** Extract structured events from documents

**Input:**
```typescript
{
  document_ids: UUID[]
}
```

**Flow:**
1. For each document:
   a. Load document + relations + criticality
   b. Call gpt-4o: extract events
   c. Parse JSON response (can return 0-N events)
   d. For each event:
      - INSERT INTO events
      - Link: events.document_id = document.id
      - Set: events.source_type = 'source_hunter'

**LLM Prompt Template:**
```
You are extracting market events from climate equipment news.

Document:
Title: {title}
Segments: {segment_names}
Brands: {brand_names}
Geographies: {geography_names}
Content: {content_text}

Extract structured events. Each event must have:
- date (YYYY-MM-DD or inferred from context)
- event_type (from enum)
- description (2-3 sentences)
- company (if mentioned)
- segment (from document)
- geography (if mentioned)
- source_url (from document)
- criticality_level (from document)

Return JSON:
{
  "events": [
    {
      "date": "2025-12-14",
      "event_type": "promo_discount",
      "description": "...",
      "company": "Daikin",
      "segment": "RAC",
      "geography": "Moscow",
      "criticality_level": 3
    }
  ]
}

Rules:
- Can return 0, 1, 2, or more events
- If no clear events, return empty array
- Be specific and factual
```

**Output:**
```typescript
{
  status: 'success' | 'partial' | 'error',
  events_created: number,
  documents_processed: number,
  errors: Array<{ document_id: UUID, error: string }>
}
```

**Database Changes:**
```sql
INSERT INTO events (
  date, event_type, description, company, segment, geography,
  source_url, criticality_level, source_type, document_id, search_run_id
)
VALUES (...)
```

**LLM Calls:**
- 1x gpt-4o per document

**Cost:** ~$0.50 per 10 documents

**Duration:** ~2-3 minutes

**Note:** Even if document is marked is_duplicate=TRUE, still create events

---

## 🔄 ORCHESTRATOR: SEARCH_ORCHESTRATOR EDGE FUNCTION

**Purpose:** Coordinate all agents in sequence

**Input:**
```typescript
{
  monitoring_profile_id: UUID
}
```

**Flow:**
```typescript
async function searchOrchestrator(req) {
  // 1. Load monitoring profile
  const profile = await loadMonitoringProfile(profile_id)

  // 2. Create search_run
  const search_run = await createSearchRun({
    type: 'source_hunter',
    monitoring_profile_id,
    status: 'running'
  })

  try {
    // 3. Step 1: Source Hunter
    const sourceHunterResult = await runSourceHunter({
      monitoring_profile_id,
      search_run_id: search_run.id
    })
    const document_ids = sourceHunterResult.document_ids
    await createSearchRunStage({
      search_run_id, stage: 'source_hunter',
      status: sourceHunterResult.status,
      docs_processed: sourceHunterResult.documents_created
    })

    if (!document_ids.length) throw new Error('No documents created')

    // 4. Step 2: Content Fetcher
    const fetcherResult = await runContentFetcher({
      document_ids,
      search_run_id: search_run.id
    })
    await createSearchRunStage({
      search_run_id, stage: 'content_fetcher',
      status: fetcherResult.status,
      docs_processed: fetcherResult.documents_updated
    })

    // 5. Step 3: Document Processor
    const processorResult = await runDocumentProcessor({
      document_ids,
      search_run_id: search_run.id
    })
    await createSearchRunStage({
      search_run_id, stage: 'document_processor',
      status: processorResult.status,
      docs_processed: processorResult.documents_processed
    })

    // 6. Step 4: Dedup Agent
    const dedupResult = await runDedup({
      document_ids,
      search_run_id: search_run.id
    })
    await createSearchRunStage({
      search_run_id, stage: 'dedup',
      status: 'success',
      docs_processed: dedupResult.documents_marked
    })

    // 7. Step 5: Criticality Scorer
    const scorerResult = await runCriticalityScorer({
      document_ids,
      search_run_id: search_run.id
    })
    await createSearchRunStage({
      search_run_id, stage: 'criticality_scorer',
      status: scorerResult.status,
      docs_processed: scorerResult.documents_scored
    })

    // 8. Step 6: Event Extractor
    const extractorResult = await runEventExtractor({
      document_ids,
      search_run_id: search_run.id
    })
    await createSearchRunStage({
      search_run_id, stage: 'event_extractor',
      status: extractorResult.status,
      docs_processed: extractorResult.documents_processed
    })

    // 9. Update search_run as completed
    await updateSearchRun(search_run.id, {
      status: 'completed',
      documents_created: document_ids.length,
      events_created: extractorResult.events_created,
      completed_at: NOW(),
      execution_time_ms: Date.now() - search_run.started_at
    })

    // 10. Return results
    return {
      status: 'completed',
      search_run_id: search_run.id,
      documents_created: document_ids.length,
      events_created: extractorResult.events_created,
      duration_seconds: (Date.now() - search_run.started_at) / 1000
    }

  } catch (error) {
    await updateSearchRun(search_run.id, {
      status: 'failed',
      error_message: error.message,
      completed_at: NOW()
    })
    throw error
  }
}
```

---

## 📊 COST & PERFORMANCE ESTIMATES (per run)

| Agent | Docs | LLM Calls | Cost | Duration |
|-------|------|-----------|------|----------|
| Source Hunter | - | 1 (mini) | $0.05 | 15s |
| Content Fetcher | 5-10 | 0 | $0 | 30-60s |
| Document Processor | 5-10 | 5-10 (4o) | $0.50 | 2-3m |
| Dedup | 5-10 | 0 | $0 | 10s |
| Criticality Scorer | 5-10 | 5-10 (4o) | $0.50 | 2-3m |
| Event Extractor | 5-10 | 5-10 (4o) | $0.50 | 2-3m |
| **TOTAL** | **5-10** | **16-31** | **~$1.55** | **~10-12m** |

---

## 🔐 AUTHENTICATION & AUTHORIZATION

All agents:
- Accept JWT token in Authorization header
- Verify user is authenticated
- Verify user is admin (for running pipeline)
- Use SERVICE_ROLE_KEY for DB access (bypass RLS)

---

## 📝 IMPLEMENTATION ORDER

1. **Search Orchestrator** (coordinates everything)
2. **Source Hunter** (already exists, may need updates)
3. **Content Fetcher** (fetches URLs)
4. **Document Processor** (LLM classification + embeddings)
5. **Dedup Agent** (marks duplicates)
6. **Criticality Scorer** (rates importance)
7. **Event Extractor** (creates events)

---

## ✅ TESTING STRATEGY

Each agent tested independently:
- Mock inputs
- Verify database changes
- Check output format
- Test error cases

Integration testing:
- Run full pipeline with monitoring profile
- Verify end-to-end data flow
- Check all documents create events

---

