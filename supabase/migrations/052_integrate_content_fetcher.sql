-- Migration 052: Integrate Content Fetcher into Orchestrator
-- Created: 2025-12-31
-- Purpose: Automatically fetch HTML content after Source Hunter creates documents
--
-- FLOW: Source Hunter → Create Documents → Content Fetcher → Return Results

-- ============================================================================
-- Update run_source_hunter_sql to call Content Fetcher
-- ============================================================================

CREATE OR REPLACE FUNCTION run_source_hunter_sql(
  p_profile_id uuid,
  p_max_sources int DEFAULT 1,
  p_max_urls_per_source int DEFAULT 3
)
RETURNS jsonb AS $$
DECLARE
  v_profile record;
  v_template record;
  v_source record;
  v_segment record;
  v_query text;
  v_url_record record;
  v_document_id uuid;
  v_documents_created int := 0;
  v_segment_links int := 0;
  v_sources_processed int := 0;
  v_errors jsonb[] := ARRAY[]::jsonb[];
  v_fetcher_result record;
  v_fetched int := 0;
  v_fetch_failed int := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🚀 Source Hunter + Content Fetcher Pipeline';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Limits: max_sources=%, max_urls=%', p_max_sources, p_max_urls_per_source;
  RAISE NOTICE '';

  -- Load monitoring profile
  SELECT * INTO v_profile
  FROM monitoring_profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Monitoring profile not found'
    );
  END IF;

  -- Load prompt template
  SELECT * INTO v_template
  FROM prompt_templates
  WHERE id = v_profile.prompt_template_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Prompt template not found'
    );
  END IF;

  -- ============================================================================
  -- STAGE 1: SOURCE HUNTER - Find and create documents
  -- ============================================================================

  RAISE NOTICE '📋 STAGE 1: Source Hunter';
  RAISE NOTICE '';

  -- Loop through segments (LIMIT 1 for MVP)
  FOR v_segment IN
    SELECT s.*
    FROM segments s
    WHERE (v_profile.segment_ids IS NULL OR s.id = ANY(v_profile.segment_ids))
      AND s.is_active = true
    ORDER BY s.name
    LIMIT 1
  LOOP
    RAISE NOTICE '📊 Processing segment: %', v_segment.name;

    -- Loop through high-priority sources
    FOR v_source IN
      SELECT src.*
      FROM sources src
      JOIN source_types st ON src.source_type_id = st.id
      WHERE src.is_active = true
        AND st.priority >= COALESCE(v_profile.min_source_priority, 1)
      ORDER BY st.priority DESC, src.name
      LIMIT p_max_sources
    LOOP
      v_sources_processed := v_sources_processed + 1;
      RAISE NOTICE '🔍 Processing source %/%: %', v_sources_processed, p_max_sources, v_source.name;

      BEGIN
        -- Generate focused query
        RAISE NOTICE '   Generating query...';
        v_query := generate_search_query(
          v_segment.name,
          v_source.name,
          v_template.template_text
        );
        RAISE NOTICE '   Query: %', v_query;

        -- Search via Perplexity
        RAISE NOTICE '   Searching Perplexity...';
        FOR v_url_record IN
          SELECT * FROM search_perplexity(v_query, v_source.website_url)
          LIMIT p_max_urls_per_source
        LOOP
          BEGIN
            -- Save document
            v_document_id := save_document_with_segment(
              v_url_record.title,
              v_url_record.url,
              v_source.id,
              v_segment.id
            );

            v_documents_created := v_documents_created + 1;
            v_segment_links := v_segment_links + 1;
            RAISE NOTICE '   ✅ Saved: %', v_url_record.url;

          EXCEPTION WHEN OTHERS THEN
            v_errors := array_append(v_errors, jsonb_build_object(
              'step', 'save_document',
              'segment', v_segment.name,
              'source', v_source.name,
              'url', v_url_record.url,
              'error', SQLERRM
            ));
            RAISE NOTICE '   ❌ Save error: %', SQLERRM;
          END;
        END LOOP;

      EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors, jsonb_build_object(
          'step', 'search',
          'segment', v_segment.name,
          'source', v_source.name,
          'error', SQLERRM
        ));
        RAISE NOTICE '   ❌ Search error: %', SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Stage 1 Complete: % documents created', v_documents_created;
  RAISE NOTICE '';

  -- ============================================================================
  -- STAGE 2: CONTENT FETCHER - Download HTML for new documents
  -- ============================================================================

  IF v_documents_created > 0 THEN
    RAISE NOTICE '📋 STAGE 2: Content Fetcher';
    RAISE NOTICE '';

    BEGIN
      -- Fetch HTML content for newly created documents
      SELECT * INTO v_fetcher_result
      FROM fetch_pending_documents_sql(v_documents_created);

      v_fetched := COALESCE(v_fetcher_result.documents_fetched, 0);
      v_fetch_failed := COALESCE(v_fetcher_result.documents_failed, 0);

      RAISE NOTICE '✅ Stage 2 Complete: % fetched, % failed', v_fetched, v_fetch_failed;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, jsonb_build_object(
        'step', 'content_fetcher',
        'error', SQLERRM
      ));
      RAISE NOTICE '❌ Content Fetcher error: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '⏭️  Stage 2 Skipped: No documents to fetch';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Pipeline Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 Documents created: %', v_documents_created;
  RAISE NOTICE '📥 HTML fetched: %', v_fetched;
  RAISE NOTICE '❌ Fetch failed: %', v_fetch_failed;
  RAISE NOTICE '⚠️  Errors: %', COALESCE(array_length(v_errors, 1), 0);
  RAISE NOTICE '';

  -- ============================================================================
  -- Return comprehensive summary
  -- ============================================================================

  RETURN jsonb_build_object(
    'status', 'success',
    'profile_id', p_profile_id,
    'profile_name', v_profile.name,
    'stage_1_source_hunter', jsonb_build_object(
      'documents_created', v_documents_created,
      'segment_links', v_segment_links,
      'sources_processed', v_sources_processed
    ),
    'stage_2_content_fetcher', jsonb_build_object(
      'documents_fetched', v_fetched,
      'documents_failed', v_fetch_failed,
      'success_rate', CASE
        WHEN v_documents_created > 0 THEN ROUND((v_fetched::numeric / v_documents_created::numeric) * 100, 1)
        ELSE 0
      END
    ),
    'errors_count', COALESCE(array_length(v_errors, 1), 0),
    'errors', to_jsonb(v_errors)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION run_source_hunter_sql(uuid, int, int) TO postgres;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_test_profile_id uuid;
BEGIN
  -- Get test profile ID
  SELECT id INTO v_test_profile_id
  FROM monitoring_profiles
  WHERE name LIKE '%Test%' OR name LIKE '%MVP%'
  LIMIT 1;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 052 Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Updated: run_source_hunter_sql()';
  RAISE NOTICE '📋 Pipeline: Source Hunter → Content Fetcher';
  RAISE NOTICE '';
  RAISE NOTICE '✨ Features:';
  RAISE NOTICE '  • Automatic HTML fetching after document creation';
  RAISE NOTICE '  • Two-stage pipeline with separate stats';
  RAISE NOTICE '  • Success rate calculation';
  RAISE NOTICE '  • Comprehensive error tracking';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Test with:';

  IF v_test_profile_id IS NOT NULL THEN
    RAISE NOTICE '   SELECT run_source_hunter_sql(''%'', 1, 3);', v_test_profile_id;
  ELSE
    RAISE NOTICE '   SELECT run_source_hunter_sql(profile_id, 1, 3);';
  END IF;

  RAISE NOTICE '';
END $$;
