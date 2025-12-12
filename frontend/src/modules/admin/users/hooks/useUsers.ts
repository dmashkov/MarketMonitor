/**
 * React Query hooks для работы с Users API
 *
 * Endpoints:
 * - GET    /users - список пользователей
 * - GET    /users/:id - детали пользователя
 * - PATCH  /users/:id - обновить пользователя
 * - DELETE /users/:id - деактивировать пользователя
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================================================
// Query Keys
// ============================================================================

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (filters?: UserFilters) => [...usersKeys.lists(), filters] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
};

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UserFilters {
  role?: UserRole;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UsersListResponse {
  data: UserProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserDetailResponse {
  data: UserProfile;
}

export interface UpdateUserFormData {
  id: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserUpdateResponse {
  data: UserProfile;
  message: string;
}

export interface UserDeleteResponse {
  message: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Получить список пользователей
 */
async function fetchUsers(filters?: UserFilters): Promise<UsersListResponse> {
  const {
    role,
    is_active,
    search,
    page = 1,
    limit = 50,
  } = filters || {};

  // Строим query params
  const params = new URLSearchParams();
  if (role) params.append('role', role);
  if (is_active !== undefined) params.append('is_active', String(is_active));
  if (search) params.append('search', search);
  params.append('page', String(page));
  params.append('limit', String(limit));

  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/users-api?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch users');
  }

  return response.json();
}

/**
 * Получить детали пользователя по ID
 */
async function fetchUserById(id: string): Promise<UserDetailResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/users-api/${id}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch user');
  }

  return response.json();
}

/**
 * Обновить пользователя
 */
async function updateUser({ id, ...data }: UpdateUserFormData): Promise<UserUpdateResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/users-api/${id}`;

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
    throw new Error(errorData.error || 'Failed to update user');
  }

  return response.json();
}

/**
 * Деактивировать пользователя
 */
async function deleteUser(id: string): Promise<UserDeleteResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/users-api/${id}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete user');
  }

  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook: Получить список пользователей
 */
export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: usersKeys.list(filters),
    queryFn: () => fetchUsers(filters),
    staleTime: 5 * 60 * 1000, // 5 минут
  });
}

/**
 * Hook: Получить детали пользователя
 */
export function useUser(id: string | null) {
  return useQuery({
    queryKey: usersKeys.detail(id || ''),
    queryFn: () => fetchUserById(id!),
    enabled: !!id,
  });
}

/**
 * Hook: Обновить пользователя
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onSuccess: (data) => {
      // Инвалидируем кэш списка и детали
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: usersKeys.detail(data.data.id) });
    },
  });
}

/**
 * Hook: Деактивировать пользователя
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      // Инвалидируем кэш списка пользователей
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}
