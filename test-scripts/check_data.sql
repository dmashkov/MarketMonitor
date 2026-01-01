-- Check what data exists in database

-- =====================================================
-- Check monitoring_profiles
-- =====================================================

SELECT COUNT(*) as monitoring_profiles_count
FROM monitoring_profiles;

SELECT id, name, created_at
FROM monitoring_profiles
ORDER BY created_at
LIMIT 5;

-- =====================================================
-- Check segments
-- =====================================================

SELECT COUNT(*) as segments_count
FROM segments
WHERE is_active = true;

SELECT id, name, code, is_active
FROM segments
ORDER BY name
LIMIT 10;

-- =====================================================
-- Check sources
-- =====================================================

SELECT COUNT(*) as sources_count
FROM sources
WHERE is_active = true;

SELECT id, name, is_active
FROM sources
ORDER BY name
LIMIT 10;

-- =====================================================
-- Check prompt_templates
-- =====================================================

SELECT COUNT(*) as prompt_templates_count
FROM prompt_templates;

SELECT id, name, stage
FROM prompt_templates
LIMIT 5;
