-- Migration 051: SQL-based Content Fetcher
-- Created: 2025-12-31
-- Purpose: Pure PostgreSQL content fetching (no Edge Functions, no auth issues)
--
-- ARCHITECTURE: Simple HTTP GET → Save RAW HTML
-- LIMITATION: 5-second timeout per request (http extension hard limit)

-- ============================================================================
-- PART 1: Fetch single document content
-- ============================================================================

CREATE OR REPLACE FUNCTION fetch_document_content(p_document_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT,
  content_length INTEGER
) AS $$
DECLARE
  v_url TEXT;
  v_response http_response;
  v_html TEXT;
  v_error TEXT := NULL;
  v_is_valid BOOLEAN := TRUE;
  v_truncated BOOLEAN := FALSE;
  v_max_size INTEGER := 500000; -- 500KB limit
BEGIN
  -- Get document URL
  SELECT source_url INTO v_url
  FROM documents
  WHERE id = p_document_id;

  IF v_url IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Document not found'::TEXT, 0::INTEGER;
    RETURN;
  END IF;

  -- Validate URL format
  IF v_url !~* '^https?://' THEN
    v_is_valid := FALSE;
    v_error := 'Invalid URL format (must start with http:// or https://)';

    UPDATE documents
    SET
      is_valid_url = FALSE,
      fetch_error = v_error,
      last_fetch_attempt = NOW()
    WHERE id = p_document_id;

    RETURN QUERY SELECT FALSE, v_error, 0::INTEGER;
    RETURN;
  END IF;

  -- Fetch content via HTTP GET
  BEGIN
    RAISE NOTICE '🔍 Fetching: %', v_url;

    SELECT * INTO v_response
    FROM http((
      'GET',
      v_url,
      ARRAY[
        http_header('User-Agent', 'MarketMonitor/1.0'),
        http_header('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
      ],
      NULL,
      NULL
    )::http_request);

    -- Check HTTP status
    IF v_response.status = 200 THEN
      v_html := v_response.content;

      -- Check content size and truncate if needed
      IF LENGTH(v_html) > v_max_size THEN
        RAISE NOTICE '⚠️ Content truncated: % bytes → % bytes', LENGTH(v_html), v_max_size;
        v_html := SUBSTRING(v_html, 1, v_max_size);
        v_truncated := TRUE;
      END IF;

      -- Save to database
      UPDATE documents
      SET
        content_html = v_html,
        content_length = LENGTH(v_html),
        content_truncated = v_truncated,
        fetched_at = NOW(),
        is_valid_url = TRUE,
        fetch_error = NULL,
        last_fetch_attempt = NOW()
      WHERE id = p_document_id;

      RAISE NOTICE '✅ Success: % bytes', LENGTH(v_html);
      RETURN QUERY SELECT TRUE, NULL::TEXT, LENGTH(v_html)::INTEGER;

    ELSIF v_response.status = 404 THEN
      v_error := 'HTTP 404: Not Found';
      v_is_valid := FALSE;

    ELSIF v_response.status = 403 THEN
      v_error := 'HTTP 403: Forbidden (blocked by website)';
      v_is_valid := FALSE;

    ELSIF v_response.status >= 500 THEN
      v_error := format('HTTP %s: Server Error', v_response.status);
      v_is_valid := TRUE; -- Server error, URL is valid, retry later

    ELSE
      v_error := format('HTTP %s: %s', v_response.status, SUBSTRING(v_response.content, 1, 100));
      v_is_valid := TRUE; -- Unknown error, might be temporary
    END IF;

    -- Save error
    UPDATE documents
    SET
      fetch_error = v_error,
      is_valid_url = v_is_valid,
      retry_count = retry_count + 1,
      last_fetch_attempt = NOW()
    WHERE id = p_document_id;

    RAISE NOTICE '❌ Error: %', v_error;
    RETURN QUERY SELECT FALSE, v_error, 0::INTEGER;

  EXCEPTION
    WHEN OTHERS THEN
      -- Handle timeout and other exceptions
      v_error := SQLERRM;

      -- Check if it's a timeout
      IF v_error LIKE '%timed out%' OR v_error LIKE '%timeout%' THEN
        v_error := 'Timeout after 5 seconds (content too large or slow server)';
        v_is_valid := TRUE; -- URL is valid, just slow
      ELSE
        v_is_valid := FALSE; -- Unknown error, mark as invalid
      END IF;

      UPDATE documents
      SET
        fetch_error = v_error,
        is_valid_url = v_is_valid,
        retry_count = retry_count + 1,
        last_fetch_attempt = NOW()
      WHERE id = p_document_id;

      RAISE NOTICE '❌ Exception: %', v_error;
      RETURN QUERY SELECT FALSE, v_error, 0::INTEGER;
  END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fetch_document_content IS 'Fetches HTML content for a single document via HTTP GET (5s timeout limit)';

-- ============================================================================
-- PART 2: Batch fetch pending documents
-- ============================================================================

CREATE OR REPLACE FUNCTION fetch_pending_documents_sql(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  status TEXT,
  documents_fetched INTEGER,
  documents_failed INTEGER,
  error_summary JSONB
) AS $$
DECLARE
  v_doc RECORD;
  v_result RECORD;
  v_fetched INTEGER := 0;
  v_failed INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  v_processed INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🚀 Starting SQL Content Fetcher';
  RAISE NOTICE '========================================';

  -- Loop through pending documents
  FOR v_doc IN
    SELECT id, source_url
    FROM get_documents_needing_fetch(p_limit)
  LOOP
    v_processed := v_processed + 1;
    RAISE NOTICE '';
    RAISE NOTICE '[%/%] Processing: %', v_processed, p_limit, v_doc.source_url;

    -- Fetch content for this document
    SELECT * INTO v_result
    FROM fetch_document_content(v_doc.id);

    IF v_result.success THEN
      v_fetched := v_fetched + 1;
    ELSE
      v_failed := v_failed + 1;

      -- Collect error for summary
      v_errors := v_errors || jsonb_build_object(
        'url', v_doc.source_url,
        'error', v_result.error_message
      );
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SQL Content Fetcher Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 Fetched: %', v_fetched;
  RAISE NOTICE '❌ Failed: %', v_failed;
  RAISE NOTICE '';

  -- Return summary
  RETURN QUERY SELECT
    'success'::TEXT,
    v_fetched,
    v_failed,
    v_errors;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fetch_pending_documents_sql IS 'Batch fetches content for pending documents (SQL-based, no Edge Functions)';

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
  WHERE proname IN ('fetch_document_content', 'fetch_pending_documents_sql');

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 051 Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 SQL-based Content Fetcher created';
  RAISE NOTICE '✅ Functions created: % / 2', v_functions_created;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Features:';
  RAISE NOTICE '  • Pure PostgreSQL (no Edge Functions)';
  RAISE NOTICE '  • No authentication issues';
  RAISE NOTICE '  • 5-second timeout per document';
  RAISE NOTICE '  • 500KB size limit with truncation';
  RAISE NOTICE '  • RAW HTML storage';
  RAISE NOTICE '  • Error handling (404, 403, timeout)';
  RAISE NOTICE '  • Retry logic with exponential backoff';
  RAISE NOTICE '';

  -- Count pending documents
  SELECT COUNT(*) INTO v_pending_docs
  FROM get_documents_needing_fetch(1000);

  RAISE NOTICE '📊 Documents pending fetch: %', v_pending_docs;
  RAISE NOTICE '';
  RAISE NOTICE '💡 Test with:';
  RAISE NOTICE '   SELECT * FROM fetch_pending_documents_sql(5);';
  RAISE NOTICE '';
END $$;
