# 🧪 Pipeline Testing Guide

**Date:** 2025-12-14
**Status:** Ready for testing Phase 4 Parts 1-4
**Scope:** Source Hunter → Content Fetcher → Document Processor

---

## 📋 Prerequisites Checklist

Before running tests, ensure:

### 1. Database State ✅
- [ ] Migrations 001-019 applied successfully
- [ ] Monitoring profiles exist (at least 1 active)
- [ ] Prompt templates exist (at least 1)
- [ ] Event types seeded (9 types)
- [ ] Segments with is_active column
- [ ] Geographies with is_active column
- [ ] Sources seeded with is_active = true

**Verify in Supabase SQL Editor:**
```sql
SELECT COUNT(*) as profiles FROM public.monitoring_profiles WHERE is_active = true;
SELECT COUNT(*) as templates FROM public.prompt_templates WHERE is_active = true;
SELECT COUNT(*) as event_types FROM public.event_types WHERE is_active = true;
SELECT COUNT(*) as segments FROM public.segments WHERE is_active = true;
SELECT COUNT(*) as sources FROM public.sources WHERE is_active = true;
```

**Expected:**
- monitoring_profiles: >= 1
- prompt_templates: >= 1
- event_types: 9
- segments: 8
- sources: >= 10

### 2. Frontend Running ✅
```bash
cd frontend
npm install  # if needed
npm run dev
```

Frontend should be at: `http://localhost:3005`

### 3. Edge Functions Deployed ✅

The following functions must be deployed to Supabase:
- `supabase/functions/agents/search-orchestrator/index.ts`
- `supabase/functions/agents/source-hunter/index.ts`
- `supabase/functions/agents/content-fetcher/index.ts`
- `supabase/functions/agents/document-processor/index.ts`

**To deploy (if not deployed):**
```bash
npx supabase functions deploy search-orchestrator
npx supabase functions deploy source-hunter
npx supabase functions deploy content-fetcher
npx supabase functions deploy document-processor
```

Or use Supabase Dashboard → Functions to deploy via UI.

### 4. Environment Variables ✅
Ensure these are set in your Supabase project:
- `OPENAI_API_KEY` - for GPT-4o and embeddings
- `SUPABASE_URL` - automatically set
- `SUPABASE_ANON_KEY` - automatically set
- `SUPABASE_SERVICE_ROLE_KEY` - for Edge Functions

---

## 🚀 Testing Steps

### Step 1: Navigate to Admin Panel

1. Open `http://localhost:3005/admin`
2. You should see Admin Panel with tabs
3. Click on **"🚀 Запуск Pipeline"** tab

### Step 2: Select Monitoring Profile

1. In the dropdown, select **"MVP Test Profile - All Segments"**
   - If dropdown is empty, monitoring_profiles were not created. Check prerequisites.
2. You should see:
   - Profile name selected
   - "Запустить Pipeline" button is enabled

### Step 3: Start Pipeline Execution

1. Click **"Запустить Pipeline"** button
2. You should see:
   - Button changes to "Выполняется..."
   - PipelineProgress component appears below
   - Real-time updates of stages

**Expected Progress (in order):**
```
Stage 1: source_hunter (1-3 seconds)
  Status: ⏱️ Running → ✅ Completed
  Documents created: 5-20 (mock data)

Stage 2: content_fetcher (2-5 seconds)
  Status: ⏱️ Running → ✅ Completed
  Documents updated: 5-20

Stage 3: document_processor (5-15 seconds)
  Status: ⏱️ Running → ✅ Completed
  Documents processed: 5-20
  Embeddings generated
```

### Step 4: Monitor Progress

The **PipelineProgress** component shows:
- Current stage name (source_hunter, content_fetcher, document_processor)
- Status badge (🟡 Running, 🟢 Completed, 🔴 Failed)
- Documents processed counter
- Elapsed time

Example output:
```
📊 Stage: source_hunter
Status: 🟢 Completed
Documents: 15
Time: 2.3s

📊 Stage: content_fetcher
Status: 🟢 Completed
Documents: 15
Time: 3.8s

📊 Stage: document_processor
Status: 🟢 Completed
Documents: 15
Time: 12.1s

✅ PIPELINE COMPLETED
Total time: 18.2s
```

### Step 5: Check Results

After completion, check in two places:

#### A. In Admin Panel - Results Summary
```
Pipeline завершен успешно

Создано документов: 15
Создано событий: 0 (Part 6 will add this)
Время выполнения: 18.2 сек
```

#### B. In Admin Panel - "📋 Логи Pipeline" Tab
1. Click **"📋 Логи Pipeline"** tab
2. You should see new row with:
   - Status: 🟢 COMPLETED
   - Documents: 15
   - Time: 18.2s
   - Started: timestamp
3. Click row to expand and see stage-by-stage timeline

#### C. In Supabase Dashboard

**Check search_runs table:**
```sql
SELECT id, status, documents_created, execution_time_ms, started_at, completed_at
FROM public.search_runs
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- status: 'completed'
- documents_created: > 0
- execution_time_ms: > 0

**Check search_runs_stages table:**
```sql
SELECT stage_name, status, documents_processed, started_at, completed_at
FROM public.search_runs_stages
WHERE search_run_id = '<search_run_id>'
ORDER BY started_at;
```

Expected 3 rows:
- source_hunter: status = 'success'
- content_fetcher: status = 'success'
- document_processor: status = 'success'

**Check documents table:**
```sql
SELECT COUNT(*) as total_documents,
       COUNT(CASE WHEN content_text IS NOT NULL THEN 1 END) as with_content,
       COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings
