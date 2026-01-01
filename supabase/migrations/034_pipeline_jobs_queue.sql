-- Migration 034: Async Job Queue for Pipeline Processing
-- Purpose: Allow processing of all 8 segments without Edge Function timeout
-- Architecture: pg_cron triggers job-processor every minute to process pending jobs

-- =====================================================
-- STEP 1: Create pipeline_jobs table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoring_profile_id UUID NOT NULL REFERENCES public.monitoring_profiles(id) ON DELETE CASCADE,

  -- Job status: 'pending' → 'in_progress' → 'completed' or 'failed'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',

  -- Progress tracking
  total_segments INTEGER NOT NULL,           -- Total number of segments to process
  processed_segments INTEGER DEFAULT 0,      -- How many segments completed
  total_sources INTEGER NOT NULL,            -- Total sources to query
  current_segment_id UUID,                   -- Currently processing segment

  -- Results accumulation
  documents_created INTEGER DEFAULT 0,       -- Total documents created so far
  errors JSONB DEFAULT '[]'::JSONB,         -- Array of error objects

  -- Timing information
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,                    -- When job started processing
  completed_at TIMESTAMPTZ,                  -- When job finished (success or fail)
  estimated_completion_at TIMESTAMPTZ,       -- Estimated finish time

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::JSONB,        -- Additional data (search_run_id, etc.)

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled'))
);

-- =====================================================
-- STEP 2: Create indexes for performance
-- =====================================================

-- Query pending jobs quickly
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status
ON public.pipeline_jobs(status)
WHERE status IN ('pending', 'in_progress');

-- Order by creation date for FIFO queue
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_created_at
ON public.pipeline_jobs(created_at DESC);

-- Filter by monitoring profile
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_profile
ON public.pipeline_jobs(monitoring_profile_id);

-- Filter by user (for "my jobs" view)
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_created_by
ON public.pipeline_jobs(created_by);

-- =====================================================
-- STEP 3: Add RLS policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage all pipeline jobs" ON public.pipeline_jobs;
CREATE POLICY "Admins can manage all pipeline jobs"
ON public.pipeline_jobs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Users can view their own jobs
DROP POLICY IF EXISTS "Users can view their own pipeline jobs" ON public.pipeline_jobs;
CREATE POLICY "Users can view their own pipeline jobs"
ON public.pipeline_jobs
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- =====================================================
-- STEP 4: Add helpful comments
-- =====================================================

COMMENT ON TABLE public.pipeline_jobs IS 'Async job queue for pipeline processing to avoid Edge Function timeouts';
COMMENT ON COLUMN public.pipeline_jobs.status IS 'Job status: pending, in_progress, completed, failed, cancelled';
COMMENT ON COLUMN public.pipeline_jobs.processed_segments IS 'Number of segments processed so far (for progress bar)';
COMMENT ON COLUMN public.pipeline_jobs.errors IS 'Array of error objects: [{"segment_id": "...", "error": "..."}]';
COMMENT ON COLUMN public.pipeline_jobs.metadata IS 'Additional metadata: {"search_run_id": "...", "original_request": {...}}';

-- =====================================================
-- STEP 5: Create helper function for job stats
-- =====================================================

-- Function to calculate job progress percentage
CREATE OR REPLACE FUNCTION public.get_job_progress(job_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total INT;
  processed INT;
BEGIN
  SELECT total_segments, processed_segments
  INTO total, processed
  FROM public.pipeline_jobs
  WHERE id = job_id;

  IF total = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((processed::DECIMAL / total::DECIMAL) * 100);
END;
$$;

COMMENT ON FUNCTION public.get_job_progress IS 'Calculate job completion percentage (0-100)';

-- =====================================================
-- VERIFICATION QUERIES (for testing)
-- =====================================================

-- Check table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pipeline_jobs') THEN
    RAISE EXCEPTION 'Table pipeline_jobs was not created!';
  END IF;

  RAISE NOTICE '✅ Migration 034 applied successfully';
  RAISE NOTICE '   - pipeline_jobs table created';
  RAISE NOTICE '   - 4 indexes created';
  RAISE NOTICE '   - RLS policies applied';
  RAISE NOTICE '   - Helper function get_job_progress created';
END $$;
