/**
 * Edge Function: users-api
 *
 * CRUD операции для управления пользователями (admin only)
 *
 * Endpoints:
 * - GET    /users              - список всех пользователей (с фильтрами)
 * - GET    /users/:id          - детали пользователя
 * - PATCH  /users/:id          - обновить пользователя (изменить роль, активность)
 * - DELETE /users/:id          - удалить пользователя (soft delete - is_active=false)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
};

// Типы
type UserRole = 'admin' | 'user';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface UpdateUserRequest {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

serve(async (req) => {
  // OPTIONS для CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Получаем authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Извлекаем JWT токен
    const jwt = authHeader.replace('Bearer ', '');

    // Инициализация Supabase клиента с SERVICE_ROLE_KEY
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Проверка аутентификации
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Проверка что пользователь - администратор
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin only' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Парсинг URL
    const url = new URL(req.url);
    const fullPath = url.pathname.split('/').filter(Boolean);
    const pathParts = fullPath.slice(1); // Убираем 'users-api' из пути

    const method = req.method;

    // ========================================
    // GET /users - Список всех пользователей
    // ========================================
    if (method === 'GET' && pathParts.length === 0) {
      // Фильтры
      const role = url.searchParams.get('role') as UserRole | null;
      const is_active = url.searchParams.get('is_active');
      const search = url.searchParams.get('search'); // Поиск по email или full_name

      // Pagination
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = supabaseClient
        .from('user_profiles')
        .select('*', { count: 'exact' });

      // Применяем фильтры
      if (role) {
        query = query.eq('role', role);
      }
      if (is_active !== null) {
        query = query.eq('is_active', is_active === 'true');
      }
      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      // Pagination
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: users, error: usersError, count } = await query;

      if (usersError) {
        throw usersError;
      }

      return new Response(
        JSON.stringify({
          data: users,
          total: count,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // GET /users/:id - Детали пользователя
    // ========================================
    if (method === 'GET' && pathParts.length === 1) {
      const userId = pathParts[0];

      const { data: userProfile, error: userError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !userProfile) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      return new Response(
        JSON.stringify({ data: userProfile }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // PATCH /users/:id - Обновить пользователя
    // ========================================
    if (method === 'PATCH' && pathParts.length === 1) {
      const userId = pathParts[0];
      const body: UpdateUserRequest = await req.json();

      // Проверка существования пользователя
      const { data: existingUser } = await supabaseClient
        .from('user_profiles')
        .select('id, role')
        .eq('id', userId)
        .single();

      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      // Запрет на изменение собственной роли (защита от самоудаления админа)
      if (userId === user.id && body.role && body.role !== existingUser.role) {
        return new Response(
          JSON.stringify({ error: 'Cannot change your own role' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Обновляем пользователя
      const updateData: Partial<UserProfile> = {};
      if (body.full_name !== undefined) updateData.full_name = body.full_name;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const { data: updatedUser, error: updateError } = await supabaseClient
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ data: updatedUser, message: 'User updated successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // DELETE /users/:id - Деактивировать пользователя (soft delete)
    // ========================================
    if (method === 'DELETE' && pathParts.length === 1) {
      const userId = pathParts[0];

      // Проверка существования
      const { data: existingUser } = await supabaseClient
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      // Запрет на удаление самого себя
      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete yourself' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Soft delete - деактивируем пользователя
      const { error: deleteError } = await supabaseClient
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(
        JSON.stringify({ message: 'User deactivated successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // Неизвестный endpoint
    // ========================================
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );

  } catch (error) {
    console.error('users-api error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
