# Async Job Queue Implementation Plan

**Created:** 2025-12-29
**Status:** 📋 Planning
**Priority:** 🔥 HIGH (needed to process all 8 segments)
**Estimated Time:** 6-8 hours

---

## 🎯 Problem Statement

**Current Issue:**
- Supabase Edge Functions have ~150 second timeout limit
- Source Hunter V2 needs to process: **8 segments × 30 sources = 240 API calls**
- Each call: ~2-3 seconds → Total: ~8-12 minutes required
- **Result:** Gateway Timeout (504) after 150 seconds

**Temporary Workaround:**
- Limit to 1 segment × 3 sources = 3 API calls (~30-40 seconds)
- **Only processes 3.75% of full scope** (3/240 calls)

**Goal:**
Implement async job queue to process all segments without timeout constraints.

---

## 🏗️ Architecture Options

### Option 1: Supabase pg_cron + Database Queue ⭐ RECOMMENDED

**Pros:**
- ✅ Native Supabase integration
- ✅ No external dependencies
- ✅ Free tier available
- ✅ PostgreSQL-based (reliable)
- ✅ Simple implementation

**Cons:**
- ⚠️ pg_cron minimum interval: 1 minute
- ⚠️ Not suitable for real-time processing

**Best For:** Scheduled batch processing (perfect for our use case)

---

### Option 2: Supabase Functions + Database Table Queue

**Architecture:**
```
1. User triggers pipeline → Creates job in jobs table (status: pending)
2. Supabase Function processes 1 segment → Updates job (status: in_progress)
3. Calls itself recursively for next segment
4. Updates progress in jobs table
5. Marks job complete when done
```

**Pros:**
- ✅ No external dependencies
- ✅ Works within Supabase ecosystem
- ✅ Can track progress in real-time

**Cons:**
- ⚠️ Each function call still has 150s limit
- ⚠️ Requires careful orchestration
- ⚠️ Recursive calls may fail

**Best For:** Incremental processing with progress tracking

---

### Option 3: External Queue Service (BullMQ, RabbitMQ, etc.)

**Pros:**
- ✅ Professional queue management
- ✅ Retry logic, dead letter queues
- ✅ Scalable

**Cons:**
- ❌ Requires external hosting
- ❌ Additional cost
- ❌ More complex setup

**Best For:** Production at scale (not MVP)

---

## 📋 Recommended Solution: pg_cron + Jobs Table

### Database Schema

```sql
-- Migration 034: Async Job Queue
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monitoring_profile_id UUID NOT NULL REFERENCES public.monitoring_profiles(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending', 'in_progress', 'completed', 'failed'

  -- Progress tracking
  total_segments INTEGER NOT NULL,
  processed_segments INTEGER DEFAULT 0,
  total_sources INTEGER NOT NULL,
  current_segment_id UUID,

  -- Results
  documents_created INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::JSONB,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_pipeline_jobs_status ON public.pipeline_jobs(status);
CREATE INDEX idx_pipeline_jobs_created_at ON public.pipeline_jobs(created_at DESC);
CREATE INDEX idx_pipeline_jobs_profile ON public.pipeline_jobs(monitoring_profile_id);
```

---

### Implementation Steps

#### Step 1: Create Jobs Table Migration ✅
```bash
supabase/migrations/034_pipeline_jobs_queue.sql
```

**Tasks:**
- [ ] Create pipeline_jobs table
- [ ] Add indexes
- [ ] Add RLS policies (admins can view/manage)
- [ ] Add trigger for updated_at

**Estimated Time:** 30 minutes

---

#### Step 2: Create Job Processor Edge Function

```bash
supabase/functions/job-processor/index.ts
```

**Functionality:**
1. Query pipeline_jobs WHERE status = 'pending' LIMIT 1
2. Update status = 'in_progress'
3. Load monitoring profile + segments
4. FOR EACH segment:
   - Run Source Hunter with segment_ids=[current_segment]
   - Update processed_segments++
   - Update documents_created += result.documents_created
   - Save progress
5. Mark status = 'completed'

**Tasks:**
- [ ] Create Edge Function skeleton
- [ ] Implement job picker logic
- [ ] Implement segment-by-segment processing
- [ ] Add error handling (update errors array)
- [ ] Add progress calculation
- [ ] Add cancellation support (check job status before each segment)

**Estimated Time:** 3 hours

---

#### Step 3: Setup pg_cron Job

```sql
-- Enable pg_cron extension
SELECT cron.schedule(
  'process-pipeline-jobs',  -- Job name
  '* * * * *',              -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://aggiamgeplckdrnbqmob.supabase.co/functions/v1/job-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Tasks:**
- [ ] Create migration with cron.schedule
- [ ] Configure service_role_key access
- [ ] Test cron execution
- [ ] Add logging to verify cron runs

**Estimated Time:** 1 hour

---

#### Step 4: Update Orchestrator to Create Jobs

```typescript
// search-orchestrator/index.ts

async function createPipelineJob(
  monitoring_profile_id: string,
  userId: string
): Promise<string> {
  // Load profile
  const profile = await loadMonitoringProfile(monitoring_profile_id);

  // Count segments and sources
  const segments = profile.segment_ids || await getAllActiveSegmentIds();
  const totalSegments = segments.length;
  const totalSources = profile.max_sources_per_run || 30;

  // Create job
  const { data: job } = await supabase
    .from('pipeline_jobs')
    .insert({
      monitoring_profile_id,
      status: 'pending',
      total_segments: totalSegments,
      total_sources: totalSources,
      created_by: userId
    })
    .select('id')
    .single();

  return job.id;
}

