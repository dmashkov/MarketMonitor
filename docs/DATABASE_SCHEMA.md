# 🗄️ PHASE 4: DATABASE SCHEMA SPECIFICATION

**Version:** 1.0.0
**Date:** 2025-12-14
**Status:** Complete Design ✅

---

## 📋 TABLE CREATION ORDER

```
1. event_types (справочник, нет зависимостей)
2. documents (UPDATE existing or CREATE new)
3. document_brands (FK → brands + documents)
4. document_segments (FK → segments + documents)
5. document_geographies (FK → geographies + documents)
6. document_event_types (FK → event_types + documents)
7. search_runs (UPDATE existing)
8. search_runs_stages (new, FK → search_runs)
9. search_runs_prompts (new, FK → search_runs)
10. monitoring_profiles (new, FK → prompt_templates)
11. prompt_templates (new if doesn't exist)
```

---

## 📊 DETAILED TABLE SCHEMAS

### 1. EVENT_TYPES (NEW)

```sql
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

-- Comments
COMMENT ON TABLE public.event_types IS 'Типы событий: promo_discount, price_change, payment_terms, assortment_launch, distribution_change, tender_project, pr_media, regulatory, logistics_supply';
COMMENT ON COLUMN public.event_types.code IS 'Machine-readable code (promo_discount, price_change, etc.)';
COMMENT ON COLUMN public.event_types.name IS 'Human-readable name (Скидка/Акция, Изменение цены, etc.)';

-- Indexes
CREATE INDEX idx_event_types_code ON public.event_types(code);
CREATE INDEX idx_event_types_active ON public.event_types(is_active);

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
```

---

### 2. DOCUMENTS (UPDATED)

