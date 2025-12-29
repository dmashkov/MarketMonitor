/**
 * Source Hunter Agent V2
 *
 * Scope-Aware + Segment-Aware query generation для focused search
 *
 * V2 FEATURES:
 * - Priority-based source filtering (5=HIGH, 3=MEDIUM, 2=LOW)
 * - Segment-aware focused queries (segment × source matrix)
 * - Segment linking via document_segments table
 * - Configurable max_sources_per_run
 *
 * WORKFLOW:
 * - Загружает высокоприоритетные источники (min_source_priority)
 * - Загружает сегменты для focused query generation
 * - Генерирует segment-aware queries через OpenAI (gpt-4o-mini)
 * - Выполняет РЕАЛЬНЫЙ поиск через Perplexity API с web search
 * - Создает документы в БД с реальными URLs + segment links
 * - Rate limiting: 1000 запросов/день MAX (защита от превышения бюджета)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { SourceHunterRequest, SourceHunterResponse, SearchSource, SearchResult, Segment } from './types.ts';

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
 * V2: С фильтрацией по приоритету source_type
 */
async function getSearchSources(
  segment_ids?: string[],
  geography_ids?: string[],
  min_priority: number = 1,      // NEW: Filter by source_type priority
  max_sources: number = 20        // NEW: Limit number of sources
): Promise<SearchSource[]> {
  try {
    let query = supabase
      .from('sources')
      .select('id, name, source_type_id, website_url, telegram_channel, priority, source_types!inner(priority)')
      .eq('is_active', true)
      .gte('source_types.priority', min_priority)  // NEW: Filter by source_type priority
      .order('source_types.priority', { ascending: false })
      .limit(max_sources);  // NEW: Limit results

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

    const { data, error } = await query;

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
 * Загрузить сегменты для focused query generation
 * V2: NEW function
 */
async function getSegments(segment_ids: string[]): Promise<Segment[]> {
  if (!segment_ids || segment_ids.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('segments')
      .select('id, code, name, description')
      .in('id', segment_ids);

    if (error) {
      console.error('Error fetching segments:', error);
      return [];
    }

    return (data as Segment[]) || [];
  } catch (error) {
    console.error('Error getting segments:', error);
    return [];
  }
}

/**
 * Генерировать segment-aware search queries
 * V2: KEY FEATURE - Focused queries per segment × source
 */
async function generateSegmentAwareQueries(
  basePrompt: string,
  sources: SearchSource[],
  segments: Segment[]
): Promise<Map<string, Map<string, string>>> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const result = new Map<string, Map<string, string>>();

  console.log(`🧠 Generating segment-aware queries for ${segments.length} segments × ${sources.length} sources`);

  // Для каждого сегмента генерируем focused queries
  for (const segment of segments) {
    const sourceNames = sources.map((s) => s.name).join(', ');

    const systemPrompt = `Вы помощник по генерации search queries для поиска событий на рынке климатического оборудования.

Правила:
- Queries на русском языке
- Включать ключевые слова из базового промпта
- Быть релевантными для КОНКРЕТНОГО сегмента
- Быть релевантными для КОНКРЕТНОГО источника
- Максимально специфичные (не общие)

Ответ: JSON объект {
  "source_name_1": "focused query 1",
  "source_name_2": "focused query 2"
}`;

    const userPrompt = `Базовый промпт: "${basePrompt}"

Сегмент: ${segment.name} (${segment.code})
Описание: ${segment.description || ''}

Доступные источники: ${sourceNames}

Сгенерируй оптимальные search queries для каждого источника С УЧЕТОМ СЕГМЕНТА "${segment.name}".`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',  // Дешевая модель
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
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
        console.error(`❌ Invalid JSON in OpenAI response for segment ${segment.name}:`, content);
        continue;
      }

      const queries = JSON.parse(jsonMatch[0]);
      const segmentQueries = new Map<string, string>();

      sources.forEach((source) => {
        const query = queries[source.name];
        if (query) {
          segmentQueries.set(source.id, query);
        }
      });

      result.set(segment.id, segmentQueries);
      console.log(`✅ Generated ${segmentQueries.size} queries for segment: ${segment.name}`);
    } catch (error) {
      console.error(`❌ Error generating queries for segment ${segment.name}:`, error);
      continue;
    }
  }

  return result;
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
 * Сохранить найденные документы в БД с segment linking
 * V2: NEW - Adds segment linking to document_segments table
 */
