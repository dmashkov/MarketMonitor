-- ============================================================================
-- MIGRATION 001: Initial Schema
-- ============================================================================
-- Created: 2024-12-04
-- Purpose: Create initial database schema for MarketMonitor
--
-- Tables:
--   - events (market events)
--   - ai_prompts (prompt library)
--   - search_runs (execution history)

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  segment TEXT NOT NULL,
  geography TEXT,
  channel TEXT CHECK (channel IN ('B2B', 'B2G', 'B2C')),
  event_type TEXT NOT NULL,
  company TEXT,
  description TEXT NOT NULL,
  criticality INTEGER NOT NULL CHECK (criticality >= 1 AND criticality <= 5),
  source_url TEXT,
  raw_data JSONB,
  found_by_search_run_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC);
CREATE INDEX IF NOT EXISTS idx_events_segment ON events(segment);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company);
CREATE INDEX IF NOT EXISTS idx_events_criticality ON events(criticality DESC);
CREATE INDEX IF NOT EXISTS idx_events_channel ON events(channel);
CREATE INDEX IF NOT EXISTS idx_events_search_run_id ON events(found_by_search_run_id);

-- ============================================================================
-- AI PROMPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL,
  search_type TEXT,
  is_active BOOLEAN DEFAULT true,
  parameters JSONB DEFAULT '{}'::JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_prompts_is_active ON ai_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_search_type ON ai_prompts(search_type);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_created_by ON ai_prompts(created_by);

-- ============================================================================
-- SEARCH RUNS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES ai_prompts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')) DEFAULT 'running',
  events_found INTEGER DEFAULT 0,
  parameters_used JSONB DEFAULT '{}'::JSONB,
  error_message TEXT,
  triggered_by UUID,
  is_scheduled BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_time_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_runs_prompt_id ON search_runs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_search_runs_status ON search_runs(status);
CREATE INDEX IF NOT EXISTS idx_search_runs_triggered_by ON search_runs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_search_runs_is_scheduled ON search_runs(is_scheduled);
CREATE INDEX IF NOT EXISTS idx_search_runs_created_at ON search_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_runs_started_at ON search_runs(started_at DESC);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE events IS 'Market events discovered through AI search';
COMMENT ON TABLE ai_prompts IS 'Prompt library for AI searches';
COMMENT ON TABLE search_runs IS 'History of all search executions (manual and scheduled)';

COMMENT ON COLUMN events.date IS 'Event occurrence date (YYYY-MM-DD)';
COMMENT ON COLUMN events.criticality IS 'Importance level (1-5, where 5 is critical)';
COMMENT ON COLUMN events.raw_data IS 'Full raw response from OpenAI API';

COMMENT ON COLUMN ai_prompts.prompt_template IS 'Template with {variable} placeholders for substitution';
COMMENT ON COLUMN ai_prompts.search_type IS 'Category of search (marketing, pricing, regulations, partnerships, auctions, general)';

COMMENT ON COLUMN search_runs.status IS 'Execution status: running | completed | failed';
COMMENT ON COLUMN search_runs.is_scheduled IS 'True if execution was triggered by a schedule, false if manual';

-- ============================================================================
-- MIGRATION STATUS
-- ============================================================================
-- ✅ Initial schema created
-- ✅ Indexes created for performance
-- ✅ Triggers created for updated_at
-- ⏳ Next: USER PROFILES TABLE (migration 002)
-- ⏳ Next: RLS POLICIES (migration 004)
