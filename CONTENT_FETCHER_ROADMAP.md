# Content Fetcher Agent - Integration Roadmap

**Created:** 2025-12-29
**Status:** 📋 Ready for implementation
**Priority:** 🟢 MEDIUM (Source Hunter works, this adds HTML content)
**Estimated Time:** 3-4 hours
**Current State:** Agent EXISTS but needs integration with Source Hunter V2

---

## 🎯 Goal

Fetch full HTML content for documents created by Source Hunter V2 and save to database.

**Current Flow:**
```
Source Hunter V2 → Creates documents with URLs → DONE
```

**Target Flow:**
```
Source Hunter V2 → Creates documents with URLs →
→ Content Fetcher → Downloads HTML → Saves to content_html →
→ Document Processor → Extracts text + embeddings →
→ Event Extractor → Creates events
```

---

## 📊 Current State Analysis

### What EXISTS ✅
- ✅ Content Fetcher Edge Function (`supabase/functions/content-fetcher/index.ts`)
- ✅ HTTP fetch logic with retry (3 attempts, exponential backoff)
- ✅ Content size limits (max 50KB)
- ✅ Database update logic (content_text, fetched_at, file_size)
- ✅ Error handling
- ✅ CORS headers

### What NEEDS UPDATE ⚠️
- ⚠️ Integration with Source Hunter output (document_ids)
- ⚠️ HTML parsing (currently returns raw HTML)
- ⚠️ Save to content_html column (not content_text)
- ⚠️ Handle different content types (HTML vs PDF vs DOCX)
- ⚠️ Error handling for 404s (mark as invalid_url)

### What's MISSING ❌
- ❌ Called from Search Orchestrator after Source Hunter
- ❌ Batch processing for multiple documents
- ❌ Progress tracking
- ❌ Testing with real Perplexity URLs

---

## 🏗️ Implementation Plan

### Step 1: Update Content Fetcher for HTML Storage

**File:** `supabase/functions/content-fetcher/index.ts`

**Changes Needed:**
```typescript
// OLD: Saves to content_text
await supabase
  .from('documents')
  .update({
    content_text: htmlContent,  // ❌ Wrong column
    fetched_at: new Date(),
    file_size: htmlContent.length
  })
  .eq('id', documentId);

// NEW: Saves to content_html
await supabase
  .from('documents')
  .update({
    content_html: htmlContent,  // ✅ Correct column
    content_length: htmlContent.length,  // Migration 026 added this
    fetched_at: new Date()
  })
  .eq('id', documentId);
```

**Tasks:**
- [ ] Update database column from content_text → content_html
- [ ] Update column name from file_size → content_length
- [ ] Add content_type detection (text/html, application/pdf, etc.)
- [ ] Handle 404 errors gracefully (mark document as unavailable)

**Estimated Time:** 30 minutes

---

### Step 2: Add Batch Processing

**Current:** Processes 1 document at a time
**Target:** Process array of document_ids

```typescript
interface ContentFetcherRequest {
  document_ids: string[];  // Array instead of single ID
  search_run_id?: string;  // Optional for tracking
}

interface ContentFetcherResponse {
  status: 'success' | 'error';
  documents_fetched: number;
  documents_failed: number;
  errors: Array<{
    document_id: string;
    error: string;
  }>;
}
```

**Logic:**
```typescript
const results = [];
for (const documentId of request.document_ids) {
  try {
    // Load document from DB
    const doc = await loadDocument(documentId);

    // Fetch content
    const html = await fetchWithRetry(doc.source_url);

    // Save to DB
    await updateDocument(documentId, html);

    results.push({ id: documentId, status: 'success' });
  } catch (error) {
    results.push({ id: documentId, status: 'failed', error: error.message });
  }
}

return {
  documents_fetched: results.filter(r => r.status === 'success').length,
  documents_failed: results.filter(r => r.status === 'failed').length,
  errors: results.filter(r => r.status === 'failed')
};
```

**Tasks:**
- [ ] Change request type to accept array
- [ ] Implement batch processing loop
- [ ] Collect results (success/failed counts)
- [ ] Return aggregated response

