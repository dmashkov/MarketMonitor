-- Migration 033: Ensure segments exist
-- Date: 2025-12-29
-- Purpose: Guarantee that all required segments exist and are active

-- ============================================================================
-- 1. CHECK CURRENT STATE
-- ============================================================================

DO $$
DECLARE
  segment_count INTEGER;
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO segment_count FROM segments;
  SELECT COUNT(*) INTO active_count FROM segments WHERE is_active = true;

  RAISE NOTICE 'Current segments: % total, % active', segment_count, active_count;
END $$;

-- ============================================================================
-- 2. INSERT SEGMENTS (idempotent - uses ON CONFLICT)
-- ============================================================================

INSERT INTO public.segments (name, code, description, is_active) VALUES
  ('RAC (Room Air Conditioner)', 'RAC', 'Бытовые кондиционеры и сплит-системы', true),
  ('VRF (Variable Refrigerant Flow)', 'VRF', 'Мультизональные системы кондиционирования', true),
  ('Chiller', 'CHILLER', 'Чиллеры и системы центрального кондиционирования', true),
  ('AHU (Air Handling Unit)', 'AHU', 'Приточно-вытяжные установки', true),
  ('Промышленное тепловое оборудование', 'INDUSTRIAL_HEAT', 'Промышленные системы отопления и вентиляции', true),
  ('Тепловые насосы', 'HEAT_PUMP', 'Тепловые насосы для отопления и ГВС', true),
  ('Вентиляция', 'VENTILATION', 'Вентиляционное оборудование', true),
  ('Холодильное оборудование', 'REFRIGERATION', 'Промышленное и коммерческое холодильное оборудование', true)
ON CONFLICT (code)
DO UPDATE SET
  is_active = true,  -- Ensure all segments are ACTIVE
  description = EXCLUDED.description,
  name = EXCLUDED.name;

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  final_count INTEGER;
  active_final INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count FROM segments;
  SELECT COUNT(*) INTO active_final FROM segments WHERE is_active = true;

  IF active_final = 0 THEN
    RAISE EXCEPTION 'FAILED: No active segments after migration!';
  ELSE
    RAISE NOTICE '✅ SUCCESS: % segments total, % active', final_count, active_final;
  END IF;
END $$;

-- Show all segments
SELECT code, name, is_active
FROM segments
ORDER BY code;
