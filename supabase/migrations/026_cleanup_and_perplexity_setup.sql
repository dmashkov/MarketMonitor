-- Migration 026: Cleanup fake documents + Add Perplexity rate limiting
-- Date: 2024-12-14
-- Purpose:
--   1. Delete all fake/mock documents from database
--   2. Add content_length column to documents table
--   3. Create perplexity_search_usage table for rate limiting (1000/day MAX)

-- ============================================================================
-- 1. Delete all fake documents (URL contains timestamp pattern)
-- ============================================================================

-- Delete documents where file_url contains /news/{timestamp}
-- These are mock documents created by Source Hunter stub
DELETE FROM documents
WHERE file_url ~ '/news/\d{13}$';

-- Delete any orphaned search_runs and stages
DELETE FROM search_runs_stages WHERE search_run_id IN (
  SELECT id FROM search_runs WHERE documents_created > 0 AND events_created = 0
);

DELETE FROM search_runs WHERE documents_created > 0 AND events_created = 0;

-- ============================================================================
-- 2. Add content_length column to documents table
-- ============================================================================

-- Add content_length column (fixes Content Fetcher DB error)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS content_length INTEGER;

-- Add comment
COMMENT ON COLUMN documents.content_length IS 'Length of content_text in characters (for display and filtering)';

-- ============================================================================
-- 3. Create perplexity_search_usage table for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS perplexity_search_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  requests_count INTEGER NOT NULL DEFAULT 0,
  max_requests_per_day INTEGER NOT NULL DEFAULT 1000,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast date lookup
CREATE INDEX IF NOT EXISTS idx_perplexity_usage_date
ON perplexity_search_usage(date);

-- Comment
COMMENT ON TABLE perplexity_search_usage IS 'Track Perplexity API usage to enforce 1000 requests/day limit (~$6/month MAX)';

-- ============================================================================
-- 4. RLS Policies for perplexity_search_usage
-- ============================================================================

-- Enable RLS
ALTER TABLE perplexity_search_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read usage stats
CREATE POLICY "Admins can view Perplexity usage stats"
ON perplexity_search_usage
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Policy: System (service role) can insert/update
CREATE POLICY "Service role can manage Perplexity usage"
ON perplexity_search_usage
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 5. Helper function to check if search is allowed
-- ============================================================================

CREATE OR REPLACE FUNCTION can_make_perplexity_search()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date DATE;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  today_date := CURRENT_DATE;

  -- Get today's usage
  SELECT requests_count, max_requests_per_day
  INTO current_count, max_allowed
  FROM perplexity_search_usage
  WHERE date = today_date;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO perplexity_search_usage (date, requests_count, max_requests_per_day)
    VALUES (today_date, 0, 1000);
    RETURN TRUE;
  END IF;

  -- Check if under limit
  RETURN current_count < max_allowed;
END;
$$;

COMMENT ON FUNCTION can_make_perplexity_search IS 'Check if Perplexity API daily limit (1000/day) allows more requests';

-- ============================================================================
-- 6. Helper function to increment usage counter
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_perplexity_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date DATE;
  new_count INTEGER;
BEGIN
  today_date := CURRENT_DATE;

  -- Upsert: increment if exists, create if not
  INSERT INTO perplexity_search_usage (date, requests_count, max_requests_per_day, last_updated_at)
  VALUES (today_date, 1, 1000, NOW())
  ON CONFLICT (date)
  DO UPDATE SET
    requests_count = perplexity_search_usage.requests_count + 1,
    last_updated_at = NOW()
  RETURNING requests_count INTO new_count;

  RETURN new_count;
END;
$$;

COMMENT ON FUNCTION increment_perplexity_usage IS 'Increment Perplexity API usage counter and return new count';

-- ============================================================================
-- Done!
-- ============================================================================
