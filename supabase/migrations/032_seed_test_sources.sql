-- Migration 032: Seed test sources for MVP testing
-- Date: 2025-12-29
-- Purpose: Add high-priority test sources if none exist

-- ============================================================================
-- 1. CHECK CURRENT STATE
-- ============================================================================

DO $$
DECLARE
  high_priority_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO high_priority_count
  FROM sources s
  JOIN source_types st ON s.source_type_id = st.id
  WHERE st.priority >= 5 AND s.is_active = true;

  RAISE NOTICE 'Current high-priority sources count: %', high_priority_count;
END $$;

-- ============================================================================
-- 2. ENSURE SOURCE_TYPES EXIST WITH PRIORITIES
-- ============================================================================

-- Check and show current source_types
DO $$
DECLARE
  types_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO types_count FROM source_types;
  RAISE NOTICE 'Current source_types count: %', types_count;
END $$;

-- Update existing source_types priorities (codes are UPPERCASE!)
UPDATE source_types SET priority = 5 WHERE UPPER(code) IN ('DISTRIBUTOR', 'MANUFACTURER', 'GOVERNMENT', 'TENDER_PLATFORM');
UPDATE source_types SET priority = 3 WHERE UPPER(code) IN ('ASSOCIATION');
UPDATE source_types SET priority = 2 WHERE UPPER(code) IN ('BUSINESS_MEDIA', 'ANALYTICS', 'INDUSTRY_PORTAL', 'TELEGRAM');

-- Show current source_types with their codes
DO $$
DECLARE
  type_record RECORD;
BEGIN
  RAISE NOTICE 'Source types priorities updated';
  RAISE NOTICE '=== Current source_types in DB ===';
  FOR type_record IN
    SELECT code, name, priority FROM source_types ORDER BY priority DESC NULLS LAST
  LOOP
    RAISE NOTICE 'Code: %, Name: %, Priority: %', type_record.code, type_record.name, type_record.priority;
  END LOOP;
END $$;

-- ============================================================================
-- 3. SEED TEST SOURCES (only if none exist)
-- ============================================================================

-- Insert test distributors (priority = 5) - use UPPERCASE codes!
INSERT INTO sources (name, source_type_id, website_url, description, priority, is_active)
SELECT
  'Тестовый дистрибьютор 1',
  (SELECT id FROM source_types WHERE UPPER(code) = 'DISTRIBUTOR' LIMIT 1),
  'https://test-distributor-1.example.com',
  'Тестовый источник для отладки pipeline',
  5,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE website_url = 'https://test-distributor-1.example.com'
);

INSERT INTO sources (name, source_type_id, website_url, description, priority, is_active)
SELECT
  'Тестовый производитель 1',
  (SELECT id FROM source_types WHERE UPPER(code) = 'MANUFACTURER' LIMIT 1),
  'https://test-manufacturer-1.example.com',
  'Тестовый источник для отладки pipeline',
  5,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE website_url = 'https://test-manufacturer-1.example.com'
);

INSERT INTO sources (name, source_type_id, website_url, description, priority, is_active)
SELECT
  'Тестовый портал',
  (SELECT id FROM source_types WHERE UPPER(code) = 'INDUSTRY_PORTAL' LIMIT 1),
  'https://test-portal.example.com',
  'Тестовый источник для отладки pipeline',
  5,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE website_url = 'https://test-portal.example.com'
);

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  final_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count
  FROM sources s
  JOIN source_types st ON s.source_type_id = st.id
  WHERE st.priority >= 5 AND s.is_active = true;

  IF final_count = 0 THEN
    RAISE EXCEPTION 'FAILED: No high-priority sources after seed! Check source_types table.';
  ELSE
    RAISE NOTICE '✅ SUCCESS: % high-priority sources available', final_count;
  END IF;
END $$;

-- Show final state
SELECT
  s.name,
  st.code as type,
  st.priority,
  s.is_active,
  s.website_url
FROM sources s
JOIN source_types st ON s.source_type_id = st.id
WHERE st.priority >= 5
ORDER BY st.priority DESC, s.name;
