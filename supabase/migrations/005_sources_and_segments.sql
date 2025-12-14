-- =====================================================
-- Migration 005: Sources, Segments, Geographies
-- Description: Расширенная система управления источниками и сегментами
-- Created: 2024-12-05
-- =====================================================

-- =====================================================
-- 1. SEGMENTS TABLE (Сегменты оборудования)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.segments IS 'Сегменты климатического оборудования (RAC, VRF, Chiller, AHU, и т.д.)';

-- =====================================================
-- 2. GEOGRAPHIES TABLE (Географические зоны)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.geographies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL, -- 'country', 'region', 'city'
  parent_id UUID REFERENCES public.geographies(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.geographies IS 'Географические зоны для таргетирования поиска';

-- =====================================================
-- 3. SOURCE_TYPES TABLE (Типы источников)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.source_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.source_types IS 'Типы источников: distributor, manufacturer, media, telegram, association';

-- =====================================================
-- 4. SOURCES TABLE (Источники для мониторинга)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  source_type_id UUID NOT NULL REFERENCES public.source_types(id) ON DELETE RESTRICT,
  website_url TEXT,
  telegram_channel VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 5, -- 1-10, где 10 = максимальный приоритет
  check_frequency VARCHAR(50) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
  last_checked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.sources IS 'Источники для мониторинга (дистрибьюторы, производители, СМИ, Telegram)';

-- =====================================================
-- 5. SOURCE_URLS TABLE (Конкретные URL для мониторинга)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.source_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_type VARCHAR(50) DEFAULT 'news', -- 'news', 'products', 'blog', 'press-release'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  check_frequency VARCHAR(50) DEFAULT 'daily',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, url)
);

COMMENT ON TABLE public.source_urls IS 'Конкретные URL адреса для мониторинга внутри источника';

-- =====================================================
-- 6. UPDATE EVENTS TABLE (Расширение таблицы событий)
-- =====================================================

