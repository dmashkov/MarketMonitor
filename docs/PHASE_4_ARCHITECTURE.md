# 🏗️ PHASE 4: MULTI-AGENT PIPELINE ARCHITECTURE

**Version:** 1.0.0
**Date:** 2025-12-14
**Status:** Architecture Design Complete ✅
**Target:** Phase 4 Part 4-8 Implementation

---

## 📊 EXECUTIVE SUMMARY

**Goal:** Replace single monolithic ai-search with modular multi-agent sequential pipeline.

**Pipeline Type:** Sequential (not parallel) for MVP
**Key Decision:** Raw → Normalized → Canonical data transformation
**Core Concept:** Monitoring Profiles replace generic Prompts Library

---

## 🔄 DATA FLOW OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4 MVP PIPELINE ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────────────┘

[ADMIN TRIGGER]
  ↓
Admin Panel → "🚀 Запуск Pipeline" tab → Select monitoring_profile → RUN
  ↓
[SEARCH-ORCHESTRATOR] (новый Edge Function)
  │
  ├─ Create search_run record (status: 'running')
  │
  ├─ Step 1: SOURCE HUNTER
  │  ├─ Load monitoring_profile
  │  ├─ Get available sources (by segments, geographies)
  │  ├─ Generate search queries (OpenAI gpt-4o-mini)
  │  ├─ Find URLs (MOCK for MVP)
  │  └─ INSERT documents (RAW layer)
  │     └─ Stores: title, source_url, source_id, document_type='webpage'
  │
  ├─ Step 2: CONTENT FETCHER
  │  ├─ GET each URL (timeout: 10s, retries: 3)
  │  ├─ Parse HTML → extract text (max 5000 chars)
  │  ├─ Extract published_date from meta tags
  │  ├─ Handle errors: log and continue
  │  └─ UPDATE documents.content_text + published_date
  │
  ├─ Step 3: DOCUMENT PROCESSOR (ONE LLM call per document)
  │  ├─ Read: documents.content_text
  │  ├─ Call GPT-4o: classify segment, event_types, brands, geographies
  │  ├─ Parse JSON response
  │  ├─ INSERT INTO:
  │  │  ├─ document_segments
  │  │  ├─ document_event_types
  │  │  ├─ document_brands
  │  │  └─ document_geographies
  │  ├─ Generate embeddings (OpenAI text-embedding-3-small)
  │  ├─ Clean content_text (canonical layer)
  │  └─ UPDATE documents.embedding, documents.content_text
  │
  ├─ Step 4: DEDUP AGENT
  │  ├─ Compare embeddings (cosine similarity)
  │  ├─ Mark duplicates: UPDATE documents.is_duplicate = TRUE
  │  └─ Continue pipeline for ALL documents (even duplicates)
  │
  ├─ Step 5: CRITICALITY SCORER
  │  ├─ Read: documents (with context from relations)
  │  ├─ Call GPT-4o: score 1-5
  │  └─ UPDATE documents.criticality_level
  │
  ├─ Step 6: EVENT EXTRACTOR
  │  ├─ For each document:
  │  │  ├─ Call GPT-4o: extract structured event
  │  │  ├─ Can create 0-N events per document
  │  │  └─ INSERT INTO events
  │  ├─ Link: events.document_id = documents.id
  │  └─ Set: events.source_type = 'source_hunter'
  │
  ├─ Update search_run:
  │  ├─ status: 'completed'
  │  ├─ documents_created: N
  │  ├─ events_created: M
  │  └─ completed_at: NOW()
  │
  └─ Return response to Admin Panel
     └─ Display: summary, progress, any errors


[PARALLEL TRACK - NOT IN MVP]
ai-search remains independent:
  Admin/User → Dashboard → "Запустить AI Поиск"
  → ai-search (GPT-4o web_search)
  → INSERT events (source_type='ai_search')

  DECISION: Later (Phase 4 Part 7+) we'll unify both into one orchestrator
```

---

## 📋 KEY ARCHITECTURAL DECISIONS

### **1. TWO INDEPENDENT SEARCH PATHS (MVP)**

| Path | Trigger | Speed | Coverage | Events Created |
|------|---------|-------|----------|-----------------|
| **ai-search** | User Dashboard | Fast (30s) | Web search only | source_type='ai_search' |
| **source-hunter pipeline** | Admin (Monitoring Profile) | Slow (5-10min) | Full pipeline | source_type='source_hunter' |

**Decision:** Keep separate on MVP. Unify in Phase 4 Part 7.
**Rationale:** Different UX/requirements, easier to develop separately first.

---

### **2. DATA LAYERS: RAW → NORMALIZED → CANONICAL**

```
RAW LAYER (Source Hunter + Content Fetcher):
├─ content_text: filled (first 5000 chars from HTML)
├─ published_date: filled (from HTML meta tags)
├─ All taxonomies: NULL
└─ embedding: NULL

