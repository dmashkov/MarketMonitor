/**
 * useGeographies Hook
 *
 * React Query hook для загрузки списка географий
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Geography } from '@/shared/types';

// ============================================================================
// QUERY KEYS
// ============================================================================

const geographiesKeys = {
  all: ['geographies'] as const,
  lists: () => [...geographiesKeys.all, 'list'] as const,
  list: () => [...geographiesKeys.lists()] as const,
};

// ============================================================================
// API FUNCTION
// ============================================================================

async function fetchGeographies(): Promise<Geography[]> {
  const { data, error } = await supabase
    .from('geographies')
    .select('*')
    .order('name')
    .eq('type', 'country'); // Only fetch countries for simplicity

  if (error) {
    throw new Error(`Failed to fetch geographies: ${error.message}`);
  }

  return (data as Geography[]) || [];
}

// ============================================================================
// REACT QUERY HOOK
// ============================================================================

export function useGeographies() {
  return useQuery({
    queryKey: geographiesKeys.list(),
    queryFn: fetchGeographies,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
