-- Migration 049: Content Fetcher SQL Wrapper
-- Created: 2025-12-30
-- Purpose: SQL function to call Content Fetcher Edge Function from PostgreSQL

-- ============================================================================
-- PART 1: SQL Function Wrapper for Content Fetcher Edge Function
-- ============================================================================

CREATE OR REPLACE FUNCTION call_content_fetcher(
  p_document_ids UUID[],
  p_timeout_ms INTEGER DEFAULT 180000 -- 3 minutes timeout
)
RETURNS TABLE (
  status TEXT,
  documents_fetched INTEGER,
  documents_failed INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_function_url TEXT;
  v_payload JSONB;
  v_response http_response;
  v_response_body JSONB;
  v_service_role_key TEXT;
BEGIN
  -- Get Supabase URL from environment (or hardcode if needed)
  v_function_url := 'https://aggiamgeplckdrnbqmob.supabase.co/functions/v1/content-fetcher';

  -- Get Service Role Key from Vault
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  IF v_service_role_key IS NULL THEN
    RETURN QUERY SELECT
      'error'::TEXT,
      0::INTEGER,
      0::INTEGER,
      'Missing SUPABASE_SERVICE_ROLE_KEY in Vault'::TEXT;
    RETURN;
  END IF;

  -- Build JSON payload
  v_payload := jsonb_build_object('document_ids', to_jsonb(p_document_ids));

  RAISE NOTICE 'Calling Content Fetcher with % documents', array_length(p_document_ids, 1);

  -- Call Edge Function via HTTP
  BEGIN
    SELECT * INTO v_response
    FROM http((
      'POST',
      v_function_url,
      ARRAY[
        http_header('Authorization', 'Bearer ' || v_service_role_key),
        http_header('Content-Type', 'application/json'),
        http_header('apikey', v_service_role_key)
      ],
      'application/json',
      v_payload::TEXT
    )::http_request);

    -- Parse response
    IF v_response.status = 200 THEN
      v_response_body := v_response.content::JSONB;

      RETURN QUERY SELECT
        COALESCE(v_response_body->>'status', 'success')::TEXT,
        COALESCE((v_response_body->>'documents_updated')::INTEGER, 0),
        COALESCE((v_response_body->>'documents_failed')::INTEGER, 0),
        NULL::TEXT;
    ELSE
      -- HTTP error
      RAISE WARNING 'Content Fetcher HTTP error: % %', v_response.status, v_response.status_text;

      RETURN QUERY SELECT
        'error'::TEXT,
        0::INTEGER,
        array_length(p_document_ids, 1)::INTEGER,
        format('HTTP %s: %s', v_response.status, v_response.status_text)::TEXT;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Content Fetcher call failed: %', SQLERRM;

      RETURN QUERY SELECT
        'error'::TEXT,
        0::INTEGER,
        array_length(p_document_ids, 1)::INTEGER,
        SQLERRM::TEXT;
  END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION call_content_fetcher IS 'Calls Content Fetcher Edge Function to download HTML content for documents';

-- ============================================================================
-- PART 2: Batch Content Fetch Helper (with retry logic)
-- ============================================================================

CREATE OR REPLACE FUNCTION fetch_pending_documents(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  status TEXT,
  documents_fetched INTEGER,
  documents_failed INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_document_ids UUID[];
  v_result RECORD;
BEGIN
  -- Get documents needing fetch (using helper from migration 048)
  SELECT ARRAY_AGG(id) INTO v_document_ids
  FROM get_documents_needing_fetch(p_limit);

  -- Check if there are documents to fetch
  IF v_document_ids IS NULL OR array_length(v_document_ids, 1) = 0 THEN
    RAISE NOTICE 'No documents needing fetch';
    RETURN QUERY SELECT
      'success'::TEXT,
      0::INTEGER,
      0::INTEGER,
      'No documents needing fetch'::TEXT;
    RETURN;
  END IF;

  RAISE NOTICE 'Fetching content for % documents', array_length(v_document_ids, 1);

  -- Call Content Fetcher
  SELECT * INTO v_result
  FROM call_content_fetcher(v_document_ids);

  -- Return result
  RETURN QUERY SELECT
    v_result.status,
    v_result.documents_fetched,
    v_result.documents_failed,
    v_result.error_message;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fetch_pending_documents IS 'Fetches content for up to N pending documents (with retry logic)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_functions_created INTEGER;
  v_pending_docs INTEGER;
BEGIN
  -- Count functions
  SELECT COUNT(*) INTO v_functions_created
  FROM pg_proc
  WHERE proname IN ('call_content_fetcher', 'fetch_pending_documents');

  RAISE NOTICE '✅ Functions created: % / 2', v_functions_created;

  -- Count pending documents
  SELECT COUNT(*) INTO v_pending_docs
  FROM get_documents_needing_fetch(1000);

  RAISE NOTICE '📊 Documents pending fetch: %', v_pending_docs;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 049 Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Test with: SELECT * FROM fetch_pending_documents(5);';
END $$;
