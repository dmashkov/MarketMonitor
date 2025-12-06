import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabaseClient.ts';
import type { MarketEvent, SearchRunParams, SearchRunResult } from '../_shared/types.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Create prompt for searching climate market news in Russia
 */
function createSearchPrompt(params: SearchRunParams): string {
  const days = params.days || 7;
  const today = new Date().toISOString().split('T')[0];

  const segmentsFilter = params.segments?.length
    ? `\nФокус на сегментах: ${params.segments.join(', ')}`
    : '';

  const eventTypesFilter = params.event_types?.length
    ? `\nТипы событий: ${params.event_types.join(', ')}`
    : '';

  return `Ты - аналитический AI для мониторинга климатического рынка России.

**КРИТИЧЕСКИ ВАЖНО: ИСПОЛЬЗУЙ WEB SEARCH для поиска РЕАЛЬНЫХ актуальных новостей!**

ЗАДАЧА: Найди последние РЕАЛЬНЫЕ новости и события на климатическом рынке России за последние ${days} дней (с ${new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} по ${today}).${segmentsFilter}${eventTypesFilter}

ИСТОЧНИКИ для поиска (обязательно используй web search):
- https://rusclimate.ru/ (новости дистрибьютора)
- https://www.avok.ru/ (отраслевые новости)
- https://www.kommersant.ru/ (бизнес новости)
- https://www.vedomosti.ru/ (деловые новости)
- https://rbc.ru/ (рыночные новости)
- https://www.midea.ru/ (производитель)
- https://www.gree.ru/ (производитель)
- Telegram каналы климатической отрасли

СЕГМЕНТЫ РЫНКА:
- кондиционеры (бытовые, полупромышленные)
- техника (климатическая техника общего назначения)
- мультизональные_системы (VRV/VRF системы)
- вентиляция (вентиляционное оборудование)
- тепловое_оборудование (котлы, тепловые насосы)
- iot (умные системы управления климатом)
- услуги (монтаж, сервис, проектирование)

ТИПЫ СОБЫТИЙ:
- акция (маркетинговые акции, скидки, бонусы)
- цены (изменение цен, прайс-листы)
- условия_оплаты (кредиты, рассрочки, оплата)
- pr (новости компаний, анонсы, открытия)
- тендер (тендеры, госзакупки)
- соглашение (партнерства, дистрибуция)
- регулирование (законы, стандарты, сертификация)
- маркетплейс (новости маркетплейсов: Ozon, WB)

КАНАЛЫ:
- B2B (для дилеров, дистрибуторов)
- B2G (для госучреждений)
- B2C (для конечных покупателей)

КРИТИЧНОСТЬ (1-5):
- 1: Малозначимое событие
- 2: Локальное событие
- 3: Заметное событие
- 4: Важное событие
- 5: Критическое событие (влияет на весь рынок)

ФОРМАТ ОТВЕТА: JSON массив событий (от 5 до 15 событий):
[
  {
    "date": "YYYY-MM-DD",
    "segment": "один из сегментов выше",
    "geography": "город/регион или null",
    "channel": "B2B | B2G | B2C или null",
    "event_type": "один из типов событий выше",
    "company": "название компании или null",
    "description": "краткое описание события (1-2 предложения)",
    "criticality": 1-5,
    "source_url": "URL источника или null"
  }
]

ТРЕБОВАНИЯ:
- **ОБЯЗАТЕЛЬНО используй web search для поиска актуальных новостей!**
- Только РЕАЛЬНЫЕ события из открытых источников
- **source_url ОБЯЗАТЕЛЕН - ссылка на источник новости**
- Описание на русском языке
- Дата в формате YYYY-MM-DD
- Минимум 5 событий, максимум 15
- Только валидный JSON (без комментариев, без markdown)

**ВАЖНО: Каждое событие ДОЛЖНО иметь реальную ссылку source_url на источник!**

Верни ТОЛЬКО JSON массив, без дополнительного текста.`;
}

/**
 * Call OpenAI API for market news search
 */
async function searchWithOpenAI(prompt: string): Promise<MarketEvent[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const messages: OpenAIMessage[] = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o', // GPT-4o with web search capability
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      // Enable web search (if available in your OpenAI tier)
      tools: [{ type: 'web_search' }], // Request web search tool
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data: OpenAIResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  // Parse JSON from response
  // Remove markdown code blocks if present
  const jsonContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const events: MarketEvent[] = JSON.parse(jsonContent);
    return events;
  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
}

/**
 * Main Edge Function handler
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const supabase = createSupabaseClient();
    const startTime = Date.now();

    // Parse request body
    const params: SearchRunParams = req.method === 'POST'
      ? await req.json()
      : {};

    // Get user ID from auth header (optional)
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Create search_run record
    const { data: searchRun, error: searchRunError } = await supabase
      .from('search_runs')
      .insert({
        prompt_id: null, // For manual runs
        status: 'running',
        parameters_used: params,
        triggered_by: userId,
        is_scheduled: false,
      })
      .select()
      .single();

    if (searchRunError || !searchRun) {
      throw new Error(`Failed to create search_run: ${searchRunError?.message}`);
    }

    console.log(`Search run ${searchRun.id} started`);

    try {
      // Create prompt and call OpenAI
      const prompt = createSearchPrompt(params);
      console.log('Calling OpenAI API...');

      const events = await searchWithOpenAI(prompt);
      console.log(`Found ${events.length} events`);

      // Save events to database
      const eventsToInsert = events.map((event) => ({
        ...event,
        found_by_search_run_id: searchRun.id,
        raw_data: event,
      }));

      const { data: savedEvents, error: eventsError } = await supabase
        .from('events')
        .insert(eventsToInsert)
        .select();

      if (eventsError) {
        throw new Error(`Failed to save events: ${eventsError.message}`);
      }

      console.log(`Saved ${savedEvents?.length || 0} events to database`);

      // Update search_run as completed
      const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);

      await supabase
        .from('search_runs')
        .update({
          status: 'completed',
          events_found: savedEvents?.length || 0,
          completed_at: new Date().toISOString(),
          execution_time_seconds: executionTimeSeconds,
        })
        .eq('id', searchRun.id);

      console.log(`Search run ${searchRun.id} completed in ${executionTimeSeconds}s`);

      // Return success response
      const result: SearchRunResult = {
        search_run_id: searchRun.id,
        status: 'completed',
        events_found: savedEvents?.length || 0,
        events: events,
        execution_time_seconds: executionTimeSeconds,
      };

      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200,
      });

    } catch (error) {
      // Update search_run as failed
      const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);

      await supabase
        .from('search_runs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
          execution_time_seconds: executionTimeSeconds,
        })
        .eq('id', searchRun.id);

      console.error(`Search run ${searchRun.id} failed:`, error);

      // Return error response
      const result: SearchRunResult = {
        search_run_id: searchRun.id,
        status: 'failed',
        events_found: 0,
        events: [],
        error_message: error.message,
        execution_time_seconds: executionTimeSeconds,
      };

      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 500,
      });
    }

  } catch (error) {
    console.error('Edge function error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 500,
      }
    );
  }
});
