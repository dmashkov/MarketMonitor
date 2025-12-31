-- Migration 041: Add configurable limits to orchestrator
-- Purpose: Allow controlling max_sources and max_urls to avoid timeouts

DROP FUNCTION IF EXISTS run_source_hunter_sql(uuid);

CREATE OR REPLACE FUNCTION run_source_hunter_sql(
  p_profile_id uuid,
  p_max_sources int DEFAULT 1,  -- MVP: только 1 источник
  p_max_urls_per_source int DEFAULT 3  -- MVP: только 3 URL на источник
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
BEGIN
  RAISE NOTICE '🚀 Starting Source Hunter SQL with limits: max_sources=%, max_urls=%', p_max_sources, p_max_urls_per_source;

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

  RAISE NOTICE '✅ Complete! Documents: %, Errors: %', v_documents_created, array_length(v_errors, 1);

  -- Return summary
  RETURN jsonb_build_object(
    'status', 'success',
    'profile_id', p_profile_id,
    'profile_name', v_profile.name,
    'documents_created', v_documents_created,
    'segment_links', v_segment_links,
    'sources_processed', v_sources_processed,
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

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 041 complete!';
  RAISE NOTICE '   - Updated run_source_hunter_sql() with configurable limits';
  RAISE NOTICE '   - Default: 1 source, 3 URLs (to avoid timeout)';
  RAISE NOTICE '   ';
  RAISE NOTICE '🧪 Test: SELECT run_source_hunter_sql(profile_id, 1, 3);';
END $$;
