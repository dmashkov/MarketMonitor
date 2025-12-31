-- Test Content Fetcher with 5 documents
--
-- This script tests the Content Fetcher integration:
-- 1. Gets 5 documents needing fetch
-- 2. Calls Content Fetcher Edge Function
-- 3. Verifies HTML content was saved

-- ============================================================================
-- STEP 1: Check documents needing fetch
-- ============================================================================

SELECT COUNT(*) as total_pending
FROM get_documents_needing_fetch(1000);

-- ============================================================================
-- STEP 2: Preview 5 documents that will be fetched
-- ============================================================================

SELECT
  id,
  source_url,
  retry_count,
  last_fetch_attempt,
  CASE
    WHEN last_fetch_attempt IS NULL THEN 'Never tried'
    WHEN retry_count = 0 THEN 'First retry'
    ELSE 'Retry #' || retry_count
  END as status
FROM get_documents_needing_fetch(5);

-- ============================================================================
-- STEP 3: Call Content Fetcher (UNCOMMENT TO RUN!)
-- ============================================================================

-- IMPORTANT: This will make HTTP requests to external URLs!
-- Uncomment the line below to execute:

-- SELECT * FROM fetch_pending_documents(5);

-- ============================================================================
-- STEP 4: Verify results (after running STEP 3)
-- ============================================================================

-- Check fetched documents
SELECT
  id,
  source_url,
  content_html IS NOT NULL as has_html,
  content_length,
  content_truncated,
  fetched_at,
  retry_count,
  fetch_error,
  is_valid_url
FROM documents
WHERE content_html IS NOT NULL
ORDER BY fetched_at DESC NULLS LAST
LIMIT 10;

-- Summary statistics
SELECT
  COUNT(*) as total_documents,
  SUM(CASE WHEN content_html IS NOT NULL THEN 1 ELSE 0 END) as fetched,
  SUM(CASE WHEN content_html IS NULL AND is_valid_url = TRUE THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN is_valid_url = FALSE THEN 1 ELSE 0 END) as invalid_urls,
  SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) as retried
FROM documents;

-- Error breakdown
SELECT
  fetch_error,
  COUNT(*) as count
FROM documents
WHERE fetch_error IS NOT NULL
GROUP BY fetch_error
ORDER BY count DESC;
