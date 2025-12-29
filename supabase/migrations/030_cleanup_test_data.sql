-- Migration 030: Cleanup test data
-- Date: 2025-12-29
-- Purpose: Remove all test documents, events, and search runs before production testing

-- ============================================================================
-- 1. DELETE IN CORRECT ORDER (respect foreign keys)
-- ============================================================================

-- Delete linking tables first (they reference documents)
DELETE FROM public.document_segments;
DELETE FROM public.document_brands;
DELETE FROM public.document_geographies;
DELETE FROM public.document_event_types;

-- Delete events
DELETE FROM public.events;

-- Delete search run stages
DELETE FROM public.search_runs_stages;

-- Delete search run prompts
DELETE FROM public.search_runs_prompts;

-- Delete search runs
DELETE FROM public.search_runs;

-- Delete documents (this is the big one)
DELETE FROM public.documents;

-- Reset Perplexity usage counter for today (optional)
-- DELETE FROM public.perplexity_search_usage WHERE date = CURRENT_DATE;

-- ============================================================================
-- 2. VERIFICATION
-- ============================================================================

-- Check counts (should all be 0)
SELECT
  'documents' as table_name,
  COUNT(*) as count
FROM public.documents
UNION ALL
SELECT 'events', COUNT(*) FROM public.events
UNION ALL
SELECT 'search_runs', COUNT(*) FROM public.search_runs
UNION ALL
SELECT 'search_runs_stages', COUNT(*) FROM public.search_runs_stages
UNION ALL
SELECT 'document_segments', COUNT(*) FROM public.document_segments
UNION ALL
SELECT 'document_brands', COUNT(*) FROM public.document_brands
ORDER BY table_name;
