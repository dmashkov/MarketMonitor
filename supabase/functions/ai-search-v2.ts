/**
 * AI Search Edge Function v2 (Fixed JSON parsing)
 *
 * Автоматический поиск новостей климатического рынка России через OpenAI API
 * Исправлено: принудительный JSON режим, улучшенная обработка ошибок
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// TYPES
// ============================================================================

type EventType =
  | 'акция'
  | 'цены'
  | 'условия_оплаты'
  | 'pr'
  | 'тендер'
  | 'соглашение'
  | 'регулирование'
  | 'маркетплейс';

type Channel = 'B2B' | 'B2G' | 'B2C';

type Segment =
  | 'кондиционеры'
  | 'техника'
  | 'мультизональные_системы'
  | 'вентиляция'
  | 'тепловое_оборудование'
  | 'iot'
  | 'услуги';

interface MarketEvent {
  date: string;
  segment: Segment;
  geography: string | null;
  channel: Channel | null;
  event_type: EventType;
  company: string | null;
  description: string;
  criticality: number;
  source_url: string | null;
}

interface SearchRunParams {
  days?: number;
  segments?: Segment[];
  event_types?: EventType[];
}

interface SearchRunResult {
  search_run_id: string;
  status: 'completed' | 'failed';
  events_found: number;
  events: MarketEvent[];
  error_message?: string;
  execution_time_seconds: number;
}

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

// ============================================================================
// ENVIRONMENT VARIABLES
// ============================================================================

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// OPENAI INTEGRATION
// ============================================================================

/**
 * Create prompt for searching climate market news in Russia
 */
