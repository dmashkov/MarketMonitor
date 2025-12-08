/**
 * Sources API Edge Function
 *
 * CRUD операции для управления источниками мониторинга
 * - GET /sources - список источников (с фильтрами, пагинацией)
 * - GET /sources/:id - получить источник по ID
 * - POST /sources - создать источник (admin only)
 * - PATCH /sources/:id - обновить источник (admin only)
 * - DELETE /sources/:id - удалить источник (admin only)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// TYPES
// ============================================================================

type SourceTypeCode =
  | 'DISTRIBUTOR'
  | 'MANUFACTURER'
  | 'BUSINESS_MEDIA'
  | 'TELEGRAM'
  | 'ASSOCIATION'
  | 'INDUSTRY_PORTAL';

type CheckFrequency = 'daily' | 'weekly' | 'monthly';

interface Source {
  id: string;
  name: string;
  source_type_id: string;
  website_url: string | null;
  telegram_channel: string | null;
  description: string | null;
  is_active: boolean;
  priority: number;
  check_frequency: CheckFrequency;
  last_checked_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface SourceWithType extends Source {
  source_type?: {
    id: string;
    name: string;
    code: SourceTypeCode;
    description: string | null;
  };
}

interface CreateSourceRequest {
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

interface UpdateSourceRequest {
  name?: string;
  source_type_id?: string;
  website_url?: string | null;
  telegram_channel?: string | null;
  description?: string | null;
  is_active?: boolean;
  priority?: number;
  check_frequency?: CheckFrequency;
  metadata?: Record<string, unknown>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Проверка, является ли пользователь администратором
 */
async function isAdmin(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !profile) {
    return false;
  }

  return profile.role === 'admin';
}

/**
 * CORS headers
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

/**
 * Успешный ответ
 */
function successResponse<T>(data: T, status = 200): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Ответ с ошибкой
 */
function errorResponse(message: string, status = 400): Response {
  const response: ApiResponse<never> = {
    success: false,
    error: message,
  };
  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /sources - Получить список источников
 * Query params: page, page_size, type, active, frequency, priority_min, priority_max, search
 */
async function handleGetSources(
  supabase: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  try {
    // Parse query params
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '20');
    const sourceTypeId = url.searchParams.get('type');
    const isActive = url.searchParams.get('active');
    const frequency = url.searchParams.get('frequency');
    const priorityMin = url.searchParams.get('priority_min');
    const priorityMax = url.searchParams.get('priority_max');
    const search = url.searchParams.get('search');

    // Build query
    let query = supabase
      .from('sources')
      .select('*, source_type:source_types(*)', { count: 'exact' });

    // Apply filters
    if (sourceTypeId) {
      query = query.eq('source_type_id', sourceTypeId);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }
    if (frequency) {
      query = query.eq('check_frequency', frequency);
    }
    if (priorityMin) {
      query = query.gte('priority', parseInt(priorityMin));
    }
    if (priorityMax) {
      query = query.lte('priority', parseInt(priorityMax));
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Order by priority DESC, name ASC
    query = query.order('priority', { ascending: false }).order('name', { ascending: true });

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching sources:', error);
      return errorResponse(error.message, 500);
    }

    const totalPages = Math.ceil((count || 0) / pageSize);

    const response: PaginatedResponse<SourceWithType> = {
      data: data as SourceWithType[],
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    };

    return successResponse(response);
  } catch (err) {
    console.error('Unexpected error in handleGetSources:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /sources/:id - Получить источник по ID
 */
async function handleGetSourceById(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('*, source_type:source_types(*)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Source not found', 404);
      }
      console.error('Error fetching source:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as SourceWithType);
  } catch (err) {
    console.error('Unexpected error in handleGetSourceById:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /sources - Создать новый источник (admin only)
 */
async function handleCreateSource(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: CreateSourceRequest
): Promise<Response> {
  try {
    // Validate required fields
    if (!body.name || !body.source_type_id) {
      return errorResponse('Name and source_type_id are required', 400);
    }

    // Validate priority (1-10)
    if (body.priority !== undefined && (body.priority < 1 || body.priority > 10)) {
      return errorResponse('Priority must be between 1 and 10', 400);
    }

    // Prepare data
    const sourceData = {
      name: body.name,
      source_type_id: body.source_type_id,
      website_url: body.website_url || null,
      telegram_channel: body.telegram_channel || null,
      description: body.description || null,
      is_active: body.is_active !== undefined ? body.is_active : true,
      priority: body.priority || 5,
      check_frequency: body.check_frequency || 'daily',
      metadata: body.metadata || {},
      created_by: userId,
    };

    // Insert source
    const { data, error } = await supabase
      .from('sources')
      .insert(sourceData)
      .select('*, source_type:source_types(*)')
      .single();

    if (error) {
      console.error('Error creating source:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as SourceWithType, 201);
  } catch (err) {
    console.error('Unexpected error in handleCreateSource:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PATCH /sources/:id - Обновить источник (admin only)
 */
async function handleUpdateSource(
  supabase: ReturnType<typeof createClient>,
  id: string,
  body: UpdateSourceRequest
): Promise<Response> {
  try {
    // Validate priority if provided
    if (body.priority !== undefined && (body.priority < 1 || body.priority > 10)) {
      return errorResponse('Priority must be between 1 and 10', 400);
    }

    // Update source
    const { data, error } = await supabase
      .from('sources')
      .update(body)
      .eq('id', id)
      .select('*, source_type:source_types(*)')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Source not found', 404);
      }
      console.error('Error updating source:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as SourceWithType);
  } catch (err) {
    console.error('Unexpected error in handleUpdateSource:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * DELETE /sources/:id - Удалить источник (admin only)
 */
async function handleDeleteSource(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Response> {
  try {
    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting source:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse({ message: 'Source deleted successfully' });
  } catch (err) {
    console.error('Unexpected error in handleDeleteSource:', err);
    return errorResponse('Internal server error', 500);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { authorization: authHeader },
      },
    });

    // Verify user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter((p) => p);

    // Route handling
    const method = req.method;

    // GET /sources or GET /sources/:id
    if (method === 'GET') {
      if (pathParts.length === 0) {
        // GET /sources - list all
        return await handleGetSources(supabase, url);
      } else if (pathParts.length === 1) {
        // GET /sources/:id
        const id = pathParts[0];
        return await handleGetSourceById(supabase, id);
      } else {
        return errorResponse('Invalid path', 404);
      }
    }

    // POST /sources - create (admin only)
    if (method === 'POST' && pathParts.length === 0) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const body: CreateSourceRequest = await req.json();
      return await handleCreateSource(supabase, user.id, body);
    }

    // PATCH /sources/:id - update (admin only)
    if (method === 'PATCH' && pathParts.length === 1) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const id = pathParts[0];
      const body: UpdateSourceRequest = await req.json();
      return await handleUpdateSource(supabase, id, body);
    }

    // DELETE /sources/:id - delete (admin only)
    if (method === 'DELETE' && pathParts.length === 1) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const id = pathParts[0];
      return await handleDeleteSource(supabase, id);
    }

    // Method not allowed
    return errorResponse('Method not allowed', 405);
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
