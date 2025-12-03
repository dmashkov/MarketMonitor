/**
 * useEvents Hook
 *
 * Хук для управления событиями рынка
 * Отвечает за загрузку, фильтрацию и управлением событиями из Supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { MarketEvent } from '../../../shared/types';

/**
 * Ключи для React Query кэша
 */
const queryKeys = {
  all: ['events'] as const,
  lists: () => [...queryKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...queryKeys.lists(), { filters }] as const,
  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (id: string) => [...queryKeys.details(), id] as const,
};

/**
 * Получить все события
 */
export const useEventsList = (filters?: {
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: queryKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Ошибка при загрузке событий: ${error.message}`);
      }

      return (data || []) as MarketEvent[];
    },
  });
};

/**
 * Получить одно событие по ID
 */
export const useEventDetail = (id: string) => {
  return useQuery({
    queryKey: queryKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Ошибка при загрузке события: ${error.message}`);
      }

      return data as MarketEvent;
    },
    enabled: !!id,
  });
};

/**
 * Создать новое событие
 */
export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: Omit<MarketEvent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('events')
        .insert([event])
        .select()
        .single();

      if (error) {
        throw new Error(`Ошибка при создании события: ${error.message}`);
      }

      return data as MarketEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
    },
  });
};

/**
 * Обновить событие
 */
export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<MarketEvent> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from('events')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Ошибка при обновлении события: ${error.message}`);
      }

      return updated as MarketEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.detail(data.id) });
    },
  });
};

/**
 * Удалить событие
 */
export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);

      if (error) {
        throw new Error(`Ошибка при удалении события: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lists() });
    },
  });
};

export default useEventsList;
