-- Migration 044: Update pg_cron to Call SQL Orchestrator
-- Purpose: Switch from Edge Function to SQL-based Source Hunter
-- Replaces: job-processor Edge Function with run_source_hunter_sql()

-- Unschedule old job that calls Edge Function
SELECT cron.unschedule('process-pipeline-jobs');

-- Create new cron job that calls SQL orchestrator directly
SELECT cron.schedule(
  'run-sql-source-hunter',           -- job name
  '0 9 * * *',                       -- cron expression: every day at 9:00 AM
  $$
    SELECT run_source_hunter_sql(
      (SELECT id FROM monitoring_profiles WHERE name = 'Daily Critical Monitoring' LIMIT 1),
      1,  -- max_sources
      3   -- max_urls_per_source
    );
  $$
);

-- Verify the job was scheduled
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname IN ('process-pipeline-jobs', 'run-sql-source-hunter')
ORDER BY jobname;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 044 complete!';
  RAISE NOTICE '   - Unscheduled old "process-pipeline-jobs" Edge Function job';
  RAISE NOTICE '   - Scheduled new "run-sql-source-hunter" SQL job';
  RAISE NOTICE '   - Schedule: Every day at 9:00 AM (0 9 * * *)';
  RAISE NOTICE '   - Calls: run_source_hunter_sql() directly in PostgreSQL';
  RAISE NOTICE '   - Limits: 1 source, 3 URLs (safe defaults)';
  RAISE NOTICE '   ';
  RAISE NOTICE '🔍 Verify: SELECT * FROM cron.job WHERE jobname = ''run-sql-source-hunter'';';
  RAISE NOTICE '🧪 Manual test: SELECT cron.schedule(''test-run'', ''* * * * *'', ''SELECT run_source_hunter_sql(...)'');';
END $$;
