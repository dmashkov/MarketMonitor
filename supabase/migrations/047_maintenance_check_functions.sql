-- Migration 047: Maintenance Check Functions
-- Created: 2025-12-30
-- Purpose: SQL functions for MaintenanceGuide interactive checks

-- ============================================================================
-- PART 1: Check Stuck Runs
-- ============================================================================

CREATE OR REPLACE FUNCTION check_stuck_runs()
RETURNS TABLE (
  id UUID,
  status TEXT,
  started_at TIMESTAMPTZ,
  duration_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id,
    sr.status,
    sr.started_at,
    EXTRACT(EPOCH FROM (NOW() - sr.started_at))::INTEGER / 60 as duration_minutes
  FROM search_runs sr
  WHERE sr.status = 'running'
    AND sr.started_at < NOW() - INTERVAL '10 minutes'
  ORDER BY sr.started_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION check_stuck_runs IS 'Returns all stuck pipeline runs (running > 10 minutes)';

-- ============================================================================
-- PART 2: Check pg_cron Jobs
-- ============================================================================

CREATE OR REPLACE FUNCTION check_pg_cron_jobs()
RETURNS TABLE (
  jobname TEXT,
  active BOOLEAN,
  schedule TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cj.jobname::TEXT,
    cj.active,
    cj.schedule::TEXT
  FROM cron.job cj
  WHERE cj.jobname IN ('run-sql-source-hunter', 'cleanup-stuck-runs')
  ORDER BY cj.jobname;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION check_pg_cron_jobs IS 'Returns status of all maintenance pg_cron jobs';

-- ============================================================================
-- PART 3: Weekly Stats Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_weekly_stats()
RETURNS TABLE (
  total_runs BIGINT,
  successful BIGINT,
  failed BIGINT,
  total_documents BIGINT,
  success_rate NUMERIC,
  avg_duration_sec NUMERIC,
  avg_docs_per_run NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_runs,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::BIGINT as successful,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::BIGINT as failed,
    SUM(documents_created)::BIGINT as total_documents,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1)
      ELSE 0
    END as success_rate,
    CASE
      WHEN COUNT(*) FILTER (WHERE execution_time_ms IS NOT NULL) > 0 THEN
        ROUND(AVG(execution_time_ms) FILTER (WHERE execution_time_ms IS NOT NULL) / 1000.0, 1)
      ELSE 0
    END as avg_duration_sec,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(AVG(documents_created), 1)
      ELSE 0
    END as avg_docs_per_run
  FROM search_runs
  WHERE started_at > NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_weekly_stats IS 'Returns weekly pipeline statistics for maintenance checks';

-- ============================================================================
-- PART 4: Monthly Stats Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_monthly_stats()
RETURNS TABLE (
  total_runs BIGINT,
  successful BIGINT,
  failed BIGINT,
  total_documents BIGINT,
  success_rate NUMERIC,
  avg_duration_sec NUMERIC,
  total_sources_used INTEGER,
  unique_segments INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_docs AS (
    SELECT
      source_id,
      unnest(segment_ids) as segment_id
    FROM documents
    WHERE created_at > NOW() - INTERVAL '30 days'
  )
  SELECT
    COUNT(*)::BIGINT as total_runs,
    SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END)::BIGINT as successful,
    SUM(CASE WHEN sr.status = 'failed' THEN 1 ELSE 0 END)::BIGINT as failed,
    (SELECT COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '30 days')::BIGINT as total_documents,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(100.0 * SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1)
      ELSE 0
    END as success_rate,
    CASE
      WHEN COUNT(*) FILTER (WHERE sr.execution_time_ms IS NOT NULL) > 0 THEN
        ROUND(AVG(sr.execution_time_ms) FILTER (WHERE sr.execution_time_ms IS NOT NULL) / 1000.0, 1)
      ELSE 0
    END as avg_duration_sec,
    (SELECT COUNT(DISTINCT source_id) FROM monthly_docs)::INTEGER as total_sources_used,
    (SELECT COUNT(DISTINCT segment_id) FROM monthly_docs WHERE segment_id IS NOT NULL)::INTEGER as unique_segments
  FROM search_runs sr
  WHERE sr.started_at > NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_monthly_stats IS 'Returns monthly pipeline statistics for maintenance checks';

-- ============================================================================
-- PART 5: Check Database Size
-- ============================================================================

CREATE OR REPLACE FUNCTION check_database_size()
RETURNS TABLE (
  table_name TEXT,
  row_count BIGINT,
  total_size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.table_name::TEXT,
    (SELECT COUNT(*) FROM documents WHERE t.table_name = 'documents')::BIGINT as row_count,
    ROUND((pg_total_relation_size(quote_ident(t.table_name)::regclass) / 1024.0 / 1024.0)::NUMERIC, 2) as total_size_mb
  FROM (
    SELECT 'documents' as table_name
    UNION ALL SELECT 'search_runs'
    UNION ALL SELECT 'search_runs_stages'
    UNION ALL SELECT 'sources'
    UNION ALL SELECT 'brands'
  ) t
  WHERE EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t.table_name)
  ORDER BY total_size_mb DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_database_size IS 'Returns size information for main tables';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_stuck_count INTEGER;
  v_cron_count INTEGER;
  v_weekly_runs BIGINT;
  v_monthly_runs BIGINT;
  v_db_tables INTEGER;
BEGIN
  -- Test check_stuck_runs
  SELECT COUNT(*) INTO v_stuck_count
  FROM check_stuck_runs();

  RAISE NOTICE '✅ check_stuck_runs() returned % stuck runs', v_stuck_count;

  -- Test check_pg_cron_jobs
  SELECT COUNT(*) INTO v_cron_count
  FROM check_pg_cron_jobs();

  RAISE NOTICE '✅ check_pg_cron_jobs() returned % cron jobs', v_cron_count;

  -- Test get_weekly_stats
  SELECT total_runs INTO v_weekly_runs
  FROM get_weekly_stats();

  RAISE NOTICE '✅ get_weekly_stats() returned % weekly runs', v_weekly_runs;

  -- Test get_monthly_stats
  SELECT total_runs INTO v_monthly_runs
  FROM get_monthly_stats();

  RAISE NOTICE '✅ get_monthly_stats() returned % monthly runs', v_monthly_runs;

  -- Test check_database_size
  SELECT COUNT(*) INTO v_db_tables
  FROM check_database_size();

  RAISE NOTICE '✅ check_database_size() returned % tables', v_db_tables;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 047 Complete';
  RAISE NOTICE '========================================';
END $$;
