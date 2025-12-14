-- ============================================================================
-- MIGRATION 003: Job Schedules
-- ============================================================================
-- Created: 2024-12-04
-- Purpose: Create job schedules table for recurring searches
--
-- Features:
--   - Cron expression based scheduling
--   - Track execution history
--   - Parameter templates

-- ============================================================================
-- JOB SCHEDULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  parameters JSONB DEFAULT '{}'::JSONB,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'running', NULL)),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_job_schedules_prompt_id ON job_schedules(prompt_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_job_schedules_is_active ON job_schedules(is_active);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_job_schedules_next_run_at ON job_schedules(next_run_at)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_job_schedules_created_by ON job_schedules(created_by);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_job_schedules_created_at ON job_schedules(created_at DESC);

-- ============================================================================
-- TRIGGER: Update updated_at on job_schedules
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_job_schedules_updated_at ON job_schedules;

CREATE TRIGGER trigger_job_schedules_updated_at
  BEFORE UPDATE ON job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTION: Get schedule with prompt info
-- ============================================================================

CREATE OR REPLACE FUNCTION get_schedule_with_prompt(schedule_id UUID)
RETURNS TABLE (
  id UUID,
  prompt_id UUID,
  prompt_name TEXT,
  prompt_template TEXT,
  name TEXT,
  cron_expression TEXT,
  is_active BOOLEAN,
  parameters JSONB,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    js.id,
    js.prompt_id,
    ap.name,
    ap.prompt_template,
    js.name,
    js.cron_expression,
    js.is_active,
    js.parameters,
    js.last_run_at,
    js.next_run_at,
    js.last_run_status,
    js.created_by,
    js.created_at,
    js.updated_at
  FROM job_schedules js
  LEFT JOIN ai_prompts ap ON js.prompt_id = ap.id
  WHERE js.id = schedule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION: Get all active schedules due to run
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_schedules_due_to_run()
RETURNS TABLE (
  id UUID,
  prompt_id UUID,
  name TEXT,
  cron_expression TEXT,
  parameters JSONB,
  created_by UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    js.id,
    js.prompt_id,
    js.name,
    js.cron_expression,
    js.parameters,
    js.created_by
  FROM job_schedules js
  WHERE js.is_active = true
    AND js.next_run_at IS NOT NULL
    AND js.next_run_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE job_schedules IS 'Recurring search schedules based on cron expressions';
COMMENT ON COLUMN job_schedules.cron_expression IS 'Standard cron format (e.g., "0 9 * * *" = every day at 09:00)';
COMMENT ON COLUMN job_schedules.next_run_at IS 'Calculated next execution time (updated by scheduler)';
COMMENT ON COLUMN job_schedules.last_run_status IS 'Status of last execution: success | failed | running';
COMMENT ON COLUMN job_schedules.parameters IS 'Parameters to use when running this schedule (merged with prompt defaults)';

-- ============================================================================
-- CRON EXPRESSION EXAMPLES
-- ============================================================================
-- "0 9 * * *"       - Every day at 09:00 UTC
-- "0 9 * * 1"       - Every Monday at 09:00 UTC
-- "0 9 * * 1-5"     - Every weekday (Mon-Fri) at 09:00 UTC
-- "0 */6 * * *"     - Every 6 hours
-- "0 9,17 * * *"    - At 09:00 and 17:00 every day
-- "*/30 * * * *"    - Every 30 minutes

-- ============================================================================
-- MIGRATION STATUS
-- ============================================================================
-- ✅ job_schedules table created
-- ✅ Indexes for performance
-- ✅ Helper functions for schedule queries
-- ⏳ Next: RLS POLICIES (migration 004)
-- ⏳ Next: AUDIT LOG TABLE (optional migration 005)