FROM public.documents
ORDER BY created_at DESC
LIMIT 1;
```

Expected:
- total_documents: > 0
- with_content: > 0
- with_embeddings: > 0

---

## 🔍 Troubleshooting

### Issue 1: "Выпадающий список профилей пустой"

**Cause:** No monitoring_profiles in database

**Solution:**
1. Check Supabase SQL Editor:
   ```sql
   SELECT COUNT(*) FROM public.monitoring_profiles;
   ```
2. If 0, manually create:
   ```sql
   INSERT INTO public.monitoring_profiles (
     name, description, is_active,
     segment_ids, geography_ids, event_type_ids,
     priority, max_sources_per_run, dedupe_threshold,
     prompt_template_id
   ) VALUES (
     'Test Profile',
     'Test',
     true,
     ARRAY(SELECT id FROM public.segments WHERE is_active = true),
     ARRAY(SELECT id FROM public.geographies WHERE is_active = true),
     ARRAY(SELECT id FROM public.event_types WHERE is_active = true),
     5, 20, 0.85,
     (SELECT id FROM public.prompt_templates LIMIT 1)
   );
   ```

### Issue 2: "Pipeline started but stuck on source_hunter"

**Cause:** Edge Function not deployed or error in Source Hunter

**Solution:**
1. Check Supabase Dashboard → Functions → source-hunter
2. Click and check recent invocations and logs
3. If not deployed, run:
   ```bash
   npx supabase functions deploy source-hunter
   ```

### Issue 3: "ERROR: Failed to run sql query: column X does not exist"

**Cause:** Missing migrations or columns

**Solution:**
1. Verify Migration 019 was applied:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name='segments' AND column_name='is_active';
   ```
2. If missing, run Migration 019 manually in SQL Editor

### Issue 4: "No documents created by Source Hunter"

**Cause:** No active sources in database

**Solution:**
1. Check sources:
   ```sql
   SELECT COUNT(*) FROM public.sources WHERE is_active = true;
   ```
2. If 0, run:
   ```sql
   UPDATE public.sources SET is_active = true;
   ```

### Issue 5: "OpenAI API error: invalid api key"

**Cause:** OPENAI_API_KEY not set in Supabase project

**Solution:**
1. In Supabase Dashboard → Project Settings → Secrets
2. Add `OPENAI_API_KEY=sk-...`
3. Redeploy Edge Functions:
   ```bash
   npx supabase functions deploy source-hunter
   npx supabase functions deploy document-processor
   ```

---

## 📊 Expected Pipeline Behavior

### Source Hunter (1-3 seconds)
**Input:**
- Monitoring profile (segments, geographies, event types)
- Prompt template text
- List of active sources

**Process:**
- Call GPT-4o-mini to generate search queries based on monitoring profile
- For each source, create mock documents (simulating search results)
- Save documents to DB with:
  - title: generated by AI
  - content_text: null (will be fetched later)
  - url: from source
  - search_run_id: link to current run

**Output:**
- ✅ Status: 'success'
- Documents created: 5-20 per run
- document_ids: array of created UUIDs

### Content Fetcher (2-5 seconds)
**Input:**
- document_ids from Source Hunter
- search_run_id

**Process:**
- For each document URL, fetch content (with retry logic)
- Parse HTML, extract text
- Update documents.content_text with extracted text
- Set fetched_at timestamp

**Output:**
- ✅ Status: 'success'
- Documents updated: count of documents with content fetched
- documents_failed: count of failed fetches

### Document Processor (5-15 seconds)
**Input:**
- document_ids from Source Hunter
- search_run_id

**Process:**
- Call GPT-4o to classify each document:
  - Segment classification
  - Brand mentions extraction
  - Geography mentions extraction
  - Event type classification
- Create linking table entries:
  - document_brands
  - document_segments
  - document_geographies
  - document_event_types
- Generate embeddings via text-embedding-3-small (1536 dimensions)
- Update documents with embedding and canonical content

**Output:**
- ✅ Status: 'success'
- Documents processed: count of classified documents
- Embeddings created: count
- documents_failed: count of failed classifications

### Final Result
```
search_run:
  status = 'completed'
  documents_created = 15
  events_created = 0 (Phase 5 will populate)
  execution_time_ms = 18200

search_runs_stages: 3 rows
  source_hunter: status='success', documents=15
  content_fetcher: status='success', documents=15
  document_processor: status='success', documents=15

documents: 15 new rows
  All with content_text populated
  All with embedding vector
  All with linking table entries
```

---

## ✅ Test Completion

Pipeline testing is successful when:

1. ✅ Admin Panel shows "Pipeline завершен успешно"
2. ✅ All 3 stages show 🟢 Completed status
3. ✅ Documents created > 0
4. ✅ Execution time < 60 seconds
5. ✅ search_runs table has new row with status='completed'
6. ✅ search_runs_stages table has 3 rows with status='success'
7. ✅ documents table has new documents with embedding and content_text
8. ✅ No error messages in browser console
9. ✅ No error messages in Supabase Functions logs

---

## 📝 Next Steps After Testing

If all tests pass:

### Phase 4 Part 5: Dedup Agent + Criticality Scorer
- Find duplicate documents using cosine similarity
- Score importance 1-5 based on content

### Phase 4 Part 6: Event Extractor Agent
- Extract 0-N events per document
- Link to events table
- Populate events_created in search_runs

### Phase 4 Part 7: Monitoring Profiles + Prompt Templates UI
- Create/edit monitoring profiles
- Manage prompt templates
- CRON scheduling

---

**Test Started:** [timestamp]
**Test Status:** [in progress / success / failed]
**Issues Found:** [list any]

