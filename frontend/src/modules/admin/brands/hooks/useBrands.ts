/**
 * React Query hooks для работы с Brands API
 *
 * Endpoints:
 * - GET    /brands - список брендов
 * - GET    /brands/:id - детали бренда
 * - POST   /brands - создать бренд
 * - PATCH  /brands/:id - обновить бренд
 * - DELETE /brands/:id - удалить бренд
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  Brand,
  BrandWithSegments,
  CreateBrandFormData,
  UpdateBrandFormData,
} from '@/shared/types';

// ============================================================================
// Query Keys
// ============================================================================

export const brandsKeys = {
  all: ['brands'] as const,
  lists: () => [...brandsKeys.all, 'list'] as const,
  list: (filters?: BrandFilters) => [...brandsKeys.lists(), filters] as const,
  details: () => [...brandsKeys.all, 'detail'] as const,
  detail: (id: string) => [...brandsKeys.details(), id] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface BrandFilters {
  category?: 'premium' | 'middle' | 'budget';
  country?: string;
  is_active?: boolean;
  search?: string;
  include_segments?: boolean;
  page?: number;
  limit?: number;
}

export interface BrandsListResponse {
  data: BrandWithSegments[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BrandDetailResponse {
  data: BrandWithSegments;
}

export interface BrandCreateResponse {
  data: Brand;
  message: string;
}

export interface BrandUpdateResponse {
  data: Brand;
  message: string;
}

export interface BrandDeleteResponse {
  message: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Получить список брендов
 */
async function fetchBrands(filters?: BrandFilters): Promise<BrandsListResponse> {
  const {
    category,
    country,
    is_active,
    search,
    include_segments = true,
    page = 1,
    limit = 50,
  } = filters || {};

  // Строим query params
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (country) params.append('country', country);
  if (is_active !== undefined) params.append('is_active', String(is_active));
  if (search) params.append('search', search);
  if (include_segments) params.append('include_segments', 'true');
  params.append('page', String(page));
  params.append('limit', String(limit));

  // Используем прямой fetch для полного контроля над query params
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/brands?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch brands');
  }

  return response.json();
}

/**
 * Получить детали бренда по ID
 */
async function fetchBrandById(id: string): Promise<BrandDetailResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/brands/${id}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch brand');
  }

  return response.json();
}

/**
 * Создать новый бренд
 */
async function createBrand(data: CreateBrandFormData): Promise<BrandCreateResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/brands`;

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
    throw new Error(errorData.error || 'Failed to create brand');
  }

  return response.json();
}

/**
 * Обновить бренд
 */
async function updateBrand({ id, ...data }: UpdateBrandFormData): Promise<BrandUpdateResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/brands/${id}`;

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
    throw new Error(errorData.error || 'Failed to update brand');
  }

  return response.json();
}

/**
 * Удалить бренд
 */
async function deleteBrand(id: string): Promise<BrandDeleteResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/brands/${id}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete brand');
  }

  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook: Получить список брендов
 */
export function useBrands(filters?: BrandFilters) {
  return useQuery({
    queryKey: brandsKeys.list(filters),
    queryFn: () => fetchBrands(filters),
    staleTime: 5 * 60 * 1000, // 5 минут
  });
}

/**
 * Hook: Получить детали бренда
 */
export function useBrand(id: string | null) {
  return useQuery({
    queryKey: brandsKeys.detail(id || ''),
    queryFn: () => fetchBrandById(id!),
    enabled: !!id, // Запускать только если id передан
  });
}

/**
 * Hook: Создать бренд
 */
export function useCreateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBrand,
    onSuccess: () => {
      // Инвалидируем кэш списка брендов
      queryClient.invalidateQueries({ queryKey: brandsKeys.lists() });
    },
  });
}

/**
 * Hook: Обновить бренд
 */
export function useUpdateBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBrand,
    onSuccess: (data) => {
      // Инвалидируем кэш списка и детали
      queryClient.invalidateQueries({ queryKey: brandsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: brandsKeys.detail(data.data.id) });
    },
  });
}

/**
 * Hook: Удалить бренд
 */
export function useDeleteBrand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBrand,
    onSuccess: () => {
      // Инвалидируем кэш списка брендов
      queryClient.invalidateQueries({ queryKey: brandsKeys.lists() });
    },
  });
}
