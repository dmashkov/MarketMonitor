-- Migration 048: Content Fetcher Error Tracking Columns
-- Created: 2025-12-30
-- Purpose: Add columns for Content Fetcher error tracking and retry logic

-- ============================================================================
-- PART 1: Add Error Tracking Columns to documents table
-- ============================================================================

-- Add is_valid_url flag (for 404s, 403s, etc.)
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS is_valid_url BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.documents.is_valid_url IS 'Flag indicating if source_url is accessible (false for 404, permanent errors)';

-- Add fetch_error for debugging
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS fetch_error TEXT;

COMMENT ON COLUMN public.documents.fetch_error IS 'Error message from Content Fetcher (404, timeout, etc.)';

-- Add content_truncated flag
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS content_truncated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.documents.content_truncated IS 'True if content was truncated due to size limits';

-- Add retry_count for retry logic
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.documents.retry_count IS 'Number of fetch attempts for this document';

-- Add last_fetch_attempt timestamp
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS last_fetch_attempt TIMESTAMPTZ;

COMMENT ON COLUMN public.documents.last_fetch_attempt IS 'Timestamp of last fetch attempt (for retry backoff)';

-- ============================================================================
-- PART 2: Create Indexes for Performance
-- ============================================================================

-- Index on fetched_at (to find unfetched documents)
CREATE INDEX IF NOT EXISTS idx_documents_fetched_at
ON public.documents(fetched_at)
WHERE fetched_at IS NOT NULL;

-- Index on is_valid_url (to filter invalid URLs)
CREATE INDEX IF NOT EXISTS idx_documents_valid_url
ON public.documents(is_valid_url)
WHERE is_valid_url = FALSE;

-- Index on content_html null (to find documents needing fetching)
CREATE INDEX IF NOT EXISTS idx_documents_content_html_null
ON public.documents(created_at DESC)
WHERE content_html IS NULL AND is_valid_url = TRUE;

-- Index on retry_count (to find documents needing retry)
CREATE INDEX IF NOT EXISTS idx_documents_retry_count
ON public.documents(retry_count)
WHERE retry_count > 0 AND retry_count < 3 AND is_valid_url = TRUE;

-- ============================================================================
-- PART 3: Helper Function - Get Documents Needing Fetch
-- ============================================================================

CREATE OR REPLACE FUNCTION get_documents_needing_fetch(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  source_url TEXT,
  retry_count INTEGER,
  last_fetch_attempt TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.source_url,
    d.retry_count,
    d.last_fetch_attempt
  FROM documents d
  WHERE d.content_html IS NULL
    AND d.is_valid_url = TRUE
    AND d.source_url IS NOT NULL
    AND (
      -- Never tried
      d.last_fetch_attempt IS NULL
      OR
      -- Failed but can retry (< 3 attempts and backoff period passed)
      (
        d.retry_count < 3
        AND d.last_fetch_attempt < NOW() - INTERVAL '5 minutes' * POWER(2, d.retry_count)
      )
    )
  ORDER BY d.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_documents_needing_fetch IS 'Returns documents that need content fetching (with exponential backoff for retries)';

-- ============================================================================
-- PART 4: Helper Function - Update Fetch Status
-- ============================================================================

CREATE OR REPLACE FUNCTION update_fetch_status(
  p_document_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL,
  p_content_html TEXT DEFAULT NULL,
  p_content_length INTEGER DEFAULT NULL,
  p_truncated BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  IF p_success THEN
    -- Success: update content and reset retry count
    UPDATE documents
    SET
      content_html = p_content_html,
      content_length = p_content_length,
      content_truncated = p_truncated,
      fetched_at = NOW(),
      retry_count = 0,
      last_fetch_attempt = NOW(),
      fetch_error = NULL,
      is_valid_url = TRUE
    WHERE id = p_document_id;
  ELSE
    -- Failure: increment retry count, save error
    UPDATE documents
    SET
      retry_count = retry_count + 1,
      last_fetch_attempt = NOW(),
      fetch_error = p_error_message,
      -- Mark as invalid if 404 or permanent error
      is_valid_url = CASE
        WHEN p_error_message LIKE '%404%' THEN FALSE
        WHEN p_error_message LIKE '%403%' THEN FALSE
        WHEN p_error_message LIKE '%410%' THEN FALSE
        ELSE TRUE
      END
    WHERE id = p_document_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_fetch_status IS 'Updates document fetch status after Content Fetcher attempt';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_columns_added INTEGER := 0;
  v_indexes_created INTEGER := 0;
  v_functions_created INTEGER := 0;
  v_unfetched_docs INTEGER;
BEGIN
  -- Count new columns
  SELECT COUNT(*) INTO v_columns_added
  FROM information_schema.columns
  WHERE table_name = 'documents'
    AND column_name IN ('is_valid_url', 'fetch_error', 'content_truncated', 'retry_count', 'last_fetch_attempt');

  RAISE NOTICE '✅ Columns added: % / 5', v_columns_added;

  -- Count indexes
  SELECT COUNT(*) INTO v_indexes_created
  FROM pg_indexes
  WHERE tablename = 'documents'
    AND indexname LIKE 'idx_documents_%'
    AND indexname IN (
      'idx_documents_fetched_at',
      'idx_documents_valid_url',
      'idx_documents_content_html_null',
      'idx_documents_retry_count'
    );

  RAISE NOTICE '✅ Indexes created: % / 4', v_indexes_created;

  -- Count functions
  SELECT COUNT(*) INTO v_functions_created
  FROM pg_proc
  WHERE proname IN ('get_documents_needing_fetch', 'update_fetch_status');

  RAISE NOTICE '✅ Functions created: % / 2', v_functions_created;

  -- Count documents needing fetch
  SELECT COUNT(*) INTO v_unfetched_docs
  FROM get_documents_needing_fetch(1000);

  RAISE NOTICE '📊 Documents needing fetch: %', v_unfetched_docs;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 048 Complete';
  RAISE NOTICE '========================================';
END $$;
