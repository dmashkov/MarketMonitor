-- Migration 037: SQL-based Source Hunter Functions
-- Purpose: Move Source Hunter logic to PostgreSQL to bypass Edge Function 401 errors
--
-- Functions created:
-- 1. generate_search_query() - OpenAI query generation
-- 2. search_perplexity() - Perplexity API search (TODO: next migration)
-- 3. save_document_with_segment() - Document saving (TODO: next migration)
-- 4. run_source_hunter_sql() - Main orchestrator (TODO: next migration)

-- =====================================================
-- Function 1: Generate focused search query via OpenAI
-- =====================================================

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
  v_system_prompt text;
  v_user_prompt text;
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

  -- Build prompts
  v_system_prompt := 'You are a search query generator. Generate a focused search query in Russian for finding recent news and events.';

  v_user_prompt := format(
    'Generate a focused search query for:
Segment: %s
Source: %s
Context: %s

Return ONLY the search query text, no explanations.',
    p_segment_name,
    p_source_name,
    p_prompt_template
  );

  -- Build request body
  v_request_body := jsonb_build_object(
    'model', 'gpt-4o-mini',
    'messages', jsonb_build_array(
      jsonb_build_object('role', 'system', 'content', v_system_prompt),
      jsonb_build_object('role', 'user', 'content', v_user_prompt)
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

  -- Execute request
  SELECT * INTO v_http_response FROM http(v_http_request);

  -- Check response
  IF v_http_response.status != 200 THEN
    RAISE EXCEPTION 'OpenAI API error: % - %', v_http_response.status, v_http_response.content;
  END IF;

  -- Parse response
  v_response_body := v_http_response.content::jsonb;
  v_generated_query := v_response_body->'choices'->0->'message'->>'content';

  -- Clean up query (remove quotes, newlines)
  v_generated_query := TRIM(BOTH '"' FROM v_generated_query);
  v_generated_query := REPLACE(v_generated_query, E'\n', ' ');

  RETURN v_generated_query;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error generating query: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION generate_search_query(text, text, text) TO postgres;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 037 complete!';
  RAISE NOTICE '   - generate_search_query() function created';
  RAISE NOTICE '   - Uses OpenAI API via http extension';
  RAISE NOTICE '   - Reads API key from vault.decrypted_secrets';
  RAISE NOTICE '   ';
  RAISE NOTICE '🧪 Test: SELECT generate_search_query(''RAC'', ''Даичи'', ''Найти критические события'');';
END $$;
