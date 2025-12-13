/**
 * Source Hunter Agent
 *
 * Автоматический поиск новых документов по промптам
 * - Загружает список доступных источников
 * - Генерирует search queries через OpenAI
 * - Выполняет поиск и создает документы в БД
 * - Сохраняет найденные URLs для дальнейшей обработки
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { SourceHunterRequest, SourceHunterResponse, SearchSource, SearchResult } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// Helpers
// ============================================================================

/**
 * Загрузить список доступных источников для поиска
 */
async function getSearchSources(
  segment_ids?: string[],
  geography_ids?: string[]
): Promise<SearchSource[]> {
  try {
    let query = supabase
      .from('sources')
      .select('id, name, type, website, telegram, priority')
      .eq('is_active', true);

    // Если указаны сегменты, фильтруем по связи source_segments
    if (segment_ids && segment_ids.length > 0) {
      const { data: sourceIds } = await supabase
        .from('source_segments')
        .select('source_id')
        .in('segment_id', segment_ids);

      if (sourceIds && sourceIds.length > 0) {
        const ids = sourceIds.map((x) => x.source_id);
        query = query.in('id', ids);
      }
    }

    // Если указана география, фильтруем по связи source_geographies
    if (geography_ids && geography_ids.length > 0) {
      const { data: sourceIds } = await supabase
        .from('source_geographies')
        .select('source_id')
        .in('geography_id', geography_ids);

      if (sourceIds && sourceIds.length > 0) {
        const ids = sourceIds.map((x) => x.source_id);
        query = query.in('id', ids);
      }
    }

    const { data, error } = await query.order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching sources:', error);
      return [];
    }

    return (data as SearchSource[]) || [];
  } catch (error) {
    console.error('Error getting search sources:', error);
    return [];
  }
}

/**
 * Генерировать search queries для каждого источника через OpenAI
 */
async function generateSearchQueries(prompt: string, sources: SearchSource[]): Promise<Map<string, string>> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const sourceNames = sources.map((s) => s.name).join(', ');

  const systemPrompt = `Вы помощник по генерации search queries для поиска рыночных событий на климатическом рынке России.

Вам даны:
1. Основной промпт пользователя
2. Список доступных источников

Ваша задача: для каждого источника сгенерировать оптимальный search query.

Правила:
- Queries должны быть на русском языке
- Включать ключевые слова из промпта
- Быть релевантными для конкретного источника
- Максимально специфичные (не общие)

Ответ: JSON объект {
  "source_name_1": "search query 1",
  "source_name_2": "search query 2"
}`;

  const userPrompt = `Основной промпт: "${prompt}"

Доступные источники: ${sourceNames}

Сгенерируй оптимальные search queries для каждого источника.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON in OpenAI response');
    }

    const queries = JSON.parse(jsonMatch[0]);
    const result = new Map<string, string>();

    sources.forEach((source) => {
      const query = queries[source.name];
      if (query) {
        result.set(source.id, query);
      }
    });

    return result;
  } catch (error) {
    console.error('Error generating search queries:', error);
    throw error;
  }
}

/**
 * Выполнить поиск документов (mock implementation)
 *
 * В реальном приложении здесь должна быть интеграция с:
 * - Google Search API
 * - Bing Search API
 * - Web scraping библиотеки
 * - OpenAI Web Search capability
 */
async function searchDocuments(query: string, source: SearchSource): Promise<SearchResult[]> {
  // Mock: возвращаем примерные результаты
  // В реальном приложении здесь будет реальный поиск
  console.log(`[MOCK] Searching for "${query}" on ${source.name}`);

  // Эмулируем задержку сети
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock результаты
  return [
    {
      title: `${source.name}: ${query}`,
      url: `${source.website || 'https://example.com'}/news/${Date.now()}`,
      snippet: `Новость о ${query} на ${source.name}`,
    },
  ];
}

/**
 * Сохранить найденные документы в БД
 */
async function saveDocument(
  title: string,
  url: string,
  sourceId: string,
  documentType: 'webpage' = 'webpage'
): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('documents').insert({
      title,
      document_type: documentType,
      source_url: url,
      file_url: url,
      content_text: `Документ загружен с ${url}`,
      source_id: sourceId,
      published_date: new Date().toISOString(),
      fetched_at: new Date().toISOString(),
    }).select('id').single();

    if (error) {
      console.error('Error saving document:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error saving document:', error);
    return null;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

async function handler(request: Request): Promise<Response> {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate request
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const requestData: SourceHunterRequest = await request.json();

    if (!requestData.prompt || requestData.prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          documents_created: 0,
          urls: [],
          error: 'Missing required parameter: prompt',
        } as SourceHunterResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Starting Source Hunter Agent with prompt:', requestData.prompt);

    // Step 1: Get available sources
    const sources = await getSearchSources(
      requestData.segment_ids,
      requestData.geography_ids
    );

    if (sources.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          documents_created: 0,
          urls: [],
          error: 'No sources found matching the filters',
        } as SourceHunterResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${sources.length} sources`);

    // Step 2: Generate search queries for each source
    const searchQueries = await generateSearchQueries(requestData.prompt, sources);
    console.log(`Generated ${searchQueries.size} search queries`);

    // Step 3: Search documents and save to DB
    const urls: string[] = [];
    let documentsCreated = 0;

    for (const source of sources) {
      const query = searchQueries.get(source.id);
      if (!query) {
        console.log(`No query generated for source: ${source.name}`);
        continue;
      }

      try {
        const results = await searchDocuments(query, source);

        for (const result of results) {
          const docId = await saveDocument(result.title, result.url, source.id);
          if (docId) {
            documentsCreated++;
            urls.push(result.url);
          }
        }
      } catch (error) {
        console.error(`Error searching source ${source.name}:`, error);
        continue;
      }
    }

    console.log(`Successfully created ${documentsCreated} documents`);

    // Return success response
    return new Response(
      JSON.stringify({
        status: 'success',
        documents_created: documentsCreated,
        urls,
        message: `Found and saved ${documentsCreated} documents`,
      } as SourceHunterResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Source Hunter Agent error:', error);

    return new Response(
      JSON.stringify({
        status: 'error',
        documents_created: 0,
        urls: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      } as SourceHunterResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handler);
