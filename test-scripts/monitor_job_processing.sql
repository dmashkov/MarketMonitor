-- Monitor job processing in real-time
-- Run this repeatedly to watch jobs being processed

-- =====================================================
-- Current pipeline_jobs status
-- =====================================================

SELECT
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM pipeline_jobs
GROUP BY status
ORDER BY
  CASE status
    WHEN 'processing' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'failed' THEN 3
    WHEN 'completed' THEN 4
  END;

-- =====================================================
-- Recent job activity (last 10 jobs)
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
  CASE
    WHEN completed_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (completed_at - started_at))::int || 's'
    WHEN started_at IS NOT NULL THEN
      'Running for ' || EXTRACT(EPOCH FROM (NOW() - started_at))::int || 's'
    ELSE
      'Waiting for ' || EXTRACT(EPOCH FROM (NOW() - created_at))::int || 's'
  END as duration,
  CASE
    WHEN errors IS NOT NULL AND jsonb_array_length(errors) > 0 THEN
      'Errors: ' || jsonb_array_length(errors)::text
    ELSE 'OK'
  END as status_message
FROM pipeline_jobs
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- Cron job execution history (last 5 runs)
-- =====================================================

SELECT
  runid,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time))::numeric(5,2) as duration_sec,
  AGE(NOW(), start_time) as time_ago
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
ORDER BY start_time DESC
LIMIT 5;

-- =====================================================
-- Active/stuck jobs warning
-- =====================================================

SELECT
  COUNT(*) as stuck_jobs_count,
  STRING_AGG(job_type, ', ') as stuck_job_types
FROM pipeline_jobs
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '5 minutes';

-- If stuck_jobs_count > 0, something is wrong!

-- =====================================================
-- Next cron execution
-- =====================================================

SELECT
  jobname,
  active,
  'Next run in ~' || (60 - EXTRACT(SECOND FROM NOW())::int) || ' seconds' as next_execution
FROM cron.job
WHERE jobname = 'process-pipeline-jobs'
  AND active = true;

-- =====================================================
-- Quick stats summary
-- =====================================================

SELECT
  'Total jobs' as metric,
  COUNT(*)::text as value
FROM pipeline_jobs
UNION ALL
SELECT
  'Pending' as metric,
  COUNT(*)::text as value
FROM pipeline_jobs
WHERE status = 'pending'
UNION ALL
SELECT
  'Processing' as metric,
  COUNT(*)::text as value
FROM pipeline_jobs
WHERE status = 'processing'
UNION ALL
SELECT
  'Completed' as metric,
  COUNT(*)::text as value
FROM pipeline_jobs
WHERE status = 'completed'
UNION ALL
SELECT
  'Failed' as metric,
  COUNT(*)::text as value
FROM pipeline_jobs
WHERE status = 'failed'
UNION ALL
SELECT
  'Cron executions' as metric,
  COUNT(*)::text as value
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
UNION ALL
SELECT
  'Last cron run' as metric,
  AGE(NOW(), MAX(start_time))::text as value
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs');
