/**
 * useSources Hook
 *
 * React Query hooks для работы с Sources API
 * - fetchSources - список источников с фильтрами
 * - fetchSource - один источник по ID
 * - createSource - создание источника (admin only)
 * - updateSource - обновление источника (admin only)
 * - deleteSource - удаление источника (admin only)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  Source,
  SourceWithType,
  CheckFrequency,
} from '@/shared/types';

// ============================================================================
// TYPES
// ============================================================================

export interface SourceFilters {
  page?: number;
  limit?: number;
  type?: string; // source_type_id
  active?: boolean;
  frequency?: CheckFrequency;
  priority_min?: number;
  priority_max?: number;
  search?: string;
}

export interface SourcesListResponse {
  success: boolean;
  data: {
    data: SourceWithType[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

export interface SourceResponse {
  success: boolean;
  data: SourceWithType;
}

export interface CreateSourceFormData {
  name: string;
  source_type_id: string;
  website_url?: string | null;
  telegram_channel?: string | null;
  description?: string | null;
  is_active?: boolean;
  priority?: number;
  check_frequency?: CheckFrequency;
  metadata?: Record<string, unknown>;
}

export interface UpdateSourceFormData extends Partial<CreateSourceFormData> {}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Получить список источников с фильтрами
 */
async function fetchSources(filters?: SourceFilters): Promise<SourcesListResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  // Build query params
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('page_size', filters.limit.toString());
  if (filters?.type) params.append('type', filters.type);
  if (filters?.active !== undefined) params.append('active', filters.active.toString());
  if (filters?.frequency) params.append('frequency', filters.frequency);
  if (filters?.priority_min) params.append('priority_min', filters.priority_min.toString());
  if (filters?.priority_max) params.append('priority_max', filters.priority_max.toString());
  if (filters?.search) params.append('search', filters.search);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/sources?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch sources');
  }

  return response.json();
}

/**
 * Получить источник по ID
 */
async function fetchSource(id: string): Promise<SourceResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/sources/${id}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch source');
  }

  return response.json();
}

/**
 * Создать новый источник (admin only)
 */
async function createSource(data: CreateSourceFormData): Promise<SourceResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/sources`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create source');
  }

  return response.json();
}

/**
 * Обновить источник (admin only)
 */
async function updateSource(id: string, data: UpdateSourceFormData): Promise<SourceResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/sources/${id}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update source');
  }

  return response.json();
}

/**
 * Удалить источник (admin only)
 */
async function deleteSource(id: string): Promise<void> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/sources/${id}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete source');
  }
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Query keys для React Query
 */
export const sourcesKeys = {
  all: ['sources'] as const,
  lists: () => [...sourcesKeys.all, 'list'] as const,
  list: (filters?: SourceFilters) => [...sourcesKeys.lists(), filters] as const,
  details: () => [...sourcesKeys.all, 'detail'] as const,
  detail: (id: string) => [...sourcesKeys.details(), id] as const,
};

/**
 * Hook для получения списка источников
 */
export function useSources(filters?: SourceFilters) {
  return useQuery({
    queryKey: sourcesKeys.list(filters),
    queryFn: () => fetchSources(filters),
    select: (response) => response.data,
  });
}

/**
 * Hook для получения одного источника
 */
export function useSource(id: string) {
  return useQuery({
    queryKey: sourcesKeys.detail(id),
    queryFn: () => fetchSource(id),
    select: (response) => response.data,
    enabled: !!id,
  });
}

/**
 * Hook для создания источника
 */
export function useCreateSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSource,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: sourcesKeys.lists() });
    },
  });
}

/**
 * Hook для обновления источника
 */
export function useUpdateSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSourceFormData }) =>
      updateSource(id, data),
    onSuccess: (_, variables) => {
      // Invalidate both list and specific source
      queryClient.invalidateQueries({ queryKey: sourcesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sourcesKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook для удаления источника
 */
export function useDeleteSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSource,
    onSuccess: () => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: sourcesKeys.lists() });
    },
  });
}
