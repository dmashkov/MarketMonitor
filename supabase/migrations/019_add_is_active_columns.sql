-- Migration 019: Add is_active columns to segments and geographies
-- Date: 2025-12-14
-- Purpose: Fix missing is_active columns that should have been in Migration 005
-- Note: Migration 005 was updated but this ensures idempotent migration path

-- ============================================================================
-- ADD is_active TO SEGMENTS (if not exists)
-- ============================================================================

ALTER TABLE IF EXISTS public.segments
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_segments_active ON public.segments(is_active);

-- ============================================================================
-- ADD is_active TO GEOGRAPHIES (if not exists)
-- ============================================================================

ALTER TABLE IF EXISTS public.geographies
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_geographies_active ON public.geographies(is_active);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