NORMALIZED LAYER (Document Processor):
├─ content_text: same (not yet cleaned)
├─ segment_ids, event_type_ids, brand_ids, geography_ids: FILLED
├─ embedding: FILLED
└─ criticality_level: NULL

CANONICAL LAYER (ready for consumption):
├─ content_text: CLEANED (standardized, no extra whitespace)
├─ All fields: FILLED and validated
├─ embedding: INDEXED
└─ is_duplicate: MARKED
```

**Benefits:**
- Keep raw data for audit trail
- Understand transformation at each stage
- Easier debugging and reprocessing
- Compliance/archival if needed

---

### **3. SOFT DELETE FOR DUPLICATES**

**Decision:** is_duplicate=TRUE (soft delete), NOT hard DELETE

```
documents {
  id, title, content_text,
  is_duplicate: boolean
}

Benefits:
- Keep audit trail of duplicates
- Can trace duplicate relationships
- Reversible if dedup logic wrong
- Still create events from duplicates (for completeness)
```

---

### **4. MANY-TO-MANY: SEPARATE TABLES**

**Decision:** Separate linking tables, NOT ARRAY columns

```sql
documents { id, title, ... }
document_brands { document_id, brand_id } -- PK
document_segments { document_id, segment_id } -- PK
document_geographies { document_id, geography_id } -- PK
document_event_types { document_id, event_type_id } -- PK
```

**Benefits:**
- Proper DB normalization
- Can add metadata (confidence, source, etc.)
- Easy indexing and querying
- Referential integrity via FK

---

### **5. MONITORING PROFILES: Configuration as Code**

**Decision:** Profiles determine scope and behavior, not individual prompts

```
monitoring_profiles (replaces generic prompts):
├─ name: "RAC Retail Promo"
├─ scope: segment_ids[], brand_ids[], geography_ids[], event_type_ids[]
├─ execution: priority, max_sources_per_run
├─ quality_gates: dedupe_threshold
└─ prompts: prompt_template_id (ссылка на шаблон)

BENEFITS:
- Admin manages profiles, not individual prompts
- Each profile has consistent behavior
- Easy to enable/disable entire monitoring strategy
- Promotes reusability of prompts
```

---

### **6. PROMPT TEMPLATES: Versioning + Parameterization**

**Decision:** Prompts as templates with placeholders, stored in DB

```sql
prompt_templates {
  id, name, stage ('search'|'classify'|'score'),
  template_text: "Analyze {segment} market. Classify event_types from: {event_types}..."
  is_active: boolean
}

search_runs_prompts {
  search_run_id, stage_name, prompt_template_id,
  actual_prompt_text: (fully rendered prompt sent to LLM)
}
```

**Benefits:**
- Track which exact prompt was used
- A/B test different prompts
- Edit prompts in UI (later)
- Audit trail of changes

---

### **7. SEQUENTIAL PIPELINE (not Parallel)**

**Decision:** await each step before moving to next

```typescript
await sourceHunter()        // returns document_ids[]
await contentFetcher()      // returns updated document_ids[]
await documentProcessor()   // returns processed document_ids[]
await dedupAgent()          // returns with is_duplicate marked
await criticalityScorer()   // returns scored document_ids[]
await eventExtractor()      // returns event_ids[] created
```

**Benefits on MVP:**
- Simple to debug
- Clear error handling
- Easy to understand flow
- No race conditions

**Future:** Parallel with orchestrator (Phase 5)

---

### **8. ONE LLM CALL PER DOCUMENT (Document Processor)**

**Decision:** Single prompt for classification + extraction

```
One LLM call (gpt-4o):
Input: document.content_text
Output JSON: {
  segment_id: UUID,
  event_type_ids: [UUID],
  brand_ids: [UUID],
  geography_ids: [UUID]
}
```

**Benefits:**
- Cost efficient
- Faster execution
- Simpler prompt engineering
- Less API calls

**Trade-off:** Less specialized for each task (OK for MVP)

---

### **9. EVENTS FROM DOCUMENTS (Event Extractor)**

**Decision:** One document can create 0-N events

```
Event Extractor (VАРИАНТ A):
for each document (where is_duplicate=FALSE):
  call LLM: "Extract events from this document"
  → can return 0, 1, 2, or more events
  → INSERT INTO events

