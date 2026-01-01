-- Migration 051: Fix security issue in pg_cron job
-- Purpose: Replace hardcoded Service Role JWT with vault.decrypted_secrets
--
-- SECURITY FIX: Migration 036 had hardcoded JWT token exposed in git
-- This migration recreates the pg_cron job using secure vault access

-- =====================================================
-- STEP 1: Drop old insecure cron job (if exists)
-- =====================================================

-- Safely unschedule job (ignore error if doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('process-pipeline-jobs');
  RAISE NOTICE 'Old cron job unscheduled successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No existing cron job to unschedule (this is OK)';
END $$;

-- =====================================================
-- STEP 2: Create secure cron job using vault
-- =====================================================

-- IMPORTANT: Before running this migration, ensure that
-- SUPABASE_SERVICE_ROLE_KEY is stored in vault.secrets
--
-- To add it manually (if not exists):
--   INSERT INTO vault.secrets (name, secret, description)
--   VALUES (
--     'SUPABASE_SERVICE_ROLE_KEY',
--     'your-service-role-key-from-dashboard',
--     'Service Role Key for calling Edge Functions from SQL'
--   );

SELECT cron.schedule(
  'process-pipeline-jobs',              -- Job name
  '* * * * *',                          -- Cron expression: every minute
  $$
  SELECT net.http_post(
    url := 'https://aggiamgeplckdrnbqmob.supabase.co/functions/v1/job-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- SECURE: Get service_role key from vault instead of hardcoding
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- STEP 3: Verify new secure job was created
-- =====================================================

SELECT
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'process-pipeline-jobs';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 051 complete!';
  RAISE NOTICE '   - Old insecure pg_cron job removed';
  RAISE NOTICE '   - New secure job using vault.decrypted_secrets created';
  RAISE NOTICE '   - Runs every minute (* * * * *)';
  RAISE NOTICE '   ';
  RAISE NOTICE '🔒 Security: Service Role Key now retrieved from vault';
  RAISE NOTICE '🔍 Verify: SELECT * FROM cron.job WHERE jobname = ''process-pipeline-jobs'';';
END $$;