async function saveDocumentWithSegment(
  title: string,
  url: string,
  sourceId: string,
  segmentId: string,
  documentType: 'webpage' = 'webpage'
): Promise<string | null> {
  try {
    // 1. Создать документ
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        document_type: documentType,
        source_url: url,
        file_url: url,
        content_text: `Документ загружен с ${url}`,
        source_id: sourceId,
        published_date: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (docError || !doc) {
      console.error('Error saving document:', docError);
      return null;
    }

    // 2. Создать linking с сегментом
    const { error: linkError } = await supabase
      .from('document_segments')
      .insert({
        document_id: doc.id,
        segment_id: segmentId,
      });

    if (linkError) {
      console.error('Error linking document to segment:', linkError);
      // НЕ фейлим - документ уже создан
    }

    return doc.id;
  } catch (error) {
    console.error('Error saving document with segment:', error);
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

    console.log('Starting Source Hunter V2 Agent with:', {
      prompt: requestData.prompt.substring(0, 50),
      segments: requestData.segment_ids?.length || 0,
      min_priority: requestData.min_source_priority || 1,
      max_sources: requestData.max_sources_per_run || 20,
    });

    // Step 1: Get sources (filtered by priority)
    const sources = await getSearchSources(
      requestData.segment_ids,
      requestData.geography_ids,
      requestData.min_source_priority || 1,
      requestData.max_sources_per_run || 20
    );

    if (sources.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          documents_created: 0,
          urls: [],
          error: 'No high-priority sources found',
        } as SourceHunterResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Found ${sources.length} high-priority sources`);

    // Step 2: Get segments
    // If no segment_ids provided, load ALL active segments
    let segments: Segment[];
    if (!requestData.segment_ids || requestData.segment_ids.length === 0) {
      console.log('⚠️ No segment_ids specified, loading ALL active segments');
      const { data, error } = await supabase
        .from('segments')
        .select('id, code, name, description')
        .eq('is_active', true);

      if (error || !data) {
        console.error('Error loading all segments:', error);
        return new Response(
          JSON.stringify({
            status: 'error',
            documents_created: 0,
            urls: [],
            error: 'Failed to load segments',
          } as SourceHunterResponse),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      segments = data as Segment[];
    } else {
      segments = await getSegments(requestData.segment_ids);
    }

    if (segments.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          documents_created: 0,
          urls: [],
          error: 'No active segments found',
        } as SourceHunterResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✅ Loaded ${segments.length} segments`);

    // Step 3: Generate segment-aware queries
    const allQueries = await generateSegmentAwareQueries(
      requestData.prompt,
      sources,
      segments
    );

    console.log(`✅ Generated queries for ${allQueries.size} segments`);

    // Step 4: Search and save (для каждого segment × source)
    const urls: string[] = [];
    const documentIds: string[] = [];
    let documentsCreated = 0;

    for (const segment of segments) {
      const segmentQueries = allQueries.get(segment.id);
      if (!segmentQueries) {
        console.log(`⚠️ No queries generated for segment: ${segment.name}`);
        continue;
      }

      for (const source of sources) {
        const query = segmentQueries.get(source.id);
        if (!query) {
          continue;
        }

        try {
          console.log(`🔍 Searching: ${segment.name} @ ${source.name}`);
          const results = await searchDocuments(query, source);

          for (const result of results) {
            const docId = await saveDocumentWithSegment(
              result.title,
              result.url,
              source.id,
              segment.id  // NEW: сохраняем segment linking
            );

            if (docId) {
              documentsCreated++;
              urls.push(result.url);
              documentIds.push(docId);
            }
          }
        } catch (error) {
          console.error(`❌ Error searching ${segment.name} @ ${source.name}:`, error);
          continue;
        }
      }
    }

    console.log(`✅ Successfully created ${documentsCreated} documents across ${segments.length} segments`);

    // Return success response
    return new Response(
      JSON.stringify({
        status: 'success',
        documents_created: documentsCreated,
        document_ids: documentIds,
        urls,
        message: `Found and saved ${documentsCreated} documents across ${segments.length} segments`,
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
