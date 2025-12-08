/**
 * Edge Function: documents-api
 *
 * CRUD операции для управления документами
 *
 * Endpoints:
 * - GET    /documents              - список всех документов (с фильтрами)
 * - GET    /documents/:id          - детали документа (с related данными)
 * - POST   /documents              - создать документ (upload файла)
 * - POST   /documents/search       - семантический поиск через embeddings
 * - DELETE /documents/:id          - удалить документ (admin + owner)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS Headers (встроено, т.к. Supabase не поддерживает ../_shared/ при деплое)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

// Типы (соответствуют frontend/src/shared/types/index.ts и migration 007)
type DocumentType = 'pdf' | 'docx' | 'pptx' | 'html' | 'webpage';

interface Document {
  id: string;
  title: string;
  description: string | null;
  document_type: DocumentType;

  // Контент
  content_text: string | null;
  content_html: string | null;
  file_url: string | null;
  source_url: string | null;

  // Метаданные
  source_id: string | null;
  published_date: string | null;
  fetched_at: string;

  // Mentions
  brand_ids: string[] | null;
  segment_ids: string[] | null;
  geography_ids: string[] | null;

  // Embeddings
  embedding: number[] | null;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface DocumentWithRelations extends Document {
  source?: {
    id: string;
    name: string;
  } | null;
  brands?: Array<{
    id: string;
    name: string;
  }>;
  segments?: Array<{
    id: string;
    name: string;
  }>;
  geographies?: Array<{
    id: string;
    name: string;
  }>;
}

interface CreateDocumentRequest {
  title: string;
  description?: string;
  document_type: DocumentType;
  content_text?: string;
  content_html?: string;
  file_url?: string;
  source_url?: string;
  source_id?: string;
  published_date?: string;
  brand_ids?: string[];
  segment_ids?: string[];
  geography_ids?: string[];
}

interface SemanticSearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    // ========================================
    // GET /documents - Список всех документов
    // ========================================
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] === 'documents') {
      // Фильтры из query params
      const document_type = url.searchParams.get('document_type');
      const source_id = url.searchParams.get('source_id');
      const date_from = url.searchParams.get('date_from');
      const date_to = url.searchParams.get('date_to');
      const search = url.searchParams.get('search'); // Full-text search

      // Pagination
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      let query = supabaseClient
        .from('documents')
        .select('*', { count: 'exact' });

      // Применяем фильтры
      if (document_type) {
        query = query.eq('document_type', document_type);
      }
      if (source_id) {
        query = query.eq('source_id', source_id);
      }
      if (date_from) {
        query = query.gte('published_date', date_from);
      }
      if (date_to) {
        query = query.lte('published_date', date_to);
      }
      if (search) {
        // Full-text search по content_text
        query = query.textSearch('content_text', search);
      }

      // Pagination
      query = query
        .order('published_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: documents, error: docsError, count } = await query;

      if (docsError) {
        throw docsError;
      }

      return new Response(
        JSON.stringify({
          data: documents,
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
    // GET /documents/:id - Детали документа
    // ========================================
    if (method === 'GET' && pathParts.length === 2 && pathParts[0] === 'documents') {
      const documentId = pathParts[1];

      const { data: document, error: docError } = await supabaseClient
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return new Response(
          JSON.stringify({ error: 'Document not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      // Получаем related данные (source, brands, segments, geographies)
      const documentWithRelations: DocumentWithRelations = { ...document };

      // Source
      if (document.source_id) {
        const { data: source } = await supabaseClient
          .from('sources')
          .select('id, name')
          .eq('id', document.source_id)
          .single();
        documentWithRelations.source = source;
      }

      // Brands
      if (document.brand_ids && document.brand_ids.length > 0) {
        const { data: brands } = await supabaseClient
          .from('brands')
          .select('id, name')
          .in('id', document.brand_ids);
        documentWithRelations.brands = brands || [];
      }

      // Segments
      if (document.segment_ids && document.segment_ids.length > 0) {
        const { data: segments } = await supabaseClient
          .from('segments')
          .select('id, name')
          .in('id', document.segment_ids);
        documentWithRelations.segments = segments || [];
      }

      // Geographies
      if (document.geography_ids && document.geography_ids.length > 0) {
        const { data: geographies } = await supabaseClient
          .from('geographies')
          .select('id, name')
          .in('id', document.geography_ids);
        documentWithRelations.geographies = geographies || [];
      }

      return new Response(
        JSON.stringify({ data: documentWithRelations }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // POST /documents - Создать документ
    // ========================================
    if (method === 'POST' && pathParts.length === 1 && pathParts[0] === 'documents') {
      const body: CreateDocumentRequest = await req.json();

      // Валидация
      if (!body.title) {
        return new Response(
          JSON.stringify({ error: 'Field "title" is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      if (!body.document_type || !['pdf', 'docx', 'pptx', 'html', 'webpage'].includes(body.document_type)) {
        return new Response(
          JSON.stringify({ error: 'Invalid document_type (must be: pdf, docx, pptx, html, webpage)' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Создаем embedding если есть content_text
      let embedding: number[] | null = null;
      if (body.content_text && body.content_text.trim().length > 0) {
        try {
          const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
          if (!openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured');
          }

          // Вызов OpenAI Embeddings API
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: body.content_text.substring(0, 8000), // Ограничим длину
            }),
          });

          if (!embeddingResponse.ok) {
            const errorText = await embeddingResponse.text();
            console.error('OpenAI API error:', errorText);
            throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
          }

          const embeddingData = await embeddingResponse.json();
          embedding = embeddingData.data[0].embedding;
        } catch (error) {
          console.error('Error generating embedding:', error);
          // Не фейлим весь запрос, просто не добавляем embedding
        }
      }

      // Создаем документ
      const { data: newDocument, error: createError } = await supabaseClient
        .from('documents')
        .insert({
          title: body.title,
          description: body.description || null,
          document_type: body.document_type,
          content_text: body.content_text || null,
          content_html: body.content_html || null,
          file_url: body.file_url || null,
          source_url: body.source_url || null,
          source_id: body.source_id || null,
          published_date: body.published_date || null,
          brand_ids: body.brand_ids || null,
          segment_ids: body.segment_ids || null,
          geography_ids: body.geography_ids || null,
          embedding: embedding ? `[${embedding.join(',')}]` : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return new Response(
        JSON.stringify({ data: newDocument, message: 'Document created successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201,
        }
      );
    }

    // ========================================
    // POST /documents/search - Семантический поиск
    // ========================================
    if (method === 'POST' && pathParts.length === 2 && pathParts[0] === 'documents' && pathParts[1] === 'search') {
      const body: SemanticSearchRequest = await req.json();

      if (!body.query || body.query.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Field "query" is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      const limit = body.limit || 10;
      const threshold = body.threshold || 0.7;

      // Генерируем embedding для query
      let queryEmbedding: number[];
      try {
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
          throw new Error('OPENAI_API_KEY not configured');
        }

        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: body.query,
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
        }

        const embeddingData = await embeddingResponse.json();
        queryEmbedding = embeddingData.data[0].embedding;
      } catch (error) {
        console.error('Error generating query embedding:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate query embedding' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }

      // Поиск через cosine similarity
      // SQL: SELECT *, 1 - (embedding <=> $embedding) as similarity
      const { data: results, error: searchError } = await supabaseClient
        .rpc('search_documents_by_embedding', {
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit,
        });

      if (searchError) {
        console.error('Search error:', searchError);
        // Если RPC функция не существует, возвращаем пустой результат
        return new Response(
          JSON.stringify({
            data: [],
            message: 'Semantic search function not available. Please create RPC function in database.'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      return new Response(
        JSON.stringify({ data: results || [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // ========================================
    // DELETE /documents/:id - Удалить документ (admin + owner)
    // ========================================
    if (method === 'DELETE' && pathParts.length === 2 && pathParts[0] === 'documents') {
      const documentId = pathParts[1];

      // Проверяем существование документа
      const { data: existingDoc } = await supabaseClient
        .from('documents')
        .select('id, created_by, file_url')
        .eq('id', documentId)
        .single();

      if (!existingDoc) {
        return new Response(
          JSON.stringify({ error: 'Document not found' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          }
        );
      }

      // Проверка прав: admin ИЛИ owner
      if (!isAdmin && existingDoc.created_by !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Only admins or document owner can delete' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      // TODO: Удалить файл из Supabase Storage если есть file_url
      // if (existingDoc.file_url) {
      //   await supabaseClient.storage
      //     .from('market-documents')
      //     .remove([extractPathFromUrl(existingDoc.file_url)]);
      // }

      // Удаляем из БД
      const { error: deleteError } = await supabaseClient
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(
        JSON.stringify({ message: 'Document deleted successfully' }),
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
    console.error('documents-api error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
