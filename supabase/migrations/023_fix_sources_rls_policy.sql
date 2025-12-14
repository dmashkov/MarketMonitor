-- Migration 023: Fix Sources RLS Policy
-- Date: 2025-12-14
-- Purpose: Allow unauthenticated access to sources table (was missed in migration 022)

-- Fix sources RLS policy to allow anon access
DROP POLICY IF EXISTS "Sources viewable by authenticated users" ON public.sources;
CREATE POLICY "Sources viewable by all" ON public.sources
  FOR SELECT USING (true);
