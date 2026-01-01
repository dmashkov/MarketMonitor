-- Check test results and created documents
-- Purpose: Verify what was created during the test run

-- =====================================================
-- STEP 1: Final job status
-- =====================================================

SELECT
  id,
  status,
  total_segments,
  processed_segments,
  documents_created,
  created_at,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at))::int as total_runtime_sec,
  errors
FROM pipeline_jobs
WHERE id = '15677112-0e7b-42ac-920c-df57b15d9cf0';

-- =====================================================
-- STEP 2: Documents created by this job
-- =====================================================

-- Find documents created around the time of the job
SELECT
  id,
  title,
  source_id,
  content_length,
  created_at,
  published_at
FROM documents
WHERE created_at >= (
  SELECT started_at FROM pipeline_jobs WHERE id = '15677112-0e7b-42ac-920c-df57b15d9cf0'
)
ORDER BY created_at DESC
LIMIT 20;

-- =====================================================
-- STEP 3: Documents by segment
-- =====================================================

SELECT
  s.name as segment_name,
  COUNT(DISTINCT d.id) as documents_count
FROM documents d
INNER JOIN document_segments ds ON d.id = ds.document_id
INNER JOIN segments s ON ds.segment_id = s.id
WHERE d.created_at >= (
  SELECT started_at FROM pipeline_jobs WHERE id = '15677112-0e7b-42ac-920c-df57b15d9cf0'
)
GROUP BY s.name
ORDER BY documents_count DESC;

-- =====================================================
-- STEP 4: Documents by source
-- =====================================================

SELECT
  src.name as source_name,
  st.name as source_type,
  COUNT(d.id) as documents_count
FROM documents d
INNER JOIN sources src ON d.source_id = src.id
INNER JOIN source_types st ON src.source_type_id = st.id
WHERE d.created_at >= (
  SELECT started_at FROM pipeline_jobs WHERE id = '15677112-0e7b-42ac-920c-df57b15d9cf0'
)
GROUP BY src.name, st.name
ORDER BY documents_count DESC;

-- =====================================================
-- STEP 5: pg_cron execution for this job
-- =====================================================

SELECT
  runid,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time))::numeric(5,2) as duration_sec
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
  AND start_time >= (
    SELECT created_at FROM pipeline_jobs WHERE id = '15677112-0e7b-42ac-920c-df57b15d9cf0'
  )
ORDER BY start_time;

-- =====================================================
-- STEP 6: Sample document titles
-- =====================================================

SELECT
  title,
  LEFT(summary, 100) as summary_preview,
  created_at
FROM documents
WHERE created_at >= (
  SELECT started_at FROM pipeline_jobs WHERE id = '15677112-0e7b-42ac-920c-df57b15d9cf0'
)
ORDER BY created_at DESC
LIMIT 10;
