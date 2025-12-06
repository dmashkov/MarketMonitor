/**
 * useAISearch Hook
 *
 * React Query hook для вызова Edge Function ai-search
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface SearchRunParams {
  days?: number;
  segments?: string[];
  event_types?: string[];
}

interface SearchRunResult {
  search_run_id: string;
  status: 'completed' | 'failed';
  events_found: number;
  events: Array<{
    date: string;
    segment: string;
    geography: string | null;
    channel: string | null;
    event_type: string;
    company: string | null;
    description: string;
    criticality: number;
    source_url: string | null;
  }>;
  error_message?: string;
  execution_time_seconds: number;
}

/**
 * Hook для запуска AI поиска через Edge Function
 */
export function useAISearch() {
  const queryClient = useQueryClient();

  const mutation = useMutation<SearchRunResult, Error, SearchRunParams>({
    mutationFn: async (params: SearchRunParams) => {
      // Получить текущую сессию
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Необходима авторизация');
      }

      // Вызвать Edge Function
      const { data, error } = await supabase.functions.invoke<SearchRunResult>('ai-search', {
        body: params,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'Ошибка при выполнении поиска');
      }

      if (!data) {
        throw new Error('Нет данных в ответе');
      }

      // Проверить статус выполнения
      if (data.status === 'failed') {
        throw new Error(data.error_message || 'Поиск завершился с ошибкой');
      }

      return data;
    },
    onSuccess: () => {
      // Инвалидировать кеш событий, чтобы обновить таблицу
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  return {
    runSearch: mutation.mutate,
    isSearching: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

export default useAISearch;
