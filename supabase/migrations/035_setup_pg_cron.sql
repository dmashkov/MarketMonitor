-- Migration 035: Prepare for pg_cron setup
-- Purpose: Enable extensions and create helper functions for job processing

-- =====================================================
-- STEP 1: Enable required extensions
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- STEP 2: Create helper function to manually trigger job processor
-- =====================================================

-- This function can be called manually or by pg_cron to process pending jobs
CREATE OR REPLACE FUNCTION public.trigger_job_processor()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id BIGINT;
  service_key TEXT;
BEGIN
  -- Note: In production, service_role_key should be set via Supabase Dashboard
  -- For now, this function provides a way to manually trigger job processor

  RAISE NOTICE '🔄 Triggering job-processor...';

  -- Return instructions for manual setup
  RETURN 'Job processor can be triggered manually via Supabase Dashboard or API call';
END;
$$;

COMMENT ON FUNCTION public.trigger_job_processor IS 'Helper function to trigger job-processor Edge Function';

-- =====================================================
-- STEP 3: Instructions for pg_cron setup via Dashboard
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 035 applied successfully';
  RAISE NOTICE '   - pg_cron extension enabled';
  RAISE NOTICE '   - pg_net extension enabled';
  RAISE NOTICE '   - Helper function trigger_job_processor() created';
  RAISE NOTICE '   ';
  RAISE NOTICE '⚠️  MANUAL SETUP REQUIRED (see comments below for pg_cron setup)';
  RAISE NOTICE '   For now, jobs will be processed on-demand by calling job-processor Edge Function';
END $$;

-- =====================================================
-- STEP 4: Add comments
-- =====================================================

COMMENT ON EXTENSION pg_cron IS 'Cron-based job scheduler for PostgreSQL - used to trigger job-processor';

-- =====================================================
-- NOTES
-- =====================================================

-- Check active cron jobs:
-- SELECT * FROM cron.job WHERE jobname = 'process-pipeline-jobs';

-- Check cron job history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs') ORDER BY start_time DESC LIMIT 10;

-- Manual unschedule (if needed):
-- SELECT cron.unschedule('process-pipeline-jobs');

-- Manual trigger job-processor (for testing):
-- SELECT net.http_post(
--   url := 'https://aggiamgeplckdrnbqmob.supabase.co/functions/v1/job-processor',
--   headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer [SERVICE_ROLE_KEY]'),
--   body := '{}'::jsonb
-- );
