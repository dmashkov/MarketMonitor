/**
 * Source Hunter Agent
 *
 * Автоматический поиск новых документов через Perplexity AI
 * - Загружает список доступных источников
 * - Генерирует search queries через OpenAI (gpt-4o-mini)
 * - Выполняет РЕАЛЬНЫЙ поиск через Perplexity API с web search
 * - Создает документы в БД с реальными URLs
 * - Сохраняет найденные URLs для дальнейшей обработки Content Fetcher
 * - Rate limiting: 1000 запросов/день MAX (защита от превышения бюджета)
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
      .select('id, name, source_type_id, website_url, telegram_channel, priority')
      .eq('is_active', true);

    // NOTE: source_segments and source_geographies tables don't exist in current schema
    // For now, ignore segment and geography filters and return all active sources
    // TODO: Create source_segments and source_geographies tables in future migration

    // Если указаны сегменты, фильтруем по связи source_segments
    // Currently disabled: source_segments table doesn't exist
    // if (segment_ids && segment_ids.length > 0) {
    //   const { data: sourceIds } = await supabase
    //     .from('source_segments')
    //     .select('source_id')
    //     .in('segment_id', segment_ids);
    //
    //   if (sourceIds && sourceIds.length > 0) {
    //     const ids = sourceIds.map((x) => x.source_id);
    //     query = query.in('id', ids);
    //   }
    // }

    // Если указана география, фильтруем по связи source_geographies
    // Currently disabled: source_geographies table doesn't exist
    // if (geography_ids && geography_ids.length > 0) {
    //   const { data: sourceIds } = await supabase
    //     .from('source_geographies')
    //     .select('source_id')
    //     .in('geography_id', geography_ids);
    //
    //   if (sourceIds && sourceIds.length > 0) {
    //     const ids = sourceIds.map((x) => x.source_id);
    //     query = query.in('id', ids);
    //   }
    // }

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
 * Проверить лимит Perplexity API (1000 запросов/день)
 */
async function canMakePerplexitySearch(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_make_perplexity_search');

    if (error) {
      console.error('Error checking Perplexity limit:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Failed to check Perplexity limit:', error);
    return false;
  }
}

/**
 * Инкрементировать счетчик использования Perplexity API
 */
async function incrementPerplexityUsage(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('increment_perplexity_usage');

    if (error) {
      console.error('Error incrementing Perplexity usage:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Failed to increment Perplexity usage:', error);
    return 0;
  }
}

/**
 * Выполнить РЕАЛЬНЫЙ поиск через Perplexity API
 */
async function searchDocuments(query: string, source: SearchSource): Promise<SearchResult[]> {
  const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

  if (!perplexityApiKey) {
    throw new Error('Missing PERPLEXITY_API_KEY environment variable');
  }

  // Проверяем лимит запросов
  const canSearch = await canMakePerplexitySearch();
  if (!canSearch) {
    console.warn(`⚠️ Perplexity API daily limit reached (1000/1000). Skipping search for ${source.name}`);
    return [];
  }

  // Формируем поисковый запрос с контекстом источника
  const searchPrompt = `
Search for: ${query}

Focus on content from: ${source.website_url || source.name}
${source.telegram_channel ? `Also check Telegram channel: ${source.telegram_channel}` : ''}

Find recent news, articles, or announcements related to HVAC equipment, climate control, and air conditioning market in Russia.

Return only real, verifiable sources with actual URLs.
  `.trim();

  console.log(`🔍 Searching via Perplexity API: "${query}" for ${source.name}`);

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful research assistant that finds recent news articles and returns structured data with real URLs.',
          },
          {
            role: 'user',
            content: searchPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
        return_citations: true,
        search_recency_filter: 'week', // Last week only
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Increment usage counter
    const newCount = await incrementPerplexityUsage();
    console.log(`📊 Perplexity API usage: ${newCount}/1000 today`);

    // Extract citations (URLs) from Perplexity response
    const citations = data.citations || [];
    const message = data.choices?.[0]?.message?.content || '';

    console.log(`✅ Perplexity found ${citations.length} citations for ${source.name}`);

    // 🔍 DETAILED LOGGING: Log full Perplexity response for debugging
    console.log('📋 PERPLEXITY RESPONSE DETAILS:');
    console.log(`   Source: ${source.name}`);
    console.log(`   Query: ${query}`);
    console.log(`   Model: sonar`);
    console.log(`   Citations count: ${citations.length}`);

    if (citations.length > 0) {
      console.log('   📎 Citations (URLs):');
      citations.forEach((url: string, idx: number) => {
        console.log(`      ${idx + 1}. ${url}`);
      });
    } else {
      console.warn('   ⚠️ NO CITATIONS returned by Perplexity!');
    }

    console.log(`   📝 Message preview: ${message.substring(0, 200)}...`);
    console.log(`   🔗 Full response structure:`, JSON.stringify({
      choices_count: data.choices?.length || 0,
      citations_count: citations.length,
      has_message: !!message,
      model: data.model,
      usage: data.usage,
    }, null, 2));

    // Parse citations into SearchResults
    const results: SearchResult[] = citations.map((url: string, index: number) => {
      // Extract domain-specific title from the message or use generic
      const titleMatch = message.match(new RegExp(`([^.]+).*?${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      const title = titleMatch?.[1]?.trim() || `${source.name} - Article ${index + 1}`;

      return {
        title: title.substring(0, 200), // Limit title length
        url: url,
        snippet: message.substring(0, 300), // First 300 chars as snippet
      };
    });

    return results;
  } catch (error) {
    console.error(`❌ Perplexity search failed for ${source.name}:`, error);
    throw error;
  }
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
    const documentIds: string[] = [];
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
            documentIds.push(docId);
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
        document_ids: documentIds,
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
