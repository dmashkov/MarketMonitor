-- Migration 031: Deduplicate sources table + add UNIQUE constraint on website_url
-- Date: 2025-12-29
-- Purpose: Remove duplicate sources with same website_url and prevent future duplicates

-- ============================================================================
-- 1. FIND AND DISPLAY DUPLICATES (for logging)
-- ============================================================================

-- Show duplicates before deletion
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT website_url, COUNT(*) as cnt
    FROM public.sources
    WHERE website_url IS NOT NULL
    GROUP BY website_url
    HAVING COUNT(*) > 1
  ) dups;

  RAISE NOTICE 'Found % duplicate website_url groups', duplicate_count;
END $$;

-- ============================================================================
-- 2. DELETE DUPLICATES (keep the OLDEST record by created_at)
-- ============================================================================

-- Delete duplicate sources using ROW_NUMBER() to identify which to keep
DELETE FROM public.sources
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY website_url
        ORDER BY created_at ASC NULLS LAST, id  -- Keep oldest by created_at, fallback to id
      ) as row_num
    FROM public.sources
    WHERE website_url IS NOT NULL
  ) ranked
  WHERE row_num > 1  -- Delete all except the first (oldest) in each group
);

-- ============================================================================
-- 3. ADD UNIQUE CONSTRAINT
-- ============================================================================

-- Add UNIQUE constraint on website_url (allowing NULLs)
-- Note: PostgreSQL allows multiple NULL values with UNIQUE constraint
ALTER TABLE public.sources
ADD CONSTRAINT sources_website_url_unique UNIQUE (website_url);

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

-- Verify no duplicates remain
DO $$
DECLARE
  remaining_dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_dups
  FROM (
    SELECT website_url, COUNT(*) as cnt
    FROM public.sources
    WHERE website_url IS NOT NULL
    GROUP BY website_url
    HAVING COUNT(*) > 1
  ) dups;

  IF remaining_dups > 0 THEN
    RAISE EXCEPTION 'Still found % duplicate website_url groups after cleanup!', remaining_dups;
  ELSE
    RAISE NOTICE '✅ All duplicates removed successfully. UNIQUE constraint added.';
  END IF;
END $$;

-- Show final counts
SELECT
  COUNT(*) as total_sources,
  COUNT(DISTINCT website_url) as unique_urls,
  COUNT(*) FILTER (WHERE website_url IS NULL) as null_urls
FROM public.sources;