// Instead of calling Source Hunter directly:
// OLD: await runSourceHunter(...)
// NEW:
const jobId = await createPipelineJob(profile_id, userId);
return { job_id: jobId, status: 'queued' };
```

**Tasks:**
- [ ] Add createPipelineJob function
- [ ] Update main handler to create job instead of running immediately
- [ ] Return job_id to frontend
- [ ] Add job status endpoint

**Estimated Time:** 1.5 hours

---

#### Step 5: Update Frontend to Show Job Progress

```typescript
// New hook: useJobProgress.ts
export function useJobProgress(jobId: string) {
  return useQuery({
    queryKey: ['pipeline-job', jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pipeline_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      return data;
    },
    refetchInterval: (data) => {
      // Poll every 5 seconds while in_progress
      return data?.status === 'in_progress' ? 5000 : false;
    }
  });
}
```

**Component Update:**
```tsx
// RunPipelinePanel.tsx

function RunPipelinePanel() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const { data: job } = useJobProgress(currentJobId);

  const handleStartPipeline = async (profileId: string) => {
    const result = await runPipeline({ monitoring_profile_id: profileId });
    setCurrentJobId(result.job_id);
  };

  // Show progress bar
  const progress = job ? (job.processed_segments / job.total_segments) * 100 : 0;

  return (
    <Progress
      percent={progress}
      status={job?.status === 'failed' ? 'exception' : 'active'}
    />
  );
}
```

**Tasks:**
- [ ] Create useJobProgress hook
- [ ] Update RunPipelinePanel to show progress
- [ ] Add progress bar component
- [ ] Add cancel button (update job status to 'cancelled')
- [ ] Add job history table

**Estimated Time:** 2 hours

---

## 🧪 Testing Plan

### Unit Tests
- [ ] Test job creation
- [ ] Test job processor with 1 segment
- [ ] Test job processor with 8 segments
- [ ] Test error handling (failed segment)
- [ ] Test cancellation

### Integration Tests
- [ ] Full pipeline with real data (8 segments)
- [ ] Verify all documents created
- [ ] Verify all segment links
- [ ] Check timing (should complete in <10 minutes)

### Load Tests
- [ ] Run 3 jobs simultaneously
- [ ] Verify queue ordering (FIFO)
- [ ] Check for race conditions

**Estimated Time:** 1 hour

---

## 📊 Expected Results

**Before Async Queue:**
- ✅ 1 segment × 3 sources = 3 documents
- ⚠️ Processing time: 40 seconds
- ⚠️ Coverage: 3.75% (3/240 calls)

**After Async Queue:**
- ✅ 8 segments × 30 sources = 240 documents
- ✅ Processing time: ~8-10 minutes (async, no timeout)
- ✅ Coverage: 100%
- ✅ Can process multiple jobs in queue

---

## 🚀 Rollout Plan

### Phase 1: MVP (This Session)
1. ✅ Create plan document (this file)
2. [ ] Create migration 034 (pipeline_jobs table)
3. [ ] Create job-processor Edge Function
4. [ ] Update orchestrator to create jobs
5. [ ] Test with 2 segments

### Phase 2: Production (Next Session)
6. [ ] Setup pg_cron schedule
7. [ ] Update frontend with progress tracking
8. [ ] Test with full 8 segments
9. [ ] Add job history UI
10. [ ] Add cancellation support

### Phase 3: Optimization (Future)
11. [ ] Add retry logic for failed segments
12. [ ] Add priority queue
13. [ ] Add concurrent processing (2-3 jobs in parallel)
14. [ ] Add email notifications on completion

---

## 💰 Cost Estimation

**Per Job (8 segments × 30 sources):**
- Perplexity API: 240 calls × $0.005 = **$1.20**
- OpenAI query generation: 8 calls × $0.001 = **$0.008**
- Total: ~**$1.21 per full pipeline run**

**Monthly (Daily runs):**
- 30 days × $1.21 = ~**$36/month**

**Within budget!** ✅

---

## 🔧 Alternative: Batch Processing (Simpler MVP)

If pg_cron is too complex for MVP, implement simple batch processing:

```typescript
// Process segments in batches of 2 (within 150s limit)
const BATCH_SIZE = 2;
const batches = chunk(segments, BATCH_SIZE);

for (const batch of batches) {
  await processSegmentBatch(batch);
  // Each batch takes ~60-80 seconds
  // User sees progress per batch
}
```

**Pros:**
- ✅ Simpler implementation (1 hour)
- ✅ No external cron needed
- ✅ Works with current architecture

**Cons:**
- ⚠️ Still requires multiple Edge Function calls
- ⚠️ May hit timeout with large batches

**Use if:** Need quick solution for MVP

---

## 📚 References

- **Supabase pg_cron:** https://supabase.com/docs/guides/database/extensions/pg_cron
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **PostgreSQL Job Queue Pattern:** https://blog.sequin.io/all-you-need-is-postgres/

---

## ✅ Next Actions

1. **Create migration 034** - pipeline_jobs table
2. **Prototype job-processor** - basic segment-by-segment processing
3. **Test with 2 segments** - verify it works without timeout
4. **Expand to 8 segments** - full coverage
5. **Add frontend progress UI** - real-time updates

**Start with:** Migration 034 (30 minutes)

---

**Status:** 📋 Ready for implementation
**Priority:** 🔥 Next major task after Part 5
**Confidence:** 90% (well-defined problem, clear solution)
