/**
 * React Query hooks для работы с Segments API
 *
 * Endpoints:
 * - GET /segments - список сегментов
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SegmentEntity } from '@/shared/types';

// ============================================================================
// Query Keys
// ============================================================================

export const segmentsKeys = {
  all: ['segments'] as const,
  lists: () => [...segmentsKeys.all, 'list'] as const,
  list: () => [...segmentsKeys.lists()] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface SegmentsListResponse {
  data: SegmentEntity[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Получить список всех сегментов
 */
async function fetchSegments(): Promise<SegmentsListResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/segments`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch segments');
  }

  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook: Получить список всех сегментов
 */
export function useSegments() {
  return useQuery({
    queryKey: segmentsKeys.list(),
    queryFn: fetchSegments,
    staleTime: 10 * 60 * 1000, // 10 минут (сегменты редко меняются)
  });
}
