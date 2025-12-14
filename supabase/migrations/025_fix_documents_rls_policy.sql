-- Migration 025: Fix documents RLS Policy
-- Date: 2025-12-14
-- Purpose: Allow agents and REST API to access documents table

-- Fix documents table to allow anon/unauthenticated access
-- Documents are created and updated by agents, need to be readable

-- First check if documents table has RLS enabled and policies
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Documents viewable by authenticated" ON public.documents;
DROP POLICY IF EXISTS "Documents viewable by users" ON public.documents;
CREATE POLICY "Documents viewable by all"
  ON public.documents FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Documents creatable by authenticated" ON public.documents;
DROP POLICY IF EXISTS "Documents editable by authenticated" ON public.documents;
CREATE POLICY "Documents creatable"
  ON public.documents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Documents updatable"
  ON public.documents FOR UPDATE
  WITH CHECK (true);

-- Also fix search_runs_stages if it exists
ALTER TABLE IF EXISTS public.search_runs_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Search run stages viewable by authenticated" ON public.search_runs_stages;
CREATE POLICY "Search run stages viewable by all"
  ON public.search_runs_stages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Search run stages creatable by authenticated" ON public.search_runs_stages;
CREATE POLICY "Search run stages creatable"
  ON public.search_runs_stages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Search run stages updatable"
  ON public.search_runs_stages FOR UPDATE
  WITH CHECK (true);
