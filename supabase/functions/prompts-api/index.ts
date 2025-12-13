/**
 * Edge Function: Prompts API
 *
 * CRUD operations for AI Prompts management
 * - GET /prompts-api - List prompts with filters
 * - GET /prompts-api?id=UUID - Get single prompt
 * - POST /prompts-api - Create prompt (admin only)
 * - PATCH /prompts-api?id=UUID - Update prompt (admin only)
 * - DELETE /prompts-api?id=UUID - Delete prompt (admin only)
 *
 * All endpoints require authentication and admin role (except GET list)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// ============================================================================
// TYPES
// ============================================================================

interface AIPrompt {
  id: string;
  name: string;
  description: string | null;
  prompt_template: string;
  search_type: string | null;
  is_active: boolean;
  segment_id: string | null;
  geography_id: string | null;
  search_depth: 'daily' | 'weekly' | 'monthly';
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface AIPromptWithRelations extends AIPrompt {
  segment?: { id: string; name: string } | null;
  geography?: { id: string; name: string } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// CORS Headers
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Helper Functions
// ============================================================================

function jsonResponse<T>(data: T, status: number = 200): Response {
  const response = new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsHeaders['Access-Control-Allow-Origin'],
      'Access-Control-Allow-Methods': corsHeaders['Access-Control-Allow-Methods'],
      'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'],
    },
  });
  return response;
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse<ApiResponse<null>>(
    {
      success: false,
      error: message,
    },
    status,
  );
}

// ============================================================================
// Request Handlers
// ============================================================================

async function handleGetList(
  supabase: ReturnType<typeof createClient>,
  url: URL,
): Promise<Response> {
  try {
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '50');
    const search = url.searchParams.get('search');
    const isActive = url.searchParams.get('is_active');
    const searchType = url.searchParams.get('search_type');

    let query = supabase
      .from('ai_prompts')
      .select(
        `
        *,
        segment:segment_id(id, name),
        geography:geography_id(id, name)
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%`,
      );
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (searchType) {
      query = query.eq('search_type', searchType);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return jsonResponse<ApiResponse<PaginatedResponse<AIPromptWithRelations>>>({
      success: true,
      data: {
        data: data as AIPromptWithRelations[],
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch prompts',
      500,
    );
  }
}

async function handleGetSingle(
  supabase: ReturnType<typeof createClient>,
  id: string,
): Promise<Response> {
  try {
    if (!id) return errorResponse('Missing prompt ID');

    const { data, error } = await supabase
      .from('ai_prompts')
      .select(
        `
        *,
        segment:segment_id(id, name),
        geography:geography_id(id, name)
      `,
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return errorResponse('Prompt not found', 404);

    return jsonResponse<ApiResponse<AIPromptWithRelations>>({
      success: true,
      data: data as AIPromptWithRelations,
    });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch prompt',
      500,
    );
  }
}

async function handleCreate(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  userId: string,
): Promise<Response> {
  try {
    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return errorResponse('Missing or invalid name');
    }
    if (!body.prompt_template || typeof body.prompt_template !== 'string') {
      return errorResponse('Missing or invalid prompt_template');
    }
    if (!body.search_depth || typeof body.search_depth !== 'string') {
      return errorResponse('Missing or invalid search_depth');
    }

    const { data, error } = await supabase
      .from('ai_prompts')
      .insert({
        name: body.name,
        description: body.description || null,
        prompt_template: body.prompt_template,
        search_type: body.search_type || null,
        search_depth: body.search_depth,
        is_active: body.is_active === false ? false : true,
        segment_id: body.segment_id || null,
        geography_id: body.geography_id || null,
        created_by: userId,
      })
      .select(
        `
        *,
        segment:segment_id(id, name),
        geography:geography_id(id, name)
      `,
      )
      .single();

    if (error) throw error;

    return jsonResponse<ApiResponse<AIPromptWithRelations>>(
      {
        success: true,
        data: data as AIPromptWithRelations,
      },
      201,
    );
  } catch (error) {
    console.error('Error creating prompt:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to create prompt',
      500,
    );
  }
}

async function handleUpdate(
  supabase: ReturnType<typeof createClient>,
  id: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    if (!id) return errorResponse('Missing prompt ID');

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.prompt_template !== undefined) updateData.prompt_template = body.prompt_template;
    if (body.search_type !== undefined) updateData.search_type = body.search_type;
    if (body.search_depth !== undefined) updateData.search_depth = body.search_depth;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.segment_id !== undefined) updateData.segment_id = body.segment_id;
    if (body.geography_id !== undefined) updateData.geography_id = body.geography_id;

    if (Object.keys(updateData).length === 0) {
      return errorResponse('No fields to update');
    }

    const { data, error } = await supabase
      .from('ai_prompts')
      .update(updateData)
      .eq('id', id)
      .select(
        `
        *,
        segment:segment_id(id, name),
        geography:geography_id(id, name)
      `,
      )
      .single();

    if (error) throw error;
    if (!data) return errorResponse('Prompt not found', 404);

    return jsonResponse<ApiResponse<AIPromptWithRelations>>({
      success: true,
      data: data as AIPromptWithRelations,
    });
  } catch (error) {
    console.error('Error updating prompt:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to update prompt',
      500,
    );
  }
}

async function handleDelete(
  supabase: ReturnType<typeof createClient>,
  id: string,
): Promise<Response> {
  try {
    if (!id) return errorResponse('Missing prompt ID');

    const { error } = await supabase
      .from('ai_prompts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return jsonResponse<ApiResponse<{ id: string }>>({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to delete prompt',
      500,
    );
  }
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsHeaders['Access-Control-Allow-Origin'],
        'Access-Control-Allow-Methods': corsHeaders['Access-Control-Allow-Methods'],
        'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'],
      },
    });
  }

  try {
    const url = new URL(req.url);
    const method = req.method;

    // Initialize Supabase client
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return errorResponse('Missing authorization token', 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );

    // Verify user is authenticated
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return errorResponse('Unauthorized', 401);
    }

    const userId = authData.user.id;

    // Route requests
    if (method === 'GET') {
      const id = url.searchParams.get('id');
      return id ? handleGetSingle(supabase, id) : handleGetList(supabase, url);
    }

    if (method === 'POST') {
      // Check admin role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role !== 'admin') {
        return errorResponse('Forbidden: Admin access required', 403);
      }

      const body = await req.json();
      return handleCreate(supabase, body, userId);
    }

    if (method === 'PATCH') {
      // Check admin role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role !== 'admin') {
        return errorResponse('Forbidden: Admin access required', 403);
      }

      const id = url.searchParams.get('id');
      const body = await req.json();
      return handleUpdate(supabase, id || '', body);
    }

    if (method === 'DELETE') {
      // Check admin role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role !== 'admin') {
        return errorResponse('Forbidden: Admin access required', 403);
      }

      const id = url.searchParams.get('id');
      return handleDelete(supabase, id || '');
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Unexpected error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500,
    );
  }
});
