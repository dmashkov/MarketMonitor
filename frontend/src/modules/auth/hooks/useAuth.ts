/**
 * useAuth Hook - Central authentication management
 *
 * Provides type-safe access to:
 * - Current user session
 * - User profile and role
 * - Authentication functions (login, logout, register)
 *
 * This hook MUST be used in all components that need auth info
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { UserProfile, AuthSession, AuthContextType } from '@/shared/types';
import { supabase } from '@/lib/supabase';

/**
 * Main authentication hook with full type safety
 *
 * @returns {AuthContextType} Auth context with user info and functions
 */
export const useAuth = (): AuthContextType => {
  const queryClient = useQueryClient();

  /**
   * Fetch current session
   */
  const sessionQuery = useQuery<AuthSession | null>({
    queryKey: ['auth', 'session'],
    queryFn: async (): Promise<AuthSession | null> => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session as AuthSession | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Fetch user profile (if session exists)
   */
  const profileQuery = useQuery<UserProfile | null>({
    queryKey: ['auth', 'profile', sessionQuery.data?.user.id],
    queryFn: async (): Promise<UserProfile | null> => {
      const session = sessionQuery.data;
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found, which is OK
        throw error;
      }

      return (data as UserProfile) || null;
    },
    enabled: !!sessionQuery.data?.user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  /**
   * Login mutation
   */
  const loginMutation = useMutation<void, Error, { email: string; password: string }>({
    mutationFn: async ({ email, password }): Promise<void> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    },
    onSuccess: async (): Promise<void> => {
      // Invalidate and refetch auth data
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  /**
   * Register mutation
   */
  const registerMutation = useMutation<void, Error, { email: string; password: string; fullName?: string }>(
    {
      mutationFn: async ({ email, password, fullName }): Promise<void> => {
        // 1. Создать пользователя через Auth
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || null,
            },
            // Отключаем требование подтверждения почты для локального тестирования
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error('Пользователь не был создан');

        // 2. Создать профиль пользователя в user_profiles таблице
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email: email,
            full_name: fullName || null,
            role: 'user', // По умолчанию обычный пользователь
            is_active: true, // Активен по умолчанию
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          // Если профиль не создался - это не критично для первой регистрации
          console.warn('Предупреждение при создании профиля:', profileError.message);
        }
      },
      onSuccess: async (): Promise<void> => {
        // Invalidate and refetch auth data
        await queryClient.invalidateQueries({ queryKey: ['auth'] });
      },
    }
  );

  /**
   * Logout mutation
   */
  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: async (): Promise<void> => {
      // Clear all auth data
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      await queryClient.clear();
    },
  });

  // Derive computed properties
  const session = sessionQuery.data ?? null;
  const user = profileQuery.data ?? null;
  const isAdmin: boolean = user !== null && user.role === 'admin';
  const isActive: boolean = user !== null && user.is_active;

  const isLoading: boolean = sessionQuery.isLoading || profileQuery.isLoading;

  // Type-safe login wrapper
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation]
  );

  // Type-safe register wrapper
  const register = useCallback(
    async (email: string, password: string, fullName?: string): Promise<void> => {
      await registerMutation.mutateAsync({ email, password, fullName });
    },
    [registerMutation]
  );

  // Type-safe logout wrapper
  const logout = useCallback(
    async (): Promise<void> => {
      await logoutMutation.mutateAsync();
    },
    [logoutMutation]
  );

  return {
    session,
    user,
    isLoading,
    isAdmin,
    isActive,
    login,
    logout,
    register,
  };
};

export default useAuth;
