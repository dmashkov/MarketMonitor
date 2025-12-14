/**
 * usePipelineRunner Hook
 *
 * React Query hook for running the search orchestrator pipeline
 * Handles API calls to start pipeline execution and track progress
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';

export interface PipelineRunRequest {
  monitoring_profile_id: string;
}

export interface PipelineRunResponse {
  status: 'running' | 'completed' | 'failed';
  search_run_id: string;
  documents_created?: number;
  events_created?: number;
  duration_seconds?: number;
  error?: string;
  message?: string;
}

/**
 * Start pipeline execution
 */
export function usePipelineRunner() {
  return useMutation({
    mutationFn: async (request: PipelineRunRequest): Promise<PipelineRunResponse> => {
      const { data, error } = await supabase.functions.invoke('search-orchestrator', {
        body: request,
      });

      if (error) {
        throw new Error(error.message || 'Failed to start pipeline');
      }

      return data as PipelineRunResponse;
    },
  });
}

/**
 * Fetch search run history
 */
export function useSearchRunHistory() {
  return useQuery({
    queryKey: ['search-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(error.message || 'Failed to fetch search runs');
      }

      return data;
    },
  });
}

/**
 * Fetch search run stages for a specific run
 */
export function useSearchRunStages(searchRunId: string) {
  return useQuery({
    queryKey: ['search-run-stages', searchRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_runs_stages')
        .select('*')
        .eq('search_run_id', searchRunId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message || 'Failed to fetch search run stages');
      }

      return data;
    },
    enabled: !!searchRunId,
  });
}

/**
 * Fetch available monitoring profiles
 */
export function useMonitoringProfiles() {
  return useQuery({
    queryKey: ['monitoring-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monitoring_profiles')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        throw new Error(error.message || 'Failed to fetch monitoring profiles');
      }

      return data;
    },
  });
}
