-- Verify complete SQL Source Hunter setup

-- 1. Check pg_cron job configuration
SELECT
  jobid,
  jobname,
  schedule,
  active,
  LEFT(command, 100) as command_preview
FROM cron.job
WHERE jobname = 'run-sql-source-hunter'
ORDER BY jobname;

-- 2. Check recently created documents
SELECT
  d.id,
  d.title,
  d.url,
  s.name as source_name,
  d.created_at
FROM documents d
LEFT JOIN sources s ON d.source_id = s.id
WHERE d.created_at > NOW() - INTERVAL '1 hour'
ORDER BY d.created_at DESC
LIMIT 10;

-- 3. Check document-segment links
SELECT
  d.title,
  seg.name as segment_name,
  s.name as source_name
FROM documents d
LEFT JOIN document_segments ds ON d.id = ds.document_id
LEFT JOIN segments seg ON ds.segment_id = seg.id
LEFT JOIN sources s ON d.source_id = s.id
WHERE d.created_at > NOW() - INTERVAL '1 hour'
ORDER BY d.created_at DESC;

-- 4. Summary statistics
SELECT
  'Total documents (last hour)' as metric,
  COUNT(*)::text as value
FROM documents
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
  'Documents with segments' as metric,
  COUNT(DISTINCT document_id)::text as value
FROM document_segments
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT
  'Active monitoring profiles' as metric,
  COUNT(*)::text as value
FROM monitoring_profiles
WHERE is_active = true;
