-- Migration 022: Fix RLS Policies for Reference Tables
-- Date: 2025-12-14
-- Purpose: Allow unauthenticated (anon) access to read reference data
--
-- Problem: Reference tables (event_types, segments, geographies, prompt_templates, monitoring_profiles)
-- had RLS policies that required authenticated role. This blocked REST API access without JWT token.
--
-- Solution: Change RLS policies to use USING (true) for SELECT, allowing all roles to read.

-- ============================================================================
-- 1. Fix event_types
-- ============================================================================

DROP POLICY IF EXISTS "Event types viewable by authenticated" ON public.event_types;
CREATE POLICY "Event types viewable by all"
  ON public.event_types FOR SELECT
  USING (true);

-- ============================================================================
-- 2. Fix segments
-- ============================================================================

DROP POLICY IF EXISTS "Segments viewable by authenticated users" ON public.segments;
CREATE POLICY "Segments viewable by all" ON public.segments
  FOR SELECT USING (true);

-- ============================================================================
-- 3. Fix geographies
-- ============================================================================

DROP POLICY IF EXISTS "Geographies viewable by authenticated users" ON public.geographies;
CREATE POLICY "Geographies viewable by all" ON public.geographies
  FOR SELECT USING (true);

-- ============================================================================
-- 4. Fix prompt_templates
-- ============================================================================

DROP POLICY IF EXISTS "Prompt templates viewable by authenticated" ON public.prompt_templates;
CREATE POLICY "Prompt templates viewable by all"
  ON public.prompt_templates FOR SELECT
  USING (true);

-- ============================================================================
-- 5. Fix monitoring_profiles
-- ============================================================================

DROP POLICY IF EXISTS "Monitoring profiles viewable by authenticated" ON public.monitoring_profiles;
CREATE POLICY "Monitoring profiles viewable by all"
  ON public.monitoring_profiles FOR SELECT
  USING (true);

-- ============================================================================
-- 6. Fix sources
-- ============================================================================

DROP POLICY IF EXISTS "Sources viewable by authenticated users" ON public.sources;
CREATE POLICY "Sources viewable by all" ON public.sources
  FOR SELECT USING (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- These policies allow agents and frontend to read reference data without authentication
-- Admins still retain edit/delete capabilities via separate policies
