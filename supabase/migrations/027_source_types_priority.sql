-- ============================================================================
-- Migration 027: Add priority to source_types
-- Date: 2025-12-16
-- Purpose: Enable source prioritization for focused search
-- Architecture: Scope-Aware + Segment-Aware Query Generation
-- ============================================================================

-- Add priority column to source_types
ALTER TABLE public.source_types
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 3;

-- Add comment explaining priority levels
COMMENT ON COLUMN public.source_types.priority IS
'Source priority for search filtering:
5 = CRITICAL (distributors, manufacturers, government, tenders) - Daily monitoring
3 = MEDIUM (associations) - Weekly monitoring
2 = LOW (business media, analytics) - Monthly monitoring';

-- Seed priorities based on business requirements
-- HIGH PRIORITY (5): Critical sources for daily monitoring
UPDATE public.source_types
SET priority = 5
WHERE code IN (
  'distributor',      -- Дистрибьюторы (промо-акции, новые продукты)
  'manufacturer',     -- Производители (анонсы, производства в РФ)
  'government',       -- Госорганы (регуляция, "Честный знак")
  'tender_platform'   -- Тендеры (VRF, промышленное оборудование)
);

-- MEDIUM PRIORITY (3): Associations
UPDATE public.source_types
SET priority = 3
WHERE code IN (
  'association'       -- Профессиональные ассоциации (АПИК, НП АВОК)
);

-- LOW PRIORITY (2): Analytics and media
UPDATE public.source_types
SET priority = 2
WHERE code IN (
  'business_media',   -- Бизнес-издания (Коммерсант, РБК, Forbes)
  'analytics'         -- Аналитические агентства
);

-- Create index for efficient priority filtering
CREATE INDEX IF NOT EXISTS idx_source_types_priority
ON public.source_types(priority DESC);

-- Verification query (commented out, run manually if needed)
-- SELECT code, priority
-- FROM public.source_types
-- ORDER BY priority DESC, code;

-- ============================================================================
-- Migration Complete
-- ============================================================================
