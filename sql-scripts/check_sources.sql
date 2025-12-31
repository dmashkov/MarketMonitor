-- Check sources and source_types data

-- 1. Count total sources
SELECT COUNT(*) as total_sources FROM sources;

-- 2. Count active sources
SELECT COUNT(*) as active_sources FROM sources WHERE is_active = true;

-- 3. Check source_types priorities
SELECT code, priority, COUNT(*) as sources_count
FROM source_types st
LEFT JOIN sources s ON s.source_type_id = st.id
GROUP BY st.code, st.priority
ORDER BY st.priority DESC;

-- 4. Count sources by priority
SELECT
  st.priority,
  COUNT(s.id) as sources_count,
  COUNT(s.id) FILTER (WHERE s.is_active = true) as active_count
FROM source_types st
LEFT JOIN sources s ON s.source_type_id = st.id
GROUP BY st.priority
ORDER BY st.priority DESC;

-- 5. Show high-priority sources (priority >= 5)
SELECT
  s.name,
  s.website_url,
  st.code as source_type,
  st.priority,
  s.is_active
FROM sources s
JOIN source_types st ON s.source_type_id = st.id
WHERE st.priority >= 5
ORDER BY st.priority DESC, s.name
LIMIT 20;
