-- Migration 024: Fix search_runs RLS Policy
-- Date: 2025-12-14
-- Purpose: Allow unauthenticated access to read search_runs for monitoring

-- Fix search_runs RLS policy to allow anon access
DROP POLICY IF EXISTS "Users can view search runs" ON public.search_runs;
CREATE POLICY "Search runs viewable by all"
  ON public.search_runs FOR SELECT
  USING (true);

-- Allow insert/update
DROP POLICY IF EXISTS "Only admins can create search runs" ON public.search_runs;
CREATE POLICY "Search runs creatable"
  ON public.search_runs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can update search runs" ON public.search_runs;
CREATE POLICY "Search runs updatable"
  ON public.search_runs FOR UPDATE
  WITH CHECK (true);
