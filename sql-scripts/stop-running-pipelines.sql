-- ============================================================================
-- STOP RUNNING PIPELINES & CLEANUP
-- ============================================================================
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Остановить все запущенные search_runs
UPDATE search_runs
SET
  status = 'failed',
  completed_at = NOW(),
  error_message = 'Stopped manually - switching to Perplexity version'
WHERE status = 'running';

-- 2. Удалить все фейковые документы (опять!)
DELETE FROM documents
WHERE file_url ~ '/news/\d{13}';

-- 3. Удалить связанные search_runs_stages для failed runs
DELETE FROM search_runs_stages
WHERE search_run_id IN (
  SELECT id FROM search_runs
  WHERE status = 'failed'
  AND error_message LIKE '%Stopped manually%'
);

-- 4. Опционально: удалить stopped search_runs полностью
-- DELETE FROM search_runs
-- WHERE status = 'failed'
-- AND error_message LIKE '%Stopped manually%';

-- 5. Проверить результат
SELECT
  'Running pipelines' as check_type,
  COUNT(*) as count
FROM search_runs
WHERE status = 'running'

UNION ALL

SELECT
  'Fake documents' as check_type,
  COUNT(*) as count
FROM documents
WHERE file_url ~ '/news/\d{13}';

-- Должно вернуть: 0 running pipelines, 0 fake documents
