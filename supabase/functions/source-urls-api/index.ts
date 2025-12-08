/**
 * Source URLs API Edge Function
 *
 * CRUD операции для управления конкретными URL адресами источников
 * - GET /source-urls?source_id=xxx - список URL для источника
 * - GET /source-urls/:id - получить URL по ID
 * - POST /source-urls - создать URL (admin only)
 * - PATCH /source-urls/:id - обновить URL (admin only)
 * - DELETE /source-urls/:id - удалить URL (admin only)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// TYPES
// ============================================================================

type SourceUrlType = 'news' | 'products' | 'blog' | 'press-release';
type CheckFrequency = 'daily' | 'weekly' | 'monthly';

interface SourceUrl {
  id: string;
  source_id: string;
  url: string;
  url_type: SourceUrlType;
  description: string | null;
  is_active: boolean;
  check_frequency: CheckFrequency;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SourceUrlWithSource extends SourceUrl {
  source?: {
    id: string;
    name: string;
    source_type_id: string;
  };
}

interface CreateSourceUrlRequest {
  source_id: string;
  url: string;
  url_type?: SourceUrlType;
  description?: string | null;
  is_active?: boolean;
  check_frequency?: CheckFrequency;
}

interface UpdateSourceUrlRequest {
  url?: string;
  url_type?: SourceUrlType;
  description?: string | null;
  is_active?: boolean;
  check_frequency?: CheckFrequency;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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

/**
 * Проверка валидности URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /source-urls - Получить список URL
 * Query params: source_id (required), active, type
 */
async function handleGetSourceUrls(
  supabase: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  try {
    const sourceId = url.searchParams.get('source_id');
    const isActive = url.searchParams.get('active');
    const urlType = url.searchParams.get('type');

    if (!sourceId) {
      return errorResponse('source_id query parameter is required', 400);
    }

    // Build query
    let query = supabase
      .from('source_urls')
      .select('*, source:sources(id, name, source_type_id)')
      .eq('source_id', sourceId);

    // Apply filters
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }
    if (urlType) {
      query = query.eq('url_type', urlType);
    }

    // Order by url_type, created_at
    query = query.order('url_type', { ascending: true }).order('created_at', { ascending: false });

    // Execute query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching source URLs:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as SourceUrlWithSource[]);
  } catch (err) {
    console.error('Unexpected error in handleGetSourceUrls:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /source-urls/:id - Получить URL по ID
 */
async function handleGetSourceUrlById(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('source_urls')
      .select('*, source:sources(id, name, source_type_id)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Source URL not found', 404);
      }
      console.error('Error fetching source URL:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as SourceUrlWithSource);
  } catch (err) {
    console.error('Unexpected error in handleGetSourceUrlById:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /source-urls - Создать новый URL (admin only)
 */
async function handleCreateSourceUrl(
  supabase: ReturnType<typeof createClient>,
  body: CreateSourceUrlRequest
): Promise<Response> {
  try {
    // Validate required fields
    if (!body.source_id || !body.url) {
      return errorResponse('source_id and url are required', 400);
    }

    // Validate URL format
    if (!isValidUrl(body.url)) {
      return errorResponse('Invalid URL format', 400);
    }

    // Check if source exists
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('id', body.source_id)
      .single();

    if (sourceError || !source) {
      return errorResponse('Source not found', 404);
    }

    // Prepare data
    const urlData = {
      source_id: body.source_id,
      url: body.url,
      url_type: body.url_type || 'news',
      description: body.description || null,
      is_active: body.is_active !== undefined ? body.is_active : true,
      check_frequency: body.check_frequency || 'daily',
    };

    // Insert source URL
    const { data, error } = await supabase
      .from('source_urls')
      .insert(urlData)
      .select('*, source:sources(id, name, source_type_id)')
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return errorResponse('URL already exists for this source', 409);
      }
      console.error('Error creating source URL:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as SourceUrlWithSource, 201);
  } catch (err) {
    console.error('Unexpected error in handleCreateSourceUrl:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PATCH /source-urls/:id - Обновить URL (admin only)
 */
async function handleUpdateSourceUrl(
  supabase: ReturnType<typeof createClient>,
  id: string,
  body: UpdateSourceUrlRequest
): Promise<Response> {
  try {
    // Validate URL format if provided
    if (body.url && !isValidUrl(body.url)) {
      return errorResponse('Invalid URL format', 400);
    }

    // Update source URL
    const { data, error } = await supabase
      .from('source_urls')
      .update(body)
      .eq('id', id)
      .select('*, source:sources(id, name, source_type_id)')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Source URL not found', 404);
      }
      // Check for unique constraint violation
      if (error.code === '23505') {
        return errorResponse('URL already exists for this source', 409);
      }
      console.error('Error updating source URL:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as SourceUrlWithSource);
  } catch (err) {
    console.error('Unexpected error in handleUpdateSourceUrl:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * DELETE /source-urls/:id - Удалить URL (admin only)
 */
async function handleDeleteSourceUrl(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Response> {
  try {
    const { error } = await supabase
      .from('source_urls')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting source URL:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse({ message: 'Source URL deleted successfully' });
  } catch (err) {
    console.error('Unexpected error in handleDeleteSourceUrl:', err);
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

    // GET /source-urls or GET /source-urls/:id
    if (method === 'GET') {
      if (pathParts.length === 0) {
        // GET /source-urls - list (requires source_id param)
        return await handleGetSourceUrls(supabase, url);
      } else if (pathParts.length === 1) {
        // GET /source-urls/:id
        const id = pathParts[0];
        return await handleGetSourceUrlById(supabase, id);
      } else {
        return errorResponse('Invalid path', 404);
      }
    }

    // POST /source-urls - create (admin only)
    if (method === 'POST' && pathParts.length === 0) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const body: CreateSourceUrlRequest = await req.json();
      return await handleCreateSourceUrl(supabase, body);
    }

    // PATCH /source-urls/:id - update (admin only)
    if (method === 'PATCH' && pathParts.length === 1) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const id = pathParts[0];
      const body: UpdateSourceUrlRequest = await req.json();
      return await handleUpdateSourceUrl(supabase, id, body);
    }

    // DELETE /source-urls/:id - delete (admin only)
    if (method === 'DELETE' && pathParts.length === 1) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const id = pathParts[0];
      return await handleDeleteSourceUrl(supabase, id);
    }

    // Method not allowed
    return errorResponse('Method not allowed', 405);
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
