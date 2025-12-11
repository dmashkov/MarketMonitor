/**
 * Edge Function: brands-api
 *
 * CRUD операции для управления брендами
 *
 * Endpoints:
 * - GET    /brands              - список всех брендов (с фильтрами)
 * - GET    /brands/:id          - детали бренда (с сегментами)
 * - POST   /brands              - создать бренд (admin only)
 * - PATCH  /brands/:id          - обновить бренд (admin only)
 * - DELETE /brands/:id          - удалить бренд (admin only)
 * - POST   /brands/:id/segments - добавить сегмент к бренду (admin only)
 * - DELETE /brands/:id/segments/:segment_id - удалить сегмент (admin only)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS Headers (встроено, т.к. Supabase не поддерживает ../_shared/ при деплое)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Типы (соответствуют frontend/src/shared/types/index.ts)
type BrandCategory = 'premium' | 'middle' | 'budget';

interface Brand {
  id: string;
  name: string;
  manufacturer: string | null;
  country: string | null;
  category: BrandCategory;
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface BrandWithSegments extends Brand {
  segments?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
}

interface CreateBrandRequest {
  name: string;
  manufacturer?: string;
  country?: string;
  category: BrandCategory;
  website_url?: string;
  logo_url?: string;
  description?: string;
  is_active?: boolean;
  segment_ids?: string[];
}

interface UpdateBrandRequest extends Partial<CreateBrandRequest> {}

serve(async (req) => {
  // ⚠️ ВАЖНО: OPTIONS должен быть ПЕРВЫМ!
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Инициализация Supabase клиента
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Проверка аутентификации
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Получить профиль пользователя для проверки роли
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    // Парсинг URL и метода
    const url = new URL(req.url);
    const fullPath = url.pathname.split('/').filter(Boolean);

    // КРИТИЧНО: Убираем название функции из path
    // url.pathname = '/brands-api/brands' → pathParts = ['brands']
    // url.pathname = '/brands-api/brands/123' → pathParts = ['brands', '123']
    const pathParts = fullPath.slice(1);

    const method = req.method;

    // ========================================
    // GET /brands-api - Список всех брендов
    // ========================================
    if (method === 'GET' && pathParts.length === 0) {
      // Фильтры из query params
      const category = url.searchParams.get('category');
      const country = url.searchParams.get('country');
      const is_active = url.searchParams.get('is_active');
      const search = url.searchParams.get('search'); // Поиск по названию
      const include_segments = url.searchParams.get('include_segments') === 'true';

      // Pagination
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = supabaseClient
        .from('brands')
        .select('*', { count: 'exact' });

      // Применяем фильтры
      if (category) {
        query = query.eq('category', category);
      }
      if (country) {
        query = query.eq('country', country);
      }
      if (is_active !== null) {
        query = query.eq('is_active', is_active === 'true');
      }
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      // Pagination
      query = query
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data: brands, error: brandsError, count } = await query;

      if (brandsError) {
        throw brandsError;
      }

      // Если нужно подгрузить сегменты
      let brandsWithSegments: BrandWithSegments[] = brands || [];

      if (include_segments && brands && brands.length > 0) {
        const brandIds = brands.map(b => b.id);

        // Получаем связи brand_segments
        const { data: brandSegments } = await supabaseClient
          .from('brand_segments')
          .select('brand_id, segment:segments(id, name, code)')
          .in('brand_id', brandIds);

        // Группируем сегменты по brand_id
        const segmentsByBrand = new Map<string, Array<any>>();
        brandSegments?.forEach((bs: any) => {
          if (!segmentsByBrand.has(bs.brand_id)) {
            segmentsByBrand.set(bs.brand_id, []);
          }
          segmentsByBrand.get(bs.brand_id)!.push(bs.segment);
        });

        brandsWithSegments = brands.map(brand => ({
          ...brand,
          segments: segmentsByBrand.get(brand.id) || [],
        }));
      }

      return new Response(
        JSON.stringify({
          data: brandsWithSegments,
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
    // GET /brands-api/:id - Детали бренда
    // ========================================
    if (method === 'GET' && pathParts.length === 1) {
      const brandId = pathParts[0];

      const { data: brand, error: brandError } = await supabaseClient
        .from('brands')
        .select('*')
        .eq('id', brandId)
        .single();

      if (brandError || !brand) {
        return new Response(
          JSON.stringify({ error: 'Brand not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      // Получаем сегменты
      const { data: brandSegments } = await supabaseClient
        .from('brand_segments')
        .select('segment:segments(id, name, code)')
        .eq('brand_id', brandId);

      const segments = brandSegments?.map((bs: any) => bs.segment) || [];

      const brandWithSegments: BrandWithSegments = {
        ...brand,
        segments,
      };

      return new Response(
        JSON.stringify({ data: brandWithSegments }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // POST /brands-api - Создать бренд (admin only)
    // ========================================
    if (method === 'POST' && pathParts.length === 0) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Admin only' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      const body: CreateBrandRequest = await req.json();

      // Валидация
      if (!body.name) {
        return new Response(
          JSON.stringify({ error: 'Field "name" is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      if (!body.category || !['premium', 'middle', 'budget'].includes(body.category)) {
        return new Response(
          JSON.stringify({ error: 'Invalid category (must be: premium, middle, budget)' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Создаем бренд
      const { data: newBrand, error: createError } = await supabaseClient
        .from('brands')
        .insert({
          name: body.name,
          manufacturer: body.manufacturer || null,
          country: body.country || null,
          category: body.category,
          website_url: body.website_url || null,
          logo_url: body.logo_url || null,
          description: body.description || null,
          is_active: body.is_active ?? true,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Создаем связи с сегментами
      if (body.segment_ids && body.segment_ids.length > 0) {
        const brandSegments = body.segment_ids.map(segmentId => ({
          brand_id: newBrand.id,
          segment_id: segmentId,
        }));

        const { error: segmentError } = await supabaseClient
          .from('brand_segments')
          .insert(brandSegments);

        if (segmentError) {
          console.error('Error creating brand_segments:', segmentError);
        }
      }

      return new Response(
        JSON.stringify({ data: newBrand, message: 'Brand created successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        }
      );
    }

    // ========================================
    // PATCH /brands-api/:id - Обновить бренд (admin only)
    // ========================================
    if (method === 'PATCH' && pathParts.length === 1) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Admin only' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      const brandId = pathParts[0];
      const body: UpdateBrandRequest = await req.json();

      // Проверяем существование бренда
      const { data: existingBrand } = await supabaseClient
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .single();

      if (!existingBrand) {
        return new Response(
          JSON.stringify({ error: 'Brand not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      // Обновляем бренд
      const updateData: Partial<Brand> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.manufacturer !== undefined) updateData.manufacturer = body.manufacturer;
      if (body.country !== undefined) updateData.country = body.country;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.website_url !== undefined) updateData.website_url = body.website_url;
      if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const { data: updatedBrand, error: updateError } = await supabaseClient
        .from('brands')
        .update(updateData)
        .eq('id', brandId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Если переданы segment_ids - обновляем связи
      if (body.segment_ids !== undefined) {
        // Удаляем старые связи
        await supabaseClient
          .from('brand_segments')
          .delete()
          .eq('brand_id', brandId);

        // Создаем новые связи
        if (body.segment_ids.length > 0) {
          const brandSegments = body.segment_ids.map(segmentId => ({
            brand_id: brandId,
            segment_id: segmentId,
          }));

          await supabaseClient
            .from('brand_segments')
            .insert(brandSegments);
        }
      }

      return new Response(
        JSON.stringify({ data: updatedBrand, message: 'Brand updated successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // DELETE /brands-api/:id - Удалить бренд (admin only)
    // ========================================
    if (method === 'DELETE' && pathParts.length === 1) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Admin only' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      const brandId = pathParts[0];

      // Проверяем существование
      const { data: existingBrand } = await supabaseClient
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .single();

      if (!existingBrand) {
        return new Response(
          JSON.stringify({ error: 'Brand not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      // Удаляем (CASCADE удалит brand_segments автоматически)
      const { error: deleteError } = await supabaseClient
        .from('brands')
        .delete()
        .eq('id', brandId);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(
        JSON.stringify({ message: 'Brand deleted successfully' }),
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
    console.error('brands-api error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
