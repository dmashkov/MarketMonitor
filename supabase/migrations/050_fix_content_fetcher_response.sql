-- Migration 050: Fix Content Fetcher HTTP Response Field
-- Created: 2025-12-31
-- Purpose: Fix call_content_fetcher to use correct http_response fields
--
-- PROBLEM: v_response.status_text doesn't exist in http_response type
-- FIX: Remove references to status_text, use only status code + content

-- ============================================================================
-- Fix call_content_fetcher function
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
  -- Get Supabase URL
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
      -- HTTP error - use status code + content as error message
      RAISE WARNING 'Content Fetcher HTTP error: status=%', v_response.status;
      RAISE WARNING 'Response content: %', v_response.content;

      RETURN QUERY SELECT
        'error'::TEXT,
        0::INTEGER,
        array_length(p_document_ids, 1)::INTEGER,
        format('HTTP %s: %s', v_response.status, SUBSTRING(v_response.content, 1, 200))::TEXT;
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

COMMENT ON FUNCTION call_content_fetcher IS 'Calls Content Fetcher Edge Function to download HTML content for documents (FIXED: removed status_text reference)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 050 Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Fixed: Removed v_response.status_text references';
  RAISE NOTICE '✅ Function call_content_fetcher updated';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Test with: SELECT * FROM fetch_pending_documents(5);';
END $$;