-- Добавляем новые колонки к существующей таблице events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS criticality_level INT DEFAULT 3 CHECK (criticality_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS geography_id UUID REFERENCES public.geographies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.events.source_id IS 'Ссылка на источник, откуда получено событие';
COMMENT ON COLUMN public.events.source_url IS 'Прямая ссылка на источник информации';
COMMENT ON COLUMN public.events.criticality_level IS 'Уровень критичности: 1=низкая, 2=средняя, 3=обычная, 4=высокая, 5=критическая';
COMMENT ON COLUMN public.events.segment_id IS 'Сегмент оборудования (RAC, VRF, Chiller, и т.д.)';
COMMENT ON COLUMN public.events.geography_id IS 'География события';
COMMENT ON COLUMN public.events.detected_at IS 'Время обнаружения события AI системой';

-- =====================================================
-- 7. UPDATE AI_PROMPTS TABLE (Расширение промптов)
-- =====================================================

ALTER TABLE public.ai_prompts
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS geography_id UUID REFERENCES public.geographies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS search_depth VARCHAR(50) DEFAULT 'daily' CHECK (search_depth IN ('daily', 'weekly', 'monthly'));

COMMENT ON COLUMN public.ai_prompts.segment_id IS 'Специализация промпта на определенный сегмент';
COMMENT ON COLUMN public.ai_prompts.geography_id IS 'Географическая специализация промпта';
COMMENT ON COLUMN public.ai_prompts.search_depth IS 'Глубина исследования: daily (акции), weekly (события), monthly (тренды)';

-- =====================================================
-- 8. PROMPT_SEGMENTS TABLE (Many-to-Many для промптов и сегментов)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.prompt_segments (
  prompt_id UUID NOT NULL REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (prompt_id, segment_id)
);

COMMENT ON TABLE public.prompt_segments IS 'Связь промптов с несколькими сегментами (для комбинированных поисков)';

-- =====================================================
-- 9. INDEXES для производительности
-- =====================================================

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sources_type ON public.sources(source_type_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sources_active ON public.sources(is_active);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sources_frequency ON public.sources(check_frequency);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_source_urls_source ON public.source_urls(source_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_source_urls_active ON public.source_urls(is_active);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_events_source ON public.events(source_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_events_criticality ON public.events(criticality_level);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_events_segment ON public.events(segment_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_events_geography ON public.events(geography_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_events_detected_at ON public.events(detected_at);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prompts_segment ON public.ai_prompts(segment_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prompts_geography ON public.ai_prompts(geography_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prompts_depth ON public.ai_prompts(search_depth);

-- =====================================================
-- 10. UPDATE TRIGGERS
-- =====================================================

-- Trigger для updated_at в segments
CREATE OR REPLACE FUNCTION update_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_segments_updated_at ON public.segments;
CREATE TRIGGER trigger_segments_updated_at
  BEFORE UPDATE ON public.segments
  FOR EACH ROW
  EXECUTE FUNCTION update_segments_updated_at();

-- Trigger для updated_at в geographies
CREATE OR REPLACE FUNCTION update_geographies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_geographies_updated_at ON public.geographies;
CREATE TRIGGER trigger_geographies_updated_at
  BEFORE UPDATE ON public.geographies
  FOR EACH ROW
  EXECUTE FUNCTION update_geographies_updated_at();

-- Trigger для updated_at в sources
CREATE OR REPLACE FUNCTION update_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sources_updated_at ON public.sources;
CREATE TRIGGER trigger_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW
  EXECUTE FUNCTION update_sources_updated_at();

-- Trigger для updated_at в source_urls
CREATE OR REPLACE FUNCTION update_source_urls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_source_urls_updated_at ON public.source_urls;
CREATE TRIGGER trigger_source_urls_updated_at
  BEFORE UPDATE ON public.source_urls
  FOR EACH ROW
  EXECUTE FUNCTION update_source_urls_updated_at();

-- =====================================================
-- 11. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geographies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_segments ENABLE ROW LEVEL SECURITY;

-- Segments: все могут читать, админы могут редактировать
DROP POLICY IF EXISTS "Segments viewable by authenticated users" ON public.segments;
CREATE POLICY "Segments viewable by authenticated users" ON public.segments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Segments manageable by admins" ON public.segments;
CREATE POLICY "Segments manageable by admins" ON public.segments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Geographies: все могут читать, админы могут редактировать
DROP POLICY IF EXISTS "Geographies viewable by authenticated users" ON public.geographies;
CREATE POLICY "Geographies viewable by authenticated users" ON public.geographies
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Geographies manageable by admins" ON public.geographies;
CREATE POLICY "Geographies manageable by admins" ON public.geographies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Source Types: все могут читать
DROP POLICY IF EXISTS "Source types viewable by all" ON public.source_types;
CREATE POLICY "Source types viewable by all" ON public.source_types
  FOR SELECT USING (true);

-- Sources: все могут читать активные, админы могут редактировать
DROP POLICY IF EXISTS "Sources viewable by authenticated users" ON public.sources;
CREATE POLICY "Sources viewable by authenticated users" ON public.sources
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

DROP POLICY IF EXISTS "Sources manageable by admins" ON public.sources;
CREATE POLICY "Sources manageable by admins" ON public.sources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Source URLs: все могут читать активные, админы могут редактировать
DROP POLICY IF EXISTS "Source URLs viewable by authenticated users" ON public.source_urls;
CREATE POLICY "Source URLs viewable by authenticated users" ON public.source_urls
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

DROP POLICY IF EXISTS "Source URLs manageable by admins" ON public.source_urls;
CREATE POLICY "Source URLs manageable by admins" ON public.source_urls
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Prompt Segments: все могут читать, админы могут редактировать
DROP POLICY IF EXISTS "Prompt segments viewable by authenticated users" ON public.prompt_segments;
CREATE POLICY "Prompt segments viewable by authenticated users" ON public.prompt_segments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Prompt segments manageable by admins" ON public.prompt_segments;
CREATE POLICY "Prompt segments manageable by admins" ON public.prompt_segments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
