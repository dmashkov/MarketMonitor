-- Migration 036: Setup pg_cron job to process pipeline_jobs queue
-- Purpose: Auto-trigger job-processor Edge Function every minute
--
-- NOTE: This must be run manually in Supabase SQL Editor because:
-- 1. Needs access to project URL and service_role_key
-- 2. cron.schedule() requires specific permissions not available in migrations

-- =====================================================
-- STEP 1: Create pg_cron job
-- =====================================================

-- First, unschedule if exists (cleanup from previous attempts)
DO $$
BEGIN
  PERFORM cron.unschedule('process-pipeline-jobs');
  EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create cron job to run every minute
-- This will call job-processor Edge Function automatically
SELECT cron.schedule(
  'process-pipeline-jobs',              -- Job name
  '* * * * *',                          -- Cron expression: every minute
  $$
  SELECT net.http_post(
    url := 'https://aggiamgeplckdrnbqmob.supabase.co/functions/v1/job-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- STEP 2: Verify cron job was created
-- =====================================================

-- Check that job exists
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'process-pipeline-jobs';

-- Expected output:
-- jobid | jobname                  | schedule    | active | database
-- ------|--------------------------|-------------|--------|----------
-- 1     | process-pipeline-jobs    | * * * * *   | t      | postgres

-- =====================================================
-- STEP 3: Add helpful comments
-- =====================================================

COMMENT ON EXTENSION pg_cron IS 'Cron-based job scheduler - runs job-processor every minute to process pending pipeline_jobs';

-- =====================================================
-- VERIFICATION QUERIES (run these to check status)
-- =====================================================

-- 1. Check cron job exists and is active:
-- SELECT * FROM cron.job WHERE jobname = 'process-pipeline-jobs';

-- 2. Check recent cron job runs (last 10):
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
-- ORDER BY start_time DESC
-- LIMIT 10;

-- 3. Check pending pipeline jobs:
-- SELECT id, status, created_at FROM pipeline_jobs WHERE status = 'pending' ORDER BY created_at;

-- 4. Manual unschedule (if needed):
-- SELECT cron.unschedule('process-pipeline-jobs');

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 036 complete!';
  RAISE NOTICE '   - pg_cron job "process-pipeline-jobs" scheduled';
  RAISE NOTICE '   - Runs every minute (* * * * *)';
  RAISE NOTICE '   - Calls job-processor Edge Function automatically';
  RAISE NOTICE '   ';
  RAISE NOTICE '🔍 Verify: SELECT * FROM cron.job WHERE jobname = ''process-pipeline-jobs'';';
END $$;
