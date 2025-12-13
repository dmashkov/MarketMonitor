/**
 * usePrompts Hook
 *
 * React Query hooks для работы с Prompts API
 * - fetchPrompts - список промптов с фильтрами
 * - fetchPrompt - один промпт по ID
 * - createPrompt - создание промпта (admin only)
 * - updatePrompt - обновление промпта (admin only)
 * - deletePrompt - удаление промпта (admin only)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AIPromptWithRelations, SearchType, SearchDepth } from '@/shared/types';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptFilters {
  page?: number;
  limit?: number;
  active?: boolean;
  searchType?: SearchType;
  search?: string;
}

export interface PromptsListResponse {
  success: boolean;
  data: {
    data: AIPromptWithRelations[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

export interface PromptResponse {
  success: boolean;
  data: AIPromptWithRelations;
}

export interface CreatePromptFormDataAPI {
  name: string;
  description: string | null;
  prompt_template: string;
  search_type: SearchType | null;
  is_active: boolean;
  segment_id: string | null;
  geography_id: string | null;
  search_depth: SearchDepth;
}

export interface UpdatePromptFormDataAPI extends Partial<CreatePromptFormDataAPI> {}

// ============================================================================
// QUERY KEYS
// ============================================================================

export const promptsKeys = {
  all: ['prompts'] as const,
  lists: () => [...promptsKeys.all, 'list'] as const,
  list: (filters: PromptFilters) => [...promptsKeys.lists(), filters] as const,
  details: () => [...promptsKeys.all, 'detail'] as const,
  detail: (id: string) => [...promptsKeys.details(), id] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Получить список промптов с фильтрами
 */
async function fetchPrompts(filters?: PromptFilters): Promise<PromptsListResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  // Build query params
  const params = new URLSearchParams();
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('page_size', filters.limit.toString());
  if (filters?.active !== undefined) params.append('is_active', filters.active.toString());
  if (filters?.searchType) params.append('search_type', filters.searchType);
  if (filters?.search) params.append('search', filters.search);

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompts-api?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.data.session.access_token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch prompts: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Получить один промпт по ID
 */
async function fetchPrompt(id: string): Promise<PromptResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompts-api?id=${id}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.data.session.access_token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch prompt: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Создать промпт
 */
async function createPrompt(data: CreatePromptFormDataAPI): Promise<PromptResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompts-api`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to create prompt: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Обновить промпт
 */
async function updatePrompt(id: string, data: UpdatePromptFormDataAPI): Promise<PromptResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompts-api?id=${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.data.session.access_token}`,
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to update prompt: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Удалить промпт
 */
async function deletePrompt(id: string): Promise<{ success: boolean }> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompts-api?id=${id}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.data.session.access_token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete prompt: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Получить список промптов
 */
export function usePrompts(filters: PromptFilters = { page: 1, limit: 50 }) {
  return useQuery({
    queryKey: promptsKeys.list(filters),
    queryFn: () => fetchPrompts(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Получить один промпт
 */
export function usePrompt(id: string) {
  return useQuery({
    queryKey: promptsKeys.detail(id),
    queryFn: () => fetchPrompt(id),
    enabled: !!id,
  });
}

/**
 * Создать промпт
 */
export function useCreatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promptsKeys.lists() });
    },
  });
}

/**
 * Обновить промпт
 */
export function useUpdatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePromptFormDataAPI }) =>
      updatePrompt(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: promptsKeys.lists() });
      queryClient.setQueryData(promptsKeys.detail(data.data.id), data);
    },
  });
}

/**
 * Удалить промпт
 */
export function useDeletePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePrompt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promptsKeys.lists() });
    },
  });
}