IMPORTANT: Even create events from duplicates
(for comprehensive search results)
```

**Benefits:**
- More flexible event modeling
- Don't lose information from duplicate-marked documents
- Natural mapping: doc → events

---

### **10. CRITICALITY SCORER: Work on Events**

**Decision:** Score AFTER event creation (VARIANT B)

```
Timeline:
1. Document Processor: fills taxonomies
2. Dedup Agent: marks is_duplicate
3. Criticality Scorer: WORKS ON DOCUMENTS (scores documents)
4. Event Extractor: creates events, inherits document.criticality_level
5. Events table: shows criticality
```

**Benefits:**
- Score is based on document context (not just extracted event)
- Unified scoring logic
- Can rescore documents later if needed

---

## 🗄️ DATABASE SCHEMA OVERVIEW

See separate **DATABASE_SCHEMA.md** for full details.

**New/Modified Tables:**
- ✅ documents (UPDATE: remove ARRAY columns)
- ✅ document_brands, document_segments, document_geographies, document_event_types (CREATE)
- ✅ event_types (CREATE new)
- ✅ search_runs (UPDATE)
- ✅ search_runs_stages (CREATE)
- ✅ search_runs_prompts (CREATE)
- ✅ monitoring_profiles (CREATE)
- ✅ prompt_templates (CREATE)
- ✅ events (UPDATE: add source_type, document_id)

---

## 🤖 AGENTS SPECIFICATION

See separate **AGENT_SPECS.md** for detailed specifications per agent.

**Sequential Order:**
1. Source Hunter (finds URLs)
2. Content Fetcher (downloads content)
3. Document Processor (classifies + embeddings)
4. Dedup Agent (marks duplicates)
5. Criticality Scorer (rates importance)
6. Event Extractor (creates events)

---

## 🎯 MONITORING PROFILES (Configuration)

### Purpose
Replace "generic prompts library" with "targeted monitoring strategies"

### Example Profiles (for future)
- RAC Retail Promo (discounts on consumer units)
- RAC Marketplaces (Ozon/WB price changes)
- VRF Tenders (B2B projects)
- Distributors Programs (dealer incentives)
- Brand Launches (new products)

### MVP: Single Generic Profile
On MVP, we'll create ONE profile for testing:
```sql
INSERT INTO monitoring_profiles (
  name='MVP Test Profile',
  segment_ids=[all segments],
  event_type_ids=[all event types],
  priority=5,
  prompt_template_id=[search template]
)
```

---

## 🚀 EXECUTION FLOW: MVP

### User Interaction
```
Admin Panel (NEW TAB: "🚀 Запуск Pipeline")
├─ Dropdown: Select monitoring_profile
├─ Button: "Запустить"
└─ Displays:
   ├─ Progress: "Running Source Hunter... (5 docs found)"
   ├─ Progress: "Fetching content... (5 docs)"
   ├─ Progress: "Processing... (3 processed, 2 errored)"
   ├─ Final Results:
   │  ├─ Documents created: 5
   │  ├─ Duplicates found: 1
   │  ├─ Events created: 12
   │  ├─ Execution time: 4m 23s
   │  └─ Errors: 0
```

### Backend: Search Orchestrator
```
POST /functions/v1/search-orchestrator
├─ Body: { monitoring_profile_id: UUID }
├─ Response: {
│    search_run_id: UUID,
│    status: 'running',
│    message: 'Pipeline started'
│  }
└─ Streams progress via WebSocket or polling
```

---

## 📊 SEARCH_RUNS TRACKING

```sql
search_runs {
  id, type ('ai_search'|'source_hunter'), status,
  monitoring_profile_id (nullable),
  documents_created, events_created,
  started_at, completed_at, execution_time_ms,
  error_message (nullable), created_by
}

search_runs_stages {
  id, search_run_id, stage_name,
  status, documents_processed,
  started_at, completed_at, error_message
}

search_runs_prompts {
  id, search_run_id, stage_name, prompt_template_id,
  actual_prompt_text (for A/B testing & audit)
}
```

---

## 🔄 FUTURE ROADMAP

### Phase 4 Part 7: Search Orchestrator Unification
- Create unified orchestrator that handles both ai-search and source-hunter
- Merge events into single stream

### Phase 5: Scheduling + Parallel Execution
- Add CRON scheduling to monitoring_profiles
- Implement true parallel agent execution
- Add Alert Manager and Report Generator agents

### Phase 6: Advanced Features
- Prompt versioning with history
- A/B testing framework
- Quality metrics dashboard
- Custom profile builder UI

---

## ✅ DECISION MATRIX

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Search Paths | 2 independent | Keep MVP simple, unify later |
| Data Layers | RAW→NORM→CAN | Audit trail, easier debugging |
| Duplicates | Soft delete | Keep history, still create events |
| Relations | Separate tables | DB normalization, integrity |
| Profiles | Config-first | Admin-friendly, reusable |
| Prompts | Templates+Params | A/B test, audit, editable |
| Pipeline | Sequential | Simple, clear, debuggable |
| LLM Calls | 1 per doc (Processor) | Cost efficient |
| Events | From docs (0-N) | Flexible, don't lose data |
| Scoring | On events | After extraction |

---

## 📚 Related Documents

- **DATABASE_SCHEMA.md** — Full SQL schema
- **AGENT_SPECS.md** — Each agent detailed spec
- **API_CONTRACTS.md** — Edge Function interfaces
- **PHASE_4_ROADMAP.md** — Implementation timeline
- **DEVELOPMENT_STATUS.md** — Current progress

---

**Next Step:** Implement migrations, then start agents in order.
