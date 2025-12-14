-- Migration 017: Phase 4 Pipeline Schema
-- Date: 2025-12-14
-- Purpose: Create all tables needed for multi-agent sequential pipeline

-- ============================================================================
-- 1. EVENT_TYPES TABLE (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.event_types IS 'Типы событий: promo_discount, price_change, payment_terms, assortment_launch, distribution_change, tender_project, pr_media, regulatory, logistics_supply';
COMMENT ON COLUMN public.event_types.code IS 'Machine-readable code (promo_discount, price_change, etc.)';
COMMENT ON COLUMN public.event_types.name IS 'Human-readable name (Скидка/Акция, Изменение цены, etc.)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_types_code ON public.event_types(code);
CREATE INDEX IF NOT EXISTS idx_event_types_active ON public.event_types(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_event_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_event_types_updated_at ON public.event_types;
CREATE TRIGGER trigger_event_types_updated_at
  BEFORE UPDATE ON public.event_types
  FOR EACH ROW
  EXECUTE FUNCTION update_event_types_updated_at();

-- RLS
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event types viewable by authenticated" ON public.event_types;
CREATE POLICY "Event types viewable by authenticated"
  ON public.event_types FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Event types manageable by admins" ON public.event_types;
CREATE POLICY "Event types manageable by admins"
  ON public.event_types
  FOR ALL
  USING (EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 2. DOCUMENTS TABLE (UPDATE EXISTING)
-- ============================================================================

-- Drop ARRAY columns if they exist
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS brand_ids;
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS segment_ids;
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS geography_ids;
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS event_type_ids;

-- Remove content_html (we only use content_text)
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS content_html;

-- Add new columns if they don't exist
ALTER TABLE IF EXISTS public.documents ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.documents ADD COLUMN IF NOT EXISTS criticality_level INT CHECK (criticality_level BETWEEN 1 AND 5);
ALTER TABLE IF EXISTS public.documents ADD COLUMN IF NOT EXISTS search_run_id UUID REFERENCES public.search_runs(id) ON DELETE SET NULL;

-- Create index for is_duplicate
CREATE INDEX IF NOT EXISTS idx_documents_is_duplicate ON public.documents(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_documents_criticality ON public.documents(criticality_level);
CREATE INDEX IF NOT EXISTS idx_documents_search_run ON public.documents(search_run_id);

-- Vector similarity index for semantic search
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON public.documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search for Russian content
ALTER TABLE IF EXISTS public.documents ADD COLUMN IF NOT EXISTS content_tsvector tsvector;
CREATE INDEX IF NOT EXISTS idx_documents_content_fts ON public.documents USING gin(content_tsvector);

-- Trigger to update full-text search
CREATE OR REPLACE FUNCTION update_documents_fts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsvector := to_tsvector('russian', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_fts ON public.documents;
CREATE TRIGGER trigger_documents_fts
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_fts();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- ============================================================================
-- 3-6. LINKING TABLES (NEW)
-- ============================================================================

-- document_brands
CREATE TABLE IF NOT EXISTS public.document_brands (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  PRIMARY KEY (document_id, brand_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_brands_brand ON public.document_brands(brand_id);
CREATE INDEX IF NOT EXISTS idx_document_brands_document ON public.document_brands(document_id);

ALTER TABLE public.document_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Document brands viewable by authenticated" ON public.document_brands;
CREATE POLICY "Document brands viewable by authenticated"
  ON public.document_brands FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

-- document_segments
CREATE TABLE IF NOT EXISTS public.document_segments (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE RESTRICT,
  PRIMARY KEY (document_id, segment_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_segments_segment ON public.document_segments(segment_id);
CREATE INDEX IF NOT EXISTS idx_document_segments_document ON public.document_segments(document_id);

ALTER TABLE public.document_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Document segments viewable by authenticated" ON public.document_segments;
CREATE POLICY "Document segments viewable by authenticated"
  ON public.document_segments FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

-- document_geographies
CREATE TABLE IF NOT EXISTS public.document_geographies (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  geography_id UUID NOT NULL REFERENCES public.geographies(id) ON DELETE RESTRICT,
  PRIMARY KEY (document_id, geography_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_geographies_geography ON public.document_geographies(geography_id);
CREATE INDEX IF NOT EXISTS idx_document_geographies_document ON public.document_geographies(document_id);

ALTER TABLE public.document_geographies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Document geographies viewable by authenticated" ON public.document_geographies;
CREATE POLICY "Document geographies viewable by authenticated"
  ON public.document_geographies FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

-- document_event_types
CREATE TABLE IF NOT EXISTS public.document_event_types (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (document_id, event_type_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_event_types_event_type ON public.document_event_types(event_type_id);
CREATE INDEX IF NOT EXISTS idx_document_event_types_document ON public.document_event_types(document_id);

ALTER TABLE public.document_event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Document event types viewable by authenticated" ON public.document_event_types;
CREATE POLICY "Document event types viewable by authenticated"
  ON public.document_event_types FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

-- ============================================================================
-- 7. PROMPT_TEMPLATES TABLE (NEW) - MUST BE BEFORE monitoring_profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  name VARCHAR(255) NOT NULL,
  stage VARCHAR(50) NOT NULL,

  -- Template with placeholders
  template_text TEXT NOT NULL,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_stage ON public.prompt_templates(stage);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON public.prompt_templates(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_prompt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prompt_templates_updated_at ON public.prompt_templates;
CREATE TRIGGER trigger_prompt_templates_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_templates_updated_at();

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prompt templates viewable by authenticated" ON public.prompt_templates;
CREATE POLICY "Prompt templates viewable by authenticated"
  ON public.prompt_templates FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Prompt templates manageable by admins" ON public.prompt_templates;
CREATE POLICY "Prompt templates manageable by admins"
  ON public.prompt_templates FOR ALL
  USING (EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 8. MONITORING_PROFILES TABLE (NEW) - AFTER prompt_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.monitoring_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- SCOPE: what to monitor
  segment_ids UUID[] DEFAULT '{}',
  brand_ids UUID[] DEFAULT '{}',
  geography_ids UUID[] DEFAULT '{}',
  event_type_ids UUID[] DEFAULT '{}',

  -- EXECUTION: how to run
  priority INT CHECK (priority BETWEEN 1 AND 5) DEFAULT 5,
  max_sources_per_run INT DEFAULT 20,

  -- QUALITY GATES: what to accept
  dedupe_threshold FLOAT CHECK (dedupe_threshold BETWEEN 0.0 AND 1.0) DEFAULT 0.85,

  -- PROMPTS: which template to use
  prompt_template_id UUID REFERENCES public.prompt_templates(id) ON DELETE SET NULL,

  -- SCHEDULING: when to run (Phase 5)
  schedule_cron VARCHAR(100),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_profiles_active ON public.monitoring_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_monitoring_profiles_created_by ON public.monitoring_profiles(created_by);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_monitoring_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_monitoring_profiles_updated_at ON public.monitoring_profiles;
CREATE TRIGGER trigger_monitoring_profiles_updated_at
  BEFORE UPDATE ON public.monitoring_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_monitoring_profiles_updated_at();

ALTER TABLE public.monitoring_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Monitoring profiles viewable by authenticated" ON public.monitoring_profiles;
CREATE POLICY "Monitoring profiles viewable by authenticated"
  ON public.monitoring_profiles FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Monitoring profiles manageable by admins" ON public.monitoring_profiles;
CREATE POLICY "Monitoring profiles manageable by admins"
  ON public.monitoring_profiles FOR ALL
  USING (EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- 9. SEARCH_RUNS TABLE (UPDATE EXISTING) - NOW monitoring_profiles exists
-- ============================================================================

ALTER TABLE IF EXISTS public.search_runs ADD COLUMN IF NOT EXISTS monitoring_profile_id UUID REFERENCES public.monitoring_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_search_runs_profile ON public.search_runs(monitoring_profile_id);

-- ============================================================================
-- 10. SEARCH_RUNS_STAGES TABLE (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.search_runs_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  search_run_id UUID NOT NULL REFERENCES public.search_runs(id) ON DELETE CASCADE,

  -- Stage tracking
  stage_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,

  -- Metrics
  documents_processed INT DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Error
  error_message TEXT,

  -- Optional metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_search_runs_stages_run ON public.search_runs_stages(search_run_id);
CREATE INDEX IF NOT EXISTS idx_search_runs_stages_stage ON public.search_runs_stages(stage_name);
CREATE INDEX IF NOT EXISTS idx_search_runs_stages_status ON public.search_runs_stages(status);

ALTER TABLE public.search_runs_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Search run stages viewable by authenticated" ON public.search_runs_stages;
CREATE POLICY "Search run stages viewable by authenticated"
  ON public.search_runs_stages FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

-- ============================================================================
-- 11. SEARCH_RUNS_PROMPTS TABLE (NEW)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.search_runs_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  search_run_id UUID NOT NULL REFERENCES public.search_runs(id) ON DELETE CASCADE,

  -- Template and version
  prompt_template_id UUID REFERENCES public.prompt_templates(id) ON DELETE SET NULL,
  stage_name VARCHAR(100) NOT NULL,

  -- The actual prompt sent to LLM (for audit and A/B testing)
  actual_prompt_text TEXT NOT NULL,

  -- Optional: parameters used
  prompt_parameters JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_runs_prompts_run ON public.search_runs_prompts(search_run_id);
CREATE INDEX IF NOT EXISTS idx_search_runs_prompts_template ON public.search_runs_prompts(prompt_template_id);

ALTER TABLE public.search_runs_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Search run prompts viewable by authenticated" ON public.search_runs_prompts;
CREATE POLICY "Search run prompts viewable by authenticated"
  ON public.search_runs_prompts FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

-- ============================================================================
-- 10. EVENTS TABLE (UPDATE EXISTING)
-- ============================================================================

ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'ai_search',
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_document ON public.events(document_id);
CREATE INDEX IF NOT EXISTS idx_events_source_type ON public.events(source_type);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
