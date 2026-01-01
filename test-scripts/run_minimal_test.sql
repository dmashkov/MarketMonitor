-- Minimal test - creates test data if needed
-- Purpose: Test pg_cron job processing with minimal setup

DO $$
DECLARE
  v_profile_id uuid;
  v_prompt_id uuid;
  v_segment_count integer;
  v_job_id uuid;
BEGIN
  -- =====================================================
  -- STEP 1: Get or create prompt template
  -- =====================================================

  SELECT id INTO v_prompt_id
  FROM prompt_templates
  WHERE stage = 'source_hunter'
  LIMIT 1;

  IF v_prompt_id IS NULL THEN
    -- Create minimal prompt template
    INSERT INTO prompt_templates (name, template_text, stage, is_active)
    VALUES (
      'Test Prompt',
      'Find recent news about {segment} in Russia',
      'source_hunter',
      true
    )
    RETURNING id INTO v_prompt_id;

    RAISE NOTICE 'Created test prompt template: %', v_prompt_id;
  ELSE
    RAISE NOTICE 'Using existing prompt template: %', v_prompt_id;
  END IF;

  -- =====================================================
  -- STEP 2: Get or create monitoring profile
  -- =====================================================

  SELECT id INTO v_profile_id
  FROM monitoring_profiles
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    -- Create minimal monitoring profile
    INSERT INTO monitoring_profiles (
      name,
      prompt_template_id,
      min_source_priority,
      max_sources_per_run,
      is_active
    )
    VALUES (
      'Test Profile',
      v_prompt_id,
      1,
      3,
      true
    )
    RETURNING id INTO v_profile_id;

    RAISE NOTICE 'Created test monitoring profile: %', v_profile_id;
  ELSE
    RAISE NOTICE 'Using existing monitoring profile: %', v_profile_id;
  END IF;

  -- =====================================================
  -- STEP 3: Count segments
  -- =====================================================

  SELECT COUNT(*) INTO v_segment_count
  FROM segments
  WHERE is_active = true;

  IF v_segment_count = 0 THEN
    RAISE WARNING 'No active segments found! Pipeline may fail.';
    v_segment_count := 1; -- Assume at least 1 for testing
  END IF;

  RAISE NOTICE 'Active segments: %', v_segment_count;

  -- =====================================================
  -- STEP 4: Create minimal test pipeline job
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
    GREATEST(v_segment_count, 1),
    0,
    3, -- Max 3 sources for test
    0,
    '[]'::jsonb,
    NOW(),
    jsonb_build_object(
      'test_mode', true,
      'max_sources', 3,
      'created_by', 'minimal_test_script'
    )
  )
  RETURNING id INTO v_job_id;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Test pipeline job created!';
  RAISE NOTICE '   Job ID: %', v_job_id;
  RAISE NOTICE '   Profile: %', v_profile_id;
  RAISE NOTICE '   Segments: %', v_segment_count;
  RAISE NOTICE '';
  RAISE NOTICE '⏱️  Job will be processed by pg_cron';
  RAISE NOTICE '   (within next minute)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Monitor with:';
  RAISE NOTICE '   SELECT id, status, processed_segments, documents_created';
  RAISE NOTICE '   FROM pipeline_jobs WHERE id = ''%'';', v_job_id;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- Show pending jobs
-- =====================================================

SELECT
  id,
  monitoring_profile_id,
  status,
  total_segments,
  processed_segments,
  documents_created,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))::int as seconds_old
FROM pipeline_jobs
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- Check pg_cron status
-- =====================================================

SELECT
  jobname,
  active,
  CASE
    WHEN active THEN 'Job will run in < 60 seconds'
    ELSE '❌ INACTIVE - job will NOT run!'
  END as status
FROM cron.job
WHERE jobname = 'process-pipeline-jobs';
