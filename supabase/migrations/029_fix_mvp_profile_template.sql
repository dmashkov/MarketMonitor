-- Migration 029: Fix MVP Test Profile prompt_template_id
-- Date: 2025-12-29
-- Purpose: Set prompt_template_id for existing monitoring profiles that have NULL

-- ============================================================================
-- 1. Update existing profiles with NULL prompt_template_id
-- ============================================================================

-- Update MVP Test Profile to use Daily Critical Events template
UPDATE public.monitoring_profiles
SET
  prompt_template_id = (
    SELECT id FROM public.prompt_templates
    WHERE name = 'Daily Critical Events' AND stage = 'hunt'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE prompt_template_id IS NULL;

-- Verify
SELECT
  name,
  prompt_template_id,
  (SELECT name FROM prompt_templates pt WHERE pt.id = monitoring_profiles.prompt_template_id) as template_name
FROM public.monitoring_profiles
ORDER BY priority DESC;