function createSearchPrompt(params: SearchRunParams): string {
  const days = params.days || 7;
  const today = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const segmentsFilter = params.segments?.length
    ? `Фокус на сегментах: ${params.segments.join(', ')}`
    : 'Все сегменты';

  const eventTypesFilter = params.event_types?.length
    ? `Типы событий: ${params.event_types.join(', ')}`
    : 'Все типы событий';

  return `Найди РЕАЛЬНЫЕ последние новости и события на климатическом рынке России, используя веб-поиск.

ПАРАМЕТРЫ ПОИСКА:
- Период: с ${startDate} по ${today} (${days} дней)
- ${segmentsFilter}
- ${eventTypesFilter}

ЧТО ИСКАТЬ:

СЕГМЕНТЫ РЫНКА:
- кондиционеры (бытовые, полупромышленные, сплит-системы)
- техника (климатическая техника общего назначения)
- мультизональные_системы (VRV/VRF системы)
- вентиляция (вентиляционное оборудование, приточные установки)
- тепловое_оборудование (котлы, тепловые насосы, обогреватели)
- iot (умные системы управления климатом)
- услуги (монтаж, сервис, проектирование)

ТИПЫ СОБЫТИЙ:
- акция (маркетинговые акции, скидки, распродажи, промо)
- цены (изменение цен, новые прайс-листы, подорожание/подешевение)
- условия_оплаты (новые условия кредитования, рассрочки, оплаты)
- pr (новости компаний, анонсы продуктов, открытия офисов/складов)
- тендер (тендеры, госзакупки, конкурсы на поставку)
- соглашение (партнерства, дистрибуторские соглашения, эксклюзивы)
- регулирование (новые законы, стандарты, сертификация, требования)
- маркетплейс (акции на маркетплейсах: Ozon, WB, Яндекс.Маркет)

КАНАЛЫ:
- B2B (для дилеров, дистрибуторов, оптовые продажи)
- B2G (для госучреждений, муниципалитетов)
- B2C (для конечных покупателей, розница)

ИСТОЧНИКИ ДЛЯ ПОИСКА:

ДИСТРИБЬЮТОРЫ И ПРЕДСТАВИТЕЛЬСТВА:
- Русклимат, Даичи, АЯК, Бриз (дистрибьюторы)
- MIDEA, GREE, HAIER, TCL, HISENSE (представительства производителей)
- Daikin, Mitsubishi Electric, General Climate, Ballu
- ТД Климат, КлиматТорг, МирКондиционеров

МАРКЕТПЛЕЙСЫ И РИТЕЙЛ:
- Ozon, Wildberries, Яндекс.Маркет, Сбермаркет
- МВидео, DNS, Ситилинк, Эльдорадо

БИЗНЕС-ИЗДАНИЯ:
- Forbes, Ведомости, Коммерсантъ, РБК
- Эксперт, Профиль, Деловой Петербург

ПРОФЕССИОНАЛЬНЫЕ АССОЦИАЦИИ:
- АВОК (Ассоциация инженеров по отоплению, вентиляции, кондиционированию)
- АПИК (Ассоциация предприятий индустрии климата)
- Отраслевые союзы и объединения

СПЕЦИАЛИЗИРОВАННЫЕ ПОРТАЛЫ:
- Новостные порталы климатического рынка
- Отраслевые СМИ и пресс-релизы
- Телеграм-каналы климатических компаний и экспертов

ТЕНДЕРЫ И ГОСЗАКУПКИ:
- zakupki.gov.ru (Единая информационная система)
- Региональные порталы госзакупок

РЕГИОНАЛЬНЫЕ ИСТОЧНИКИ:
- Региональные новостные порталы и бизнес-издания

ФОРМАТ ОТВЕТА (JSON):
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "segment": "один из сегментов выше",
      "geography": "город/регион или null",
      "channel": "B2B | B2G | B2C или null",
      "event_type": "один из типов выше",
      "company": "название компании или null",
      "description": "краткое описание события (1-2 предложения)",
      "criticality": 1-5,
      "source_url": "URL источника новости или null"
    }
  ]
}

ТРЕБОВАНИЯ:
- Найди минимум 5, максимум 15 РЕАЛЬНЫХ событий из открытых источников
- Используй веб-поиск для актуальной информации
- Обязательно указывай source_url если источник найден
- Описание на русском языке
- Критичность: 1=незначимое, 3=заметное, 5=критическое для всего рынка
- Если не нашёл реальных событий - верни пустой массив: {"events": []}
- Только валидный JSON`;
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
      role: 'system',
      content: 'Ты - аналитик рынка климатического оборудования в России. Всегда отвечай ТОЛЬКО валидным JSON объектом со структурой {"events": [...]}. Никогда не возвращай текст, объяснения или извинения - только JSON.',
    },
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
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      tools: [{ type: 'web_search' }], // ⭐ Включаем веб-поиск!
      response_format: { type: 'json_object' }, // Принудительный JSON режим
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

  try {
    // Парсим JSON ответ
    const parsed = JSON.parse(content);

    // Проверяем структуру
    if (!parsed.events || !Array.isArray(parsed.events)) {
      console.warn('Invalid response structure, returning empty array');
      return [];
    }

    const events: MarketEvent[] = parsed.events;

    // Валидация каждого события
    const validEvents = events.filter((event) => {
      return (
        event.date &&
        event.segment &&
        event.event_type &&
        event.description &&
        typeof event.criticality === 'number'
      );
    });

    console.log(`Parsed ${validEvents.length} valid events from ${events.length} total`);
    return validEvents;

  } catch (error) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

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
        prompt_id: null,
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

      if (events.length === 0) {
        // No events found - это нормально
        const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);

        await supabase
          .from('search_runs')
          .update({
            status: 'completed',
            events_found: 0,
            completed_at: new Date().toISOString(),
            execution_time_seconds: executionTimeSeconds,
          })
          .eq('id', searchRun.id);

        const result: SearchRunResult = {
          search_run_id: searchRun.id,
          status: 'completed',
          events_found: 0,
          events: [],
          execution_time_seconds: executionTimeSeconds,
        };

        return new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          status: 200,
        });
      }

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
