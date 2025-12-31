-- Migration 046: Monitoring Dashboard Helper Functions
-- Created: 2025-12-30
-- Purpose: SQL functions for Monitoring Dashboard data aggregation

-- ============================================================================
-- PART 1: Daily Document Statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_document_stats(days INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  documents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as date,
    COUNT(*)::INTEGER as documents
  FROM documents
  WHERE created_at > NOW() - (days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_daily_document_stats IS 'Returns daily document creation statistics for monitoring dashboard';

-- ============================================================================
-- PART 2: System Health Status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE (
  health_status TEXT,
  active_jobs INTEGER,
  stuck_runs INTEGER,
  recent_documents INTEGER,
  success_rate NUMERIC
) AS $$
DECLARE
  v_active_jobs INTEGER;
  v_stuck_runs INTEGER;
  v_recent_docs INTEGER;
  v_success_rate NUMERIC;
  v_health_status TEXT;
BEGIN
  -- Count active pg_cron jobs
  SELECT COUNT(*)::INTEGER INTO v_active_jobs
  FROM cron.job
  WHERE active = true
    AND jobname IN ('run-sql-source-hunter', 'cleanup-stuck-runs');

  -- Count stuck runs
  SELECT COUNT(*)::INTEGER INTO v_stuck_runs
  FROM search_runs
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '10 minutes';

  -- Count recent documents (last 24h)
  SELECT COUNT(*)::INTEGER INTO v_recent_docs
  FROM documents
  WHERE created_at > NOW() - INTERVAL '24 hours';

  -- Calculate success rate (last 7 days)
  SELECT
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(100.0 * SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1)
      ELSE 0
    END INTO v_success_rate
  FROM search_runs sr
  WHERE sr.started_at > NOW() - INTERVAL '7 days';

  -- Determine overall status
  IF v_stuck_runs > 0 OR v_success_rate < 50 THEN
    v_health_status := 'critical';
  ELSIF v_success_rate < 80 OR v_recent_docs = 0 THEN
    v_health_status := 'warning';
  ELSE
    v_health_status := 'healthy';
  END IF;

  RETURN QUERY SELECT
    v_health_status,
    v_active_jobs,
    v_stuck_runs,
    v_recent_docs,
    v_success_rate;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_system_health IS 'Returns overall system health status for monitoring dashboard';

-- ============================================================================
-- PART 3: Pipeline Statistics (7 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pipeline_stats(days INTEGER DEFAULT 7)
RETURNS TABLE (
  total_runs BIGINT,
  successful BIGINT,
  failed BIGINT,
  running BIGINT,
  success_rate NUMERIC,
  total_documents BIGINT,
  avg_duration_sec NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_runs,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::BIGINT as successful,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::BIGINT as failed,
    SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END)::BIGINT as running,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1)
      ELSE 0
    END as success_rate,
    SUM(documents_created)::BIGINT as total_documents,
    CASE
      WHEN COUNT(*) FILTER (WHERE execution_time_ms IS NOT NULL) > 0 THEN
        ROUND(AVG(execution_time_ms) FILTER (WHERE execution_time_ms IS NOT NULL) / 1000.0, 1)
      ELSE 0
    END as avg_duration_sec
  FROM search_runs
  WHERE started_at > NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_pipeline_stats IS 'Returns pipeline execution statistics for monitoring dashboard';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test functions
DO $$
DECLARE
  v_doc_count INTEGER;
  v_health_status TEXT;
  v_stats_runs BIGINT;
BEGIN
  -- Test get_daily_document_stats
  SELECT COUNT(*) INTO v_doc_count
  FROM get_daily_document_stats(7);

  RAISE NOTICE '✅ get_daily_document_stats() returned % days of data', v_doc_count;

  -- Test get_system_health
  SELECT sh.health_status INTO v_health_status
  FROM get_system_health() sh;

  RAISE NOTICE '✅ get_system_health() returned health_status: %', v_health_status;

  -- Test get_pipeline_stats
  SELECT total_runs INTO v_stats_runs
  FROM get_pipeline_stats(7);

  RAISE NOTICE '✅ get_pipeline_stats() returned % total runs', v_stats_runs;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 046 Complete';
  RAISE NOTICE '========================================';
END $$;
