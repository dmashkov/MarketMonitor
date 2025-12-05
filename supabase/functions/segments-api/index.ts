/**
 * Segments API Edge Function
 *
 * API для работы с сегментами оборудования
 * - GET /segments - список всех сегментов
 * - GET /segments/:id - получить сегмент по ID
 * - POST /segments - создать сегмент (admin only)
 * - PATCH /segments/:id - обновить сегмент (admin only)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// TYPES
// ============================================================================

interface Segment {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateSegmentRequest {
  name: string;
  code: string;
  description?: string | null;
}

interface UpdateSegmentRequest {
  name?: string;
  code?: string;
  description?: string | null;
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
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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
 * GET /segments - Получить список всех сегментов
 */
async function handleGetSegments(
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching segments:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as Segment[]);
  } catch (err) {
    console.error('Unexpected error in handleGetSegments:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /segments/:id - Получить сегмент по ID
 */
async function handleGetSegmentById(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Segment not found', 404);
      }
      console.error('Error fetching segment:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as Segment);
  } catch (err) {
    console.error('Unexpected error in handleGetSegmentById:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /segments - Создать новый сегмент (admin only)
 */
async function handleCreateSegment(
  supabase: ReturnType<typeof createClient>,
  body: CreateSegmentRequest
): Promise<Response> {
  try {
    // Validate required fields
    if (!body.name || !body.code) {
      return errorResponse('name and code are required', 400);
    }

    // Validate code format (uppercase letters, numbers, underscores only)
    if (!/^[A-Z0-9_]+$/.test(body.code)) {
      return errorResponse('code must contain only uppercase letters, numbers, and underscores', 400);
    }

    // Prepare data
    const segmentData = {
      name: body.name,
      code: body.code,
      description: body.description || null,
    };

    // Insert segment
    const { data, error } = await supabase
      .from('segments')
      .insert(segmentData)
      .select('*')
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        if (error.message.includes('code')) {
          return errorResponse('Segment with this code already exists', 409);
        }
        if (error.message.includes('name')) {
          return errorResponse('Segment with this name already exists', 409);
        }
      }
      console.error('Error creating segment:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as Segment, 201);
  } catch (err) {
    console.error('Unexpected error in handleCreateSegment:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PATCH /segments/:id - Обновить сегмент (admin only)
 */
async function handleUpdateSegment(
  supabase: ReturnType<typeof createClient>,
  id: string,
  body: UpdateSegmentRequest
): Promise<Response> {
  try {
    // Validate code format if provided
    if (body.code && !/^[A-Z0-9_]+$/.test(body.code)) {
      return errorResponse('code must contain only uppercase letters, numbers, and underscores', 400);
    }

    // Update segment
    const { data, error } = await supabase
      .from('segments')
      .update(body)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Segment not found', 404);
      }
      // Check for unique constraint violation
      if (error.code === '23505') {
        if (error.message.includes('code')) {
          return errorResponse('Segment with this code already exists', 409);
        }
        if (error.message.includes('name')) {
          return errorResponse('Segment with this name already exists', 409);
        }
      }
      console.error('Error updating segment:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as Segment);
  } catch (err) {
    console.error('Unexpected error in handleUpdateSegment:', err);
    return errorResponse('Internal server error', 500);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    // GET /segments or GET /segments/:id
    if (method === 'GET') {
      if (pathParts.length === 0) {
        // GET /segments - list all
        return await handleGetSegments(supabase);
      } else if (pathParts.length === 1) {
        // GET /segments/:id
        const id = pathParts[0];
        return await handleGetSegmentById(supabase, id);
      } else {
        return errorResponse('Invalid path', 404);
      }
    }

    // POST /segments - create (admin only)
    if (method === 'POST' && pathParts.length === 0) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const body: CreateSegmentRequest = await req.json();
      return await handleCreateSegment(supabase, body);
    }

    // PATCH /segments/:id - update (admin only)
    if (method === 'PATCH' && pathParts.length === 1) {
      // Check admin permission
      const admin = await isAdmin(supabase, user.id);
      if (!admin) {
        return errorResponse('Admin permission required', 403);
      }

      const id = pathParts[0];
      const body: UpdateSegmentRequest = await req.json();
      return await handleUpdateSegment(supabase, id, body);
    }

    // Method not allowed
    return errorResponse('Method not allowed', 405);
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
