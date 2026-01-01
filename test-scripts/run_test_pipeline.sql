-- Run test pipeline to verify pg_cron job processing
-- Purpose: Create a test pipeline job and watch it being processed automatically
--
-- NOTE: Using OLD schema (migration 034) - monitoring_profile_id based jobs

DO $$
DECLARE
  v_profile_id uuid;
  v_segment_count integer;
  v_source_count integer;
BEGIN
  -- =====================================================
  -- STEP 1: Get a monitoring profile (use Daily Critical)
  -- =====================================================

  SELECT id INTO v_profile_id
  FROM monitoring_profiles
  WHERE name = 'Daily Critical Updates'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'No monitoring profile found! Run seed data first.';
  END IF;

  RAISE NOTICE 'Using monitoring profile: %', v_profile_id;

  -- =====================================================
  -- STEP 2: Calculate total segments and sources
  -- =====================================================

  -- Count active segments
  SELECT COUNT(*) INTO v_segment_count
  FROM segments
  WHERE is_active = true;

  -- Count sources matching profile criteria
  SELECT COUNT(*) INTO v_source_count
  FROM sources s
  INNER JOIN source_types st ON s.source_type_id = st.id
  WHERE s.is_active = true
  LIMIT 10; -- Limit for test

  RAISE NOTICE 'Segments to process: %', v_segment_count;
  RAISE NOTICE 'Sources to query: %', v_source_count;

  -- =====================================================
  -- STEP 3: Create test pipeline job
  -- =====================================================

  INSERT INTO pipeline_jobs (
    monitoring_profile_id,
    status,
    total_segments,
    processed_segments,
    total_sources,
    documents_created,
    errors,
    created_at,
    metadata
  )
  VALUES (
    v_profile_id,
    'pending',
    v_segment_count,
    0,
    LEAST(v_source_count, 10), -- Max 10 sources for test
    0,
    '[]'::jsonb,
    NOW(),
    jsonb_build_object(
      'test_mode', true,
      'max_sources', 3
    )
  );

  RAISE NOTICE '✅ Test pipeline job created!';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '⏱️  Job will be processed automatically by pg_cron';
  RAISE NOTICE '   (every minute)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Monitor with:';
  RAISE NOTICE '   SELECT * FROM pipeline_jobs ORDER BY created_at DESC LIMIT 5;';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- STEP 4: Show pending jobs
-- =====================================================

SELECT
  id,
  monitoring_profile_id,
  status,
  total_segments,
  processed_segments,
  documents_created,
  created_at,
  AGE(NOW(), created_at) as age
FROM pipeline_jobs
WHERE status = 'pending'
ORDER BY created_at;

-- =====================================================
-- STEP 5: Check cron job will run soon
-- =====================================================

SELECT
  jobname,
  schedule,
  active,
  CASE
    WHEN active THEN 'Will run in < 1 minute'
    ELSE 'INACTIVE - job will NOT run!'
  END as next_execution
FROM cron.job
WHERE jobname = 'process-pipeline-jobs';
