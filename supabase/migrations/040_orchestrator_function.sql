-- Migration 040: Main Source Hunter Orchestrator
-- Purpose: Combines all functions into single pipeline
-- Usage: Called by pg_cron or manually

-- =====================================================
-- Function 4: Main orchestrator
-- =====================================================

CREATE OR REPLACE FUNCTION run_source_hunter_sql(
  p_profile_id uuid
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
  v_errors jsonb[] := ARRAY[]::jsonb[];
BEGIN
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

  -- Loop through segments
  FOR v_segment IN
    SELECT s.*
    FROM segments s
    WHERE (v_profile.segment_ids IS NULL OR s.id = ANY(v_profile.segment_ids))
      AND s.is_active = true
    ORDER BY s.name
    LIMIT 1  -- MVP: Only 1 segment to avoid timeout
  LOOP
    -- Loop through high-priority sources
    FOR v_source IN
      SELECT src.*
      FROM sources src
      JOIN source_types st ON src.source_type_id = st.id
      WHERE src.is_active = true
        AND st.priority >= COALESCE(v_profile.min_source_priority, 1)
      ORDER BY st.priority DESC, src.name
      LIMIT COALESCE(v_profile.max_sources_per_run, 3)  -- MVP: Max 3 sources
    LOOP
      BEGIN
        -- Generate focused query
        v_query := generate_search_query(
          v_segment.name,
          v_source.name,
          v_template.template_text
        );

        -- Search via Perplexity
        FOR v_url_record IN
          SELECT * FROM search_perplexity(v_query, v_source.website_url)
          LIMIT 10  -- Max 10 URLs per source
        LOOP
          BEGIN
            -- Save document with segment link
            v_document_id := save_document_with_segment(
              v_url_record.title,
              v_url_record.url,
              v_source.id,
              v_segment.id
            );

            v_documents_created := v_documents_created + 1;
            v_segment_links := v_segment_links + 1;

          EXCEPTION WHEN OTHERS THEN
            -- Log error but continue
            v_errors := array_append(v_errors, jsonb_build_object(
              'step', 'save_document',
              'segment', v_segment.name,
              'source', v_source.name,
              'url', v_url_record.url,
              'error', SQLERRM
            ));
          END;
        END LOOP;

      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue with next source
        v_errors := array_append(v_errors, jsonb_build_object(
          'step', 'search',
          'segment', v_segment.name,
          'source', v_source.name,
          'error', SQLERRM
        ));
      END;
    END LOOP;
  END LOOP;

  -- Return summary
  RETURN jsonb_build_object(
    'status', 'success',
    'profile_id', p_profile_id,
    'profile_name', v_profile.name,
    'documents_created', v_documents_created,
    'segment_links', v_segment_links,
    'errors_count', array_length(v_errors, 1),
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

-- Grant execute
GRANT EXECUTE ON FUNCTION run_source_hunter_sql(uuid) TO postgres;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 040 complete!';
  RAISE NOTICE '   - run_source_hunter_sql() orchestrator created';
  RAISE NOTICE '   - Combines: generate_search_query + search_perplexity + save_document';
  RAISE NOTICE '   - MVP limits: 1 segment, 3 sources, 10 URLs per source';
  RAISE NOTICE '   ';
  RAISE NOTICE '🧪 Test: SELECT run_source_hunter_sql(profile_id);';
END $$;