```sql
-- If migration 009 already created documents, we UPDATE it
-- If not, we CREATE it

ALTER TABLE IF EXISTS public.documents ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;

-- Remove ARRAY columns (they don't exist if using many-to-many)
-- If they exist, drop them:
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS brand_ids;
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS segment_ids;
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS geography_ids;
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS event_type_ids;

-- Ensure content_html does NOT exist (only content_text)
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS content_html;

-- Final schema for documents:
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) DEFAULT 'webpage', -- 'pdf', 'docx', 'pptx', 'html', 'webpage'

  -- Text content ONLY (no HTML)
  content_text TEXT,

  -- URLs and references
  file_url TEXT,
  file_size INT,
  source_url TEXT,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  source_type VARCHAR(50) DEFAULT 'source_hunter', -- 'source_hunter', 'ai_search', 'manual_upload'

  -- Dates
  published_date TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  -- Vector embeddings (pgvector)
  embedding vector(1536),

  -- Quality and status
  criticality_level INT CHECK (criticality_level BETWEEN 1 AND 5),
  is_duplicate BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,

  -- Pipeline tracking
  search_run_id UUID REFERENCES public.search_runs(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON public.documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_source_id ON public.documents(source_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_duplicate ON public.documents(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_documents_criticality ON public.documents(criticality_level);
CREATE INDEX IF NOT EXISTS idx_documents_search_run ON public.documents(search_run_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at);

-- Vector similarity index for semantic search
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON public.documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search index on Russian content
ALTER TABLE IF EXISTS public.documents DROP COLUMN IF EXISTS content_tsvector;
ALTER TABLE IF EXISTS public.documents ADD COLUMN content_tsvector tsvector;

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

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Documents viewable by authenticated" ON public.documents;
CREATE POLICY "Documents viewable by authenticated"
  ON public.documents FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Documents manageable by admins" ON public.documents;
CREATE POLICY "Documents manageable by admins"
  ON public.documents
  FOR ALL
  USING (EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

### 3-6. LINKING TABLES (NEW)

```sql
-- document_brands
CREATE TABLE IF NOT EXISTS public.document_brands (
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  PRIMARY KEY (document_id, brand_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_brands_brand ON public.document_brands(brand_id);
CREATE INDEX idx_document_brands_document ON public.document_brands(document_id);

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

CREATE INDEX idx_document_segments_segment ON public.document_segments(segment_id);
CREATE INDEX idx_document_segments_document ON public.document_segments(document_id);

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

CREATE INDEX idx_document_geographies_geography ON public.document_geographies(geography_id);
CREATE INDEX idx_document_geographies_document ON public.document_geographies(document_id);

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

CREATE INDEX idx_document_event_types_event_type ON public.document_event_types(event_type_id);
CREATE INDEX idx_document_event_types_document ON public.document_event_types(document_id);

ALTER TABLE public.document_event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Document event types viewable by authenticated" ON public.document_event_types;
CREATE POLICY "Document event types viewable by authenticated"
  ON public.document_event_types FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');
```

---

### 7. SEARCH_RUNS (UPDATED)

```sql
-- UPDATE existing search_runs table or CREATE new one
CREATE TABLE IF NOT EXISTS public.search_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Type and configuration
  type VARCHAR(50) DEFAULT 'source_hunter', -- 'ai_search', 'source_hunter'
  monitoring_profile_id UUID REFERENCES public.monitoring_profiles(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'

  -- Results
  documents_created INT DEFAULT 0,
  events_created INT DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  execution_time_ms INT,

  -- Error handling
  error_message TEXT,

  -- Audit
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_runs_status ON public.search_runs(status);
CREATE INDEX idx_search_runs_type ON public.search_runs(type);
CREATE INDEX idx_search_runs_profile ON public.search_runs(monitoring_profile_id);
CREATE INDEX idx_search_runs_created_by ON public.search_runs(created_by);
CREATE INDEX idx_search_runs_created_at ON public.search_runs(created_at);

ALTER TABLE public.search_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Search runs viewable by authenticated" ON public.search_runs;
CREATE POLICY "Search runs viewable by authenticated"
  ON public.search_runs FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Search runs manageable by admins" ON public.search_runs;
CREATE POLICY "Search runs manageable by admins"
  ON public.search_runs FOR ALL
  USING (EXISTS(SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

### 8. SEARCH_RUNS_STAGES (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.search_runs_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  search_run_id UUID NOT NULL REFERENCES public.search_runs(id) ON DELETE CASCADE,

  -- Stage tracking
  stage_name VARCHAR(100) NOT NULL, -- 'source_hunter', 'content_fetcher', 'document_processor', 'dedup', 'criticality_scorer', 'event_extractor'
  status VARCHAR(50) NOT NULL, -- 'success', 'failed'

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

CREATE INDEX idx_search_runs_stages_run ON public.search_runs_stages(search_run_id);
CREATE INDEX idx_search_runs_stages_stage ON public.search_runs_stages(stage_name);
CREATE INDEX idx_search_runs_stages_status ON public.search_runs_stages(status);

ALTER TABLE public.search_runs_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Search run stages viewable by authenticated" ON public.search_runs_stages;
CREATE POLICY "Search run stages viewable by authenticated"
  ON public.search_runs_stages FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');
```

---

### 9. SEARCH_RUNS_PROMPTS (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.search_runs_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  search_run_id UUID NOT NULL REFERENCES public.search_runs(id) ON DELETE CASCADE,

  -- Template and version
  prompt_template_id UUID REFERENCES public.prompt_templates(id) ON DELETE SET NULL,
  stage_name VARCHAR(100) NOT NULL, -- 'search', 'classify', 'score'

  -- The actual prompt sent to LLM (for audit and A/B testing)
  actual_prompt_text TEXT NOT NULL,

  -- Optional: parameters used
  prompt_parameters JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_runs_prompts_run ON public.search_runs_prompts(search_run_id);
CREATE INDEX idx_search_runs_prompts_template ON public.search_runs_prompts(prompt_template_id);

ALTER TABLE public.search_runs_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Search run prompts viewable by authenticated" ON public.search_runs_prompts;
CREATE POLICY "Search run prompts viewable by authenticated"
  ON public.search_runs_prompts FOR SELECT
  TO authenticated USING (auth.role() = 'authenticated');
```

---

### 10. MONITORING_PROFILES (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.monitoring_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  -- SCOPE: what to monitor
  -- Using ARRAY of UUIDs for simplicity
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
  schedule_cron VARCHAR(100), -- NULL for MVP

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_monitoring_profiles_active ON public.monitoring_profiles(is_active);
CREATE INDEX idx_monitoring_profiles_created_by ON public.monitoring_profiles(created_by);

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
```

---

### 11. PROMPT_TEMPLATES (NEW or CREATE)

```sql
-- Check if ai_prompts exists and rename it, or create new
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  name VARCHAR(255) NOT NULL,
  stage VARCHAR(50) NOT NULL, -- 'search', 'classify', 'score', 'extract'

  -- Template with placeholders
  template_text TEXT NOT NULL,
  -- Example: "Analyze {segment} market. Classify event_types from: {event_types}"

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_prompt_templates_stage ON public.prompt_templates(stage);
CREATE INDEX idx_prompt_templates_active ON public.prompt_templates(is_active);

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
```

---

### 12. EVENTS (UPDATED)

```sql
-- Add new columns to existing events table
ALTER TABLE IF EXISTS public.events
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'ai_search', -- 'ai_search', 'source_hunter'
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_document ON public.events(document_id);
CREATE INDEX IF NOT EXISTS idx_events_source_type ON public.events(source_type);
```

---

## 📊 RELATIONSHIPS DIAGRAM

```
prompt_templates
    ↓
monitoring_profiles
    ↓
search_runs ← ← ← documents (via search_run_id)
    ↓         ↓
search_runs_stages  document_brands → brands
    ↓         ↓
search_runs_prompts  document_segments → segments
          ↓
          document_geographies → geographies
          ↓
          document_event_types → event_types
          ↓
          events (via document_id)
```

---

## ✅ INDEXING STRATEGY

**For Performance:**
- FTS index on documents (Russian language)
- Vector index on embeddings (ivfflat)
- B-tree indexes on foreign keys and frequently filtered columns
- Compound indexes on (document_id + relation_id) for many-to-many

**For Query Optimization:**
```sql
-- Example query: Find all documents about "RAC Promo" with high criticality
SELECT d.id, d.title, d.content_text, d.criticality_level
FROM documents d
JOIN document_segments ds ON d.id = ds.document_id
JOIN document_event_types det ON d.id = det.document_id
WHERE ds.segment_id = 'rac-uuid'
  AND det.event_type_id = 'promo-uuid'
  AND d.criticality_level >= 4
  AND d.is_duplicate = FALSE
ORDER BY d.criticality_level DESC, d.created_at DESC;
```

---

## 🔐 RLS POLICIES SUMMARY

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| documents | Authenticated | Admin | Admin | Admin |
| event_types | Authenticated | Admin | Admin | Admin |
| search_runs | Authenticated | Admin | Admin | Admin |
| monitoring_profiles | Authenticated | Admin | Admin | Admin |
| prompt_templates | Authenticated | Admin | Admin | Admin |

All linking tables (document_*) follow same pattern as documents.

---

## 📝 MIGRATION FILE

Full migration will be in: `supabase/migrations/017_phase_4_pipeline.sql`

This will include all CREATE/ALTER TABLE statements in proper dependency order.

