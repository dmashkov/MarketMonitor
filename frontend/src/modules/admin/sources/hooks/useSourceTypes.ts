/**
 * useSourceTypes Hook
 *
 * React Query hook для загрузки типов источников
 * Используется в SourceFormModal для select
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SourceType } from '@/shared/types';

/**
 * Получить список типов источников
 */
async function fetchSourceTypes(): Promise<SourceType[]> {
  const { data, error } = await supabase
    .from('source_types')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch source types: ${error.message}`);
  }

  return data || [];
}

/**
 * Query keys для React Query
 */
export const sourceTypesKeys = {
  all: ['sourceTypes'] as const,
  list: () => [...sourceTypesKeys.all, 'list'] as const,
};

/**
 * Hook для получения типов источников
 * Кэшируется на 10 минут (типы редко меняются)
 */
export function useSourceTypes() {
  return useQuery({
    queryKey: sourceTypesKeys.list(),
    queryFn: fetchSourceTypes,
    staleTime: 1000 * 60 * 10, // 10 минут
  });
}
