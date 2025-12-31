-- Migration 045: Fix stuck pipeline runs and add timeout logic
-- Created: 2025-12-30
-- Purpose: Clean up stuck records in search_runs and pipeline_jobs tables

-- ============================================================================
-- PART 1: Fix stuck search_runs (old approach)
-- ============================================================================

-- Update all search_runs that are stuck in 'running' status for > 10 minutes
UPDATE search_runs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = 'Timed out - exceeded 10 minute execution limit (auto-recovered)'
WHERE status = 'running'
  AND created_at < NOW() - INTERVAL '10 minutes'
  AND completed_at IS NULL;

-- Log how many were fixed
DO $$
DECLARE
  v_fixed_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE '✅ Fixed % stuck search_runs records', v_fixed_count;
END $$;

-- ============================================================================
-- PART 2: Fix stuck pipeline_jobs (new async approach)
-- ============================================================================

-- First check if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'pipeline_jobs'
  ) THEN
    -- Update stuck jobs in 'pending' or 'in_progress' for > 10 minutes
    UPDATE pipeline_jobs
    SET
      status = 'failed',
      completed_at = NOW(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{error}',
        '"Timed out - exceeded 10 minute execution limit (auto-recovered)"'
      )
    WHERE status IN ('pending', 'in_progress')
      AND created_at < NOW() - INTERVAL '10 minutes'
      AND completed_at IS NULL;

    RAISE NOTICE '✅ Fixed stuck pipeline_jobs records';
  ELSE
    RAISE NOTICE 'ℹ️ Table pipeline_jobs does not exist (expected for SQL-based approach)';
  END IF;
END $$;

-- ============================================================================
-- PART 3: Create function to auto-cleanup stuck runs
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_stuck_pipeline_runs()
RETURNS INTEGER AS $$
DECLARE
  v_search_runs_fixed INTEGER := 0;
  v_pipeline_jobs_fixed INTEGER := 0;
BEGIN
  -- Fix stuck search_runs
  UPDATE search_runs
  SET
    status = 'failed',
    completed_at = NOW(),
    error_message = 'Timed out - exceeded 10 minute execution limit (auto-recovered)'
  WHERE status = 'running'
    AND created_at < NOW() - INTERVAL '10 minutes'
    AND completed_at IS NULL;

  GET DIAGNOSTICS v_search_runs_fixed = ROW_COUNT;

  -- Fix stuck pipeline_jobs (if table exists)
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'pipeline_jobs'
  ) THEN
    UPDATE pipeline_jobs
    SET
      status = 'failed',
      completed_at = NOW(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{error}',
        '"Timed out - exceeded 10 minute execution limit (auto-recovered)"'
      )
    WHERE status IN ('pending', 'in_progress')
      AND created_at < NOW() - INTERVAL '10 minutes'
      AND completed_at IS NULL;

    GET DIAGNOSTICS v_pipeline_jobs_fixed = ROW_COUNT;
  END IF;

  RAISE NOTICE '✅ Cleanup complete: % search_runs, % pipeline_jobs',
    v_search_runs_fixed, v_pipeline_jobs_fixed;

  RETURN v_search_runs_fixed + v_pipeline_jobs_fixed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 4: Schedule automatic cleanup via pg_cron
-- ============================================================================

-- Unschedule existing cleanup job if exists
SELECT cron.unschedule('cleanup-stuck-runs')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stuck-runs'
);

-- Schedule cleanup to run every 15 minutes
SELECT cron.schedule(
  'cleanup-stuck-runs',
  '*/15 * * * *',  -- Every 15 minutes
  $$SELECT cleanup_stuck_pipeline_runs();$$
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show current status of all runs
DO $$
DECLARE
  v_running_count INTEGER;
  v_pending_count INTEGER;
  v_failed_count INTEGER;
  v_completed_count INTEGER;
BEGIN
  -- Count search_runs
  SELECT COUNT(*) INTO v_running_count
  FROM search_runs WHERE status = 'running';

  SELECT COUNT(*) INTO v_failed_count
  FROM search_runs WHERE status = 'failed';

  SELECT COUNT(*) INTO v_completed_count
  FROM search_runs WHERE status = 'completed';

  RAISE NOTICE '📊 search_runs status:';
  RAISE NOTICE '   - running: %', v_running_count;
  RAISE NOTICE '   - failed: %', v_failed_count;
  RAISE NOTICE '   - completed: %', v_completed_count;

  -- Count pipeline_jobs (if exists)
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'pipeline_jobs'
  ) THEN
    SELECT COUNT(*) INTO v_pending_count
    FROM pipeline_jobs WHERE status = 'pending';

    SELECT COUNT(*) INTO v_running_count
    FROM pipeline_jobs WHERE status = 'in_progress';

    RAISE NOTICE '📊 pipeline_jobs status:';
    RAISE NOTICE '   - pending: %', v_pending_count;
    RAISE NOTICE '   - in_progress: %', v_running_count;
  END IF;
END $$;

-- Show cron jobs
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN ('cleanup-stuck-runs', 'run-sql-source-hunter')
ORDER BY jobname;
