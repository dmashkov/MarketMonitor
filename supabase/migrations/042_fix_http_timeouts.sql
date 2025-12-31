-- Migration 042: Fix HTTP Timeouts for API Calls
-- Purpose: Increase timeout for OpenAI and Perplexity API calls
-- Problem: Default 5s timeout is too short for AI API responses

-- =====================================================
-- Update generate_search_query with longer timeout
-- =====================================================

DROP FUNCTION IF EXISTS generate_search_query(text, text, text);

CREATE OR REPLACE FUNCTION generate_search_query(
  p_segment_name text,
  p_source_name text,
  p_prompt_template text
)
RETURNS text AS $$
DECLARE
  v_openai_key text;
  v_openai_url text;
  v_http_request http_request;
  v_http_response http_response;
  v_request_body jsonb;
  v_response_body jsonb;
  v_generated_query text;
BEGIN
  -- Get OpenAI API key from vault
  SELECT decrypted_secret INTO v_openai_key
  FROM vault.decrypted_secrets
  WHERE name = 'OPENAI_API_KEY';

  IF v_openai_key IS NULL THEN
    RAISE EXCEPTION 'OPENAI_API_KEY not found in vault';
  END IF;

  v_openai_url := 'https://api.openai.com/v1/chat/completions';

  -- Build prompt for query generation
  v_request_body := jsonb_build_object(
    'model', 'gpt-4o-mini',
    'messages', jsonb_build_array(
      jsonb_build_object(
        'role', 'system',
        'content', 'You are a search query generator. Generate a focused search query in Russian for finding specific information.'
      ),
      jsonb_build_object(
        'role', 'user',
        'content', format(
          E'Сегмент: %s\nИсточник: %s\nЗадача: %s\n\nСгенерируй краткий поисковый запрос на русском языке (максимум 10-15 слов) для поиска релевантной информации. Верни ТОЛЬКО текст запроса без кавычек и пояснений.',
          p_segment_name,
          p_source_name,
          p_prompt_template
        )
      )
    ),
    'temperature', 0.3,
    'max_tokens', 100
  );

  -- Build HTTP request
  v_http_request := ROW(
    'POST',
    v_openai_url,
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || v_openai_key)
    ],
    'application/json',
    v_request_body::text
  )::http_request;

  -- Set longer timeout for this function (30 seconds)
  SET LOCAL statement_timeout = '30s';

  -- Execute request
  SELECT * INTO v_http_response FROM http(v_http_request);

  -- Check response
  IF v_http_response.status != 200 THEN
    RAISE EXCEPTION 'OpenAI API error: % - %', v_http_response.status, v_http_response.content;
  END IF;

  -- Parse response
  v_response_body := v_http_response.content::jsonb;
  v_generated_query := v_response_body->'choices'->0->'message'->>'content';

  -- Clean up the query (remove quotes, newlines, etc.)
  v_generated_query := TRIM(BOTH E' \n\r\t"''' FROM v_generated_query);

  RETURN v_generated_query;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error generating query: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_search_query(text, text, text) TO postgres;

-- =====================================================
-- Update search_perplexity with longer timeout
-- =====================================================

DROP FUNCTION IF EXISTS search_perplexity(text, text);

CREATE OR REPLACE FUNCTION search_perplexity(
  p_query text,
  p_source_url text DEFAULT NULL
)
RETURNS TABLE(
  url text,
  title text
) AS $$
DECLARE
  v_perplexity_key text;
  v_perplexity_url text;
  v_http_request http_request;
  v_http_response http_response;
  v_request_body jsonb;
  v_response_body jsonb;
  v_citations jsonb;
  v_message_content text;
  v_citation text;
  v_title_match text;
BEGIN
  -- Get Perplexity API key from vault
  SELECT decrypted_secret INTO v_perplexity_key
  FROM vault.decrypted_secrets
  WHERE name = 'PERPLEXITY_API_KEY';

  IF v_perplexity_key IS NULL THEN
    RAISE EXCEPTION 'PERPLEXITY_API_KEY not found in vault';
  END IF;

  v_perplexity_url := 'https://api.perplexity.ai/chat/completions';

  -- Build search prompt
  v_request_body := jsonb_build_object(
    'model', 'sonar',
    'messages', jsonb_build_array(
      jsonb_build_object(
        'role', 'system',
        'content', 'You are a helpful research assistant that finds recent news articles and returns structured data with real URLs.'
      ),
      jsonb_build_object(
        'role', 'user',
        'content', format('Search for: %s%s

Find recent news, articles, or announcements related to HVAC equipment, climate control, and air conditioning market in Russia.

Return only real, verifiable sources with actual URLs.',
          p_query,
          CASE WHEN p_source_url IS NOT NULL THEN format(E'\n\nFocus on content from: %s', p_source_url) ELSE '' END
        )
      )
    ),
    'temperature', 0.2,
    'max_tokens', 1000,
    'return_citations', true,
    'search_recency_filter', 'week'
  );

  -- Build HTTP request
  v_http_request := ROW(
    'POST',
    v_perplexity_url,
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || v_perplexity_key)
    ],
    'application/json',
    v_request_body::text
  )::http_request;

  -- Set longer timeout for this function (60 seconds for search API)
  SET LOCAL statement_timeout = '60s';

  -- Execute request
  SELECT * INTO v_http_response FROM http(v_http_request);

  -- Check response
  IF v_http_response.status != 200 THEN
    RAISE EXCEPTION 'Perplexity API error: % - %', v_http_response.status, v_http_response.content;
  END IF;

  -- Parse response
  v_response_body := v_http_response.content::jsonb;
  v_citations := v_response_body->'citations';
  v_message_content := v_response_body->'choices'->0->'message'->>'content';

  -- Return citations as table
  FOR v_citation IN SELECT jsonb_array_elements_text(v_citations)
  LOOP
    -- Try to extract title from message content
    -- Simple heuristic: find sentence containing this URL
    v_title_match := substring(v_message_content from format('([^.]+).*?%s', regexp_replace(v_citation, '[.*+?^${}()|[\]\\]', '\\\&', 'g')));

    IF v_title_match IS NULL OR LENGTH(v_title_match) < 10 THEN
      v_title_match := format('Document from %s', substring(v_citation from 'https?://([^/]+)'));
    END IF;

    url := v_citation;
    title := TRIM(v_title_match);
    RETURN NEXT;
  END LOOP;

  RETURN;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error searching Perplexity: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_perplexity(text, text) TO postgres;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 042 complete!';
  RAISE NOTICE '   - Updated generate_search_query() with 30s timeout';
  RAISE NOTICE '   - Updated search_perplexity() with 60s timeout';
  RAISE NOTICE '   - This should prevent "Operation timed out" errors';
  RAISE NOTICE '   ';
  RAISE NOTICE '🧪 Test: SELECT run_source_hunter_sql(profile_id, 1, 3);';
END $$;
