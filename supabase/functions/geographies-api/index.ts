/**
 * Geographies API Edge Function
 *
 * API для работы с географическими зонами
 * - GET /geographies - список всех зон (с фильтрами по type, parent_id)
 * - GET /geographies/:id - получить зону по ID
 * - GET /geographies/:id/children - получить дочерние зоны
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// TYPES
// ============================================================================

type GeographyType = 'country' | 'region' | 'city';

interface Geography {
  id: string;
  name: string;
  code: string;
  type: GeographyType;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GeographyWithParent extends Geography {
  parent?: Geography | null;
}

interface GeographyWithChildren extends Geography {
  children?: Geography[];
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
 * CORS headers
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
 * GET /geographies - Получить список всех зон
 * Query params: type (country/region/city), parent_id
 */
async function handleGetGeographies(
  supabase: ReturnType<typeof createClient>,
  url: URL
): Promise<Response> {
  try {
    const type = url.searchParams.get('type') as GeographyType | null;
    const parentId = url.searchParams.get('parent_id');

    // Build query
    let query = supabase
      .from('geographies')
      .select('*');

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    // Order by type, then by name
    query = query.order('type', { ascending: true }).order('name', { ascending: true });

    // Execute query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching geographies:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as Geography[]);
  } catch (err) {
    console.error('Unexpected error in handleGetGeographies:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /geographies/:id - Получить зону по ID с родительской зоной
 */
async function handleGetGeographyById(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('geographies')
      .select('*, parent:geographies!parent_id(*)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Geography not found', 404);
      }
      console.error('Error fetching geography:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as GeographyWithParent);
  } catch (err) {
    console.error('Unexpected error in handleGetGeographyById:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /geographies/:id/children - Получить дочерние зоны
 */
async function handleGetGeographyChildren(
  supabase: ReturnType<typeof createClient>,
  id: string
): Promise<Response> {
  try {
    // First, verify parent exists
    const { data: parent, error: parentError } = await supabase
      .from('geographies')
      .select('id')
      .eq('id', id)
      .single();

    if (parentError || !parent) {
      return errorResponse('Parent geography not found', 404);
    }

    // Get children
    const { data, error } = await supabase
      .from('geographies')
      .select('*')
      .eq('parent_id', id)
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching geography children:', error);
      return errorResponse(error.message, 500);
    }

    return successResponse(data as Geography[]);
  } catch (err) {
    console.error('Unexpected error in handleGetGeographyChildren:', err);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /geographies/tree - Получить иерархическое дерево (BONUS)
 * Возвращает страну -> регионы -> города в виде дерева
 */
async function handleGetGeographyTree(
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  try {
    // Get all geographies
    const { data, error } = await supabase
      .from('geographies')
      .select('*')
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching geographies for tree:', error);
      return errorResponse(error.message, 500);
    }

    // Build tree structure
    const geographies = data as Geography[];
    const tree: GeographyWithChildren[] = [];
    const lookup: Map<string, GeographyWithChildren> = new Map();

    // First pass: create lookup map
    geographies.forEach((geo) => {
      lookup.set(geo.id, { ...geo, children: [] });
    });

    // Second pass: build tree
    geographies.forEach((geo) => {
      const node = lookup.get(geo.id)!;
      if (geo.parent_id) {
        const parent = lookup.get(geo.parent_id);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else {
        // Root node (country)
        tree.push(node);
      }
    });

    return successResponse(tree);
  } catch (err) {
    console.error('Unexpected error in handleGetGeographyTree:', err);
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

    // Route handling (GET only)
    const method = req.method;

    if (method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    // GET /geographies
    if (pathParts.length === 0) {
      return await handleGetGeographies(supabase, url);
    }

    // GET /geographies/tree (special route)
    if (pathParts.length === 1 && pathParts[0] === 'tree') {
      return await handleGetGeographyTree(supabase);
    }

    // GET /geographies/:id or GET /geographies/:id/children
    if (pathParts.length === 1) {
      // GET /geographies/:id
      const id = pathParts[0];
      return await handleGetGeographyById(supabase, id);
    } else if (pathParts.length === 2 && pathParts[1] === 'children') {
      // GET /geographies/:id/children
      const id = pathParts[0];
      return await handleGetGeographyChildren(supabase, id);
    }

    return errorResponse('Invalid path', 404);
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse('Internal server error', 500);
  }
});