**Estimated Time:** 1 hour

---

### Step 3: Integrate with Search Orchestrator

**File:** `supabase/functions/search-orchestrator/index.ts`

**Current Flow:**
```typescript
// 1. Run Source Hunter
const hunterResult = await runSourceHunter(...);
// Documents created with URLs

// 2. ❌ STOPS HERE
return { status: 'completed', documents_created: hunterResult.documents_created };
```

**Target Flow:**
```typescript
// 1. Run Source Hunter
const hunterResult = await runSourceHunter(...);
console.log(`✅ Source Hunter created ${hunterResult.documents_created} documents`);

// 2. ✅ Run Content Fetcher
const fetcherResult = await runContentFetcher({
  document_ids: hunterResult.document_ids,
  search_run_id: searchRunId
});
console.log(`✅ Content Fetcher downloaded ${fetcherResult.documents_fetched} pages`);

// 3. Return combined results
return {
  status: 'completed',
  documents_created: hunterResult.documents_created,
  documents_fetched: fetcherResult.documents_fetched,
  documents_failed: fetcherResult.documents_failed
};
```

**Tasks:**
- [ ] Add runContentFetcher function to orchestrator
- [ ] Call after Source Hunter completes
- [ ] Pass document_ids from Source Hunter output
- [ ] Handle Content Fetcher errors (don't fail entire pipeline)
- [ ] Update search_runs_stages table (add 'content_fetch' stage)

**Estimated Time:** 1 hour

---

### Step 4: Error Handling & Invalid URLs

**Scenarios to Handle:**

1. **404 Not Found** - Page doesn't exist
   ```typescript
   // Mark document as invalid_url
   await supabase
     .from('documents')
     .update({ is_valid_url: false, fetch_error: '404 Not Found' })
     .eq('id', documentId);
   ```

2. **403 Forbidden** - Access denied
   ```typescript
   // Mark as protected (may need credentials)
   await supabase
     .from('documents')
     .update({ is_valid_url: true, fetch_error: '403 Forbidden (protected)' })
     .eq('id', documentId);
   ```

3. **Timeout** - Server too slow
   ```typescript
   // Retry with longer timeout, then mark as unavailable
   await fetchWithRetry(url, { timeout: 30000, maxRetries: 3 });
   ```

4. **Too Large** - Content > 50KB
   ```typescript
   // Truncate or skip
   const MAX_SIZE = 50 * 1024; // 50KB
   if (html.length > MAX_SIZE) {
     html = html.substring(0, MAX_SIZE);
     await supabase.update({ content_truncated: true });
   }
   ```

**Tasks:**
- [ ] Add is_valid_url column to documents table (migration)
- [ ] Add fetch_error column for error messages
- [ ] Add content_truncated flag
- [ ] Implement error-specific handling
- [ ] Don't fail entire batch if one URL fails

**Estimated Time:** 1 hour

---

### Step 5: Testing with Real Perplexity URLs

**Test Data:**
From our last successful run, we have 27 real URLs:
- `https://daichi.business`
- `https://rusklimat-eco.ru/...`
- `https://mir-klimata.info/vystavka/...`
- `https://c-o-k.ru/articles/...`
- etc.

**Test Plan:**
1. ✅ Run Source Hunter → Get 27 documents
2. ✅ Extract document_ids from result
3. ✅ Call Content Fetcher with document_ids
4. ✅ Verify content_html populated
5. ✅ Check content_length values
6. ✅ Verify error handling (some URLs may 404)

**Test Script:**
```typescript
// test-content-fetcher.ts
const { supabase } = await import('@/lib/supabase');

// 1. Get recent documents from Source Hunter
const { data: docs } = await supabase
  .from('documents')
  .select('id, source_url')
  .is('content_html', null)  // Only unfetched
  .limit(10);

// 2. Extract IDs
const documentIds = docs.map(d => d.id);

// 3. Call Content Fetcher
const { data, error } = await supabase.functions.invoke('content-fetcher', {
  body: { document_ids: documentIds }
});

console.log('✅ Result:', data);

// 4. Verify content saved
const { data: updated } = await supabase
  .from('documents')
  .select('id, source_url, content_html, content_length, fetched_at')
  .in('id', documentIds);

console.log('📊 Fetched documents:', updated);
```

**Tasks:**
- [ ] Create test script
- [ ] Run with 5 documents first
- [ ] Verify HTML saved correctly
- [ ] Check error handling
- [ ] Run with all 27 documents
- [ ] Measure timing

**Estimated Time:** 30 minutes

---

## 📊 Expected Results

**Before Content Fetcher:**
- ✅ 27 documents with URLs
- ❌ content_html = NULL
- ❌ Can't extract events (no content)

**After Content Fetcher:**
- ✅ 27 documents with URLs
- ✅ 20-25 documents with content_html (some may 404)
- ✅ content_length populated
- ✅ fetched_at timestamp
- ✅ Ready for Document Processor

---

## 🚀 Rollout Plan

### Phase 1: Update Content Fetcher (1.5 hours)
- [ ] Update to use content_html column
- [ ] Add batch processing
- [ ] Add error handling for 404s
- [ ] Test with 5 documents

### Phase 2: Integrate with Orchestrator (1 hour)
- [ ] Add runContentFetcher call
- [ ] Update search_runs_stages tracking
- [ ] Test end-to-end pipeline
- [ ] Verify all 27 documents fetched

### Phase 3: Production Testing (30 min)
- [ ] Run full pipeline via Admin UI
- [ ] Verify documents created → content fetched
- [ ] Check error rates
- [ ] Monitor timing

### Phase 4: Optimization (Future)
- [ ] Add concurrent fetching (Promise.all for 5 at a time)
- [ ] Add retry queue for failed fetches
- [ ] Add content parsing (extract text from HTML)
- [ ] Add metadata extraction (title, description, etc.)

---

## 💰 Cost Estimation

**Content Fetcher has NO AI API calls** - just HTTP fetches!

**Cost:** $0 per run ✅

**Time:**
- 27 documents × ~2 seconds = ~54 seconds
- Well within Edge Function timeout ✅

---

## 🔧 Database Migration Needed

```sql
-- Migration 035: Content Fetcher columns

-- Add is_valid_url flag
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS is_valid_url BOOLEAN DEFAULT TRUE;

-- Add fetch_error for debugging
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS fetch_error TEXT;

-- Add content_truncated flag
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS content_truncated BOOLEAN DEFAULT FALSE;

-- Add index on fetched_at
CREATE INDEX IF NOT EXISTS idx_documents_fetched_at
ON public.documents(fetched_at)
WHERE fetched_at IS NOT NULL;

-- Add index on is_valid_url
CREATE INDEX IF NOT EXISTS idx_documents_valid_url
ON public.documents(is_valid_url)
WHERE is_valid_url = FALSE;
```

---

## ✅ Success Criteria

- ✅ Content Fetcher processes array of document_ids
- ✅ Saves HTML to content_html column
- ✅ Handles 404s gracefully (marks as invalid_url)
- ✅ Integrated with Search Orchestrator
- ✅ 80%+ success rate (20-25 / 27 documents fetched)
- ✅ Completes within Edge Function timeout (<150s)
- ✅ No additional costs (no AI API calls)

---

## 📚 References

- **Content Fetcher Code:** `supabase/functions/content-fetcher/index.ts`
- **Search Orchestrator:** `supabase/functions/search-orchestrator/index.ts`
- **Migration 026:** Added content_length column

---

## 🎯 Next Steps

1. **Create Migration 035** - Add error tracking columns (15 min)
2. **Update Content Fetcher** - Batch processing + error handling (1.5 hours)
3. **Integrate with Orchestrator** - Call after Source Hunter (1 hour)
4. **Test with real data** - Verify 27 documents fetched (30 min)
5. **Deploy & Monitor** - Run via Admin UI (15 min)

**Total Time:** ~3.5 hours

**Start with:** Migration 035 + Content Fetcher updates

---

**Status:** 📋 Ready for next session
**Priority:** 🟢 HIGH (enables Document Processor)
**Confidence:** 95% (agent exists, just needs integration)
