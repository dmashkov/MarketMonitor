-- Test pg_cron job system
-- Purpose: Verify that pg_cron job is working and processing pipeline_jobs queue

-- =====================================================
-- STEP 1: Check pg_cron job status
-- =====================================================

SELECT
  jobid,
  jobname,
  schedule,
  active,
  database,
  nodename
FROM cron.job
WHERE jobname = 'process-pipeline-jobs';

-- Expected: 1 row, active = true

-- =====================================================
-- STEP 2: Check recent cron job executions
-- =====================================================

SELECT
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time,
  end_time - start_time as duration
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
ORDER BY start_time DESC
LIMIT 10;

-- Expected: Multiple rows showing job executions every minute
-- Status should be 'succeeded' or show error details

-- =====================================================
-- STEP 3: Check pipeline_jobs queue status
-- =====================================================

SELECT
  status,
  COUNT(*) as count
FROM pipeline_jobs
GROUP BY status
ORDER BY status;

-- Shows distribution of jobs by status (pending, processing, completed, failed)

-- =====================================================
-- STEP 4: Check recent pipeline_jobs activity
-- =====================================================

SELECT
  id,
  monitoring_profile_id,
  status,
  total_segments,
  processed_segments,
  documents_created,
  created_at,
  started_at,
  completed_at,
  COALESCE(errors::text, 'null') as errors_summary
FROM pipeline_jobs
ORDER BY created_at DESC
LIMIT 20;

-- Shows last 20 jobs and their current state

-- =====================================================
-- STEP 5: Check if vault secret is accessible
-- =====================================================

SELECT
  name,
  description,
  created_at,
  updated_at
FROM vault.secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

-- Expected: 1 row confirming secret exists

-- Test reading decrypted value (first 20 chars for security)
SELECT
  name,
  LEFT(decrypted_secret, 20) || '...' as secret_preview,
  LENGTH(decrypted_secret) as secret_length
FROM vault.decrypted_secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

-- Expected: Preview starting with "eyJhbGciOiJIUzI1NiIs...", length around 200-300 chars

-- =====================================================
-- STEP 6: Summary statistics
-- =====================================================

SELECT
  (SELECT COUNT(*) FROM cron.job WHERE jobname = 'process-pipeline-jobs') as cron_jobs_count,
  (SELECT COUNT(*) FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')) as total_executions,
  (SELECT COUNT(*) FROM pipeline_jobs WHERE status = 'pending') as pending_jobs,
  (SELECT COUNT(*) FROM pipeline_jobs WHERE status = 'processing') as processing_jobs,
  (SELECT COUNT(*) FROM pipeline_jobs WHERE status = 'completed') as completed_jobs,
  (SELECT COUNT(*) FROM pipeline_jobs WHERE status = 'failed') as failed_jobs,
  (SELECT COUNT(*) FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY') as vault_secret_exists;

-- All counts should be >= 0
-- cron_jobs_count should be 1
-- vault_secret_exists should be 1
