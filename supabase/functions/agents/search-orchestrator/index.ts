/**
 * Search Orchestrator Agent
 *
 * Координирование всех агентов в последовательной цепочке:
 * 1. Source Hunter - Поиск и создание документов
 * 2. Content Fetcher - Загрузка контента
 * 3. Document Processor - Классификация и embeddings
 *
 * Управляет:
 * - Созданием search_run
 * - Отслеживанием progress в search_runs_stages
 * - Error handling и rollback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import {
  SearchOrchestratorRequest,
  SearchOrchestratorResponse,
  MonitoringProfile,
  SearchRun,
  SearchRunStage,
  SourceHunterResponse,
  ContentFetcherResponse,
  DocumentProcessorResponse,
  PromptTemplate,
} from './types.ts';

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
 * Загрузить monitoring profile по ID
 */
async function loadMonitoringProfile(profileId: string): Promise<MonitoringProfile> {
  const { data, error } = await supabase
    .from('monitoring_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error) {
    throw new Error(`Failed to load monitoring profile: ${error.message}`);
  }

  return data as MonitoringProfile;
}

/**
 * Загрузить prompt template по ID
 */
async function loadPromptTemplate(templateId: string): Promise<PromptTemplate> {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    throw new Error(`Failed to load prompt template: ${error.message}`);
  }

  return data as PromptTemplate;
}

/**
 * Создать новый search_run
 */
async function createSearchRun(
  monitoringProfileId: string,
  userId: string | null
): Promise<SearchRun> {
  const { data, error } = await supabase
    .from('search_runs')
    .insert({
      type: 'source_hunter',
      status: 'running',
      monitoring_profile_id: monitoringProfileId,
      created_by: userId,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create search_run: ${error.message}`);
  }

  return data as SearchRun;
}

/**
 * Создать запись stage в search_runs_stages
 */
async function createSearchRunStage(
  searchRunId: string,
  stageName: string,
  status: string,
  docsProcessed: number,
  errorMessage?: string
): Promise<SearchRunStage> {
  const { data, error } = await supabase
    .from('search_runs_stages')
    .insert({
      search_run_id: searchRunId,
      stage_name: stageName,
      status,
      documents_processed: docsProcessed,
      error_message: errorMessage || null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create search run stage: ${error.message}`);
  }

  return data as SearchRunStage;
}

/**
 * Обновить search_run с результатами
 */
async function updateSearchRun(
  searchRunId: string,
  updates: {
    status: string;
    documents_created?: number;
    events_created?: number;
    error_message?: string;
  },
  startTime?: number
): Promise<void> {
  const executionTimeMs = startTime ? Date.now() - startTime : null;

  const { error } = await supabase
    .from('search_runs')
    .update({
      ...updates,
      completed_at: new Date().toISOString(),
      ...(executionTimeMs && { execution_time_ms: executionTimeMs }),
    })
    .eq('id', searchRunId);

  if (error) {
    throw new Error(`Failed to update search_run: ${error.message}`);
  }
}

/**
 * Вызвать Source Hunter agent
 */
async function runSourceHunter(
  monitoringProfileId: string,
  searchRunId: string,
  prompt: string,
  profile: MonitoringProfile
): Promise<SourceHunterResponse> {
  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/source-hunter`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`,
    },
    body: JSON.stringify({
      prompt,
      monitoring_profile_id: monitoringProfileId,
      search_run_id: searchRunId,
      segment_ids: profile.segment_ids,
      geography_ids: profile.geography_ids,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Source Hunter failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as SourceHunterResponse;
  return data;
}

/**
 * Вызвать Content Fetcher agent
 */
async function runContentFetcher(
  documentIds: string[],
  searchRunId: string
): Promise<ContentFetcherResponse> {
  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/content-fetcher`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`,
    },
    body: JSON.stringify({
      document_ids: documentIds,
      search_run_id: searchRunId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Content Fetcher failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as ContentFetcherResponse;
  return data;
}

/**
 * Вызвать Document Processor agent
 */
async function runDocumentProcessor(
  documentIds: string[],
  searchRunId: string
): Promise<DocumentProcessorResponse> {
  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/document-processor`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || ''}`,
    },
    body: JSON.stringify({
      document_ids: documentIds,
      search_run_id: searchRunId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Document Processor failed: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as DocumentProcessorResponse;
  return data;
}

/**
 * Extract user ID from JWT token
 */
function extractUserIdFromToken(authHeader: string): string | null {
  // For now, we'll return null since we're using SERVICE_ROLE_KEY
  // In production, parse JWT and extract sub claim
  return null;
}

// ============================================================================
// Main Handler
// ============================================================================

async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
    const body = (await req.json()) as SearchOrchestratorRequest;

    // Validate input
    if (!body.monitoring_profile_id) {
      return new Response(
        JSON.stringify({
          status: 'failed',
          search_run_id: '',
          error: 'Missing monitoring_profile_id',
        } as SearchOrchestratorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract user ID from Authorization header
    const authHeader = req.headers.get('Authorization') || '';
    const userId = extractUserIdFromToken(authHeader);

    // 1. Load monitoring profile
    console.log(`Loading monitoring profile: ${body.monitoring_profile_id}`);
    const profile = await loadMonitoringProfile(body.monitoring_profile_id);

    // 2. Load prompt template
    if (!profile.prompt_template_id) {
      throw new Error('Monitoring profile has no prompt template configured');
    }
    console.log(`Loading prompt template: ${profile.prompt_template_id}`);
    const promptTemplate = await loadPromptTemplate(profile.prompt_template_id);

    // 3. Create search_run record
    console.log('Creating search_run...');
    const searchRun = await createSearchRun(profile.id, userId);

    // 4. Run Source Hunter
    try {
      console.log('Running Source Hunter...');
      const sourceHunterResult = await runSourceHunter(
        profile.id,
        searchRun.id,
        promptTemplate.template_text,
        profile
      );

      await createSearchRunStage(
        searchRun.id,
        'source_hunter',
        sourceHunterResult.status,
        sourceHunterResult.documents_created,
        sourceHunterResult.status !== 'success' ? 'Source Hunter failed' : undefined
      );

      if (sourceHunterResult.status === 'error') {
        throw new Error('Source Hunter returned error status');
      }

      const documentIds = sourceHunterResult.document_ids || [];

      if (documentIds.length === 0) {
        throw new Error('No documents created by Source Hunter');
      }

      // 5. Run Content Fetcher
      try {
        console.log('Running Content Fetcher...');
        const fetcherResult = await runContentFetcher(documentIds, searchRun.id);

        await createSearchRunStage(
          searchRun.id,
          'content_fetcher',
          fetcherResult.status,
          fetcherResult.documents_updated,
          fetcherResult.status !== 'success' ? `${fetcherResult.documents_failed} documents failed` : undefined
        );

        // 6. Run Document Processor
        try {
          console.log('Running Document Processor...');
          const processorResult = await runDocumentProcessor(documentIds, searchRun.id);

          await createSearchRunStage(
            searchRun.id,
            'document_processor',
            processorResult.status,
            processorResult.documents_processed,
            processorResult.status !== 'success'
              ? `${processorResult.documents_failed} documents failed`
              : undefined
          );

          // 7. Update search_run as completed
          const durationSeconds = (Date.now() - startTime) / 1000;
          await updateSearchRun(
            searchRun.id,
            {
              status: 'completed',
              documents_created: documentIds.length,
              events_created: 0, // Will be updated by Event Extractor in Part 6
            },
            startTime
          );

          // 8. Return success response
          return new Response(
            JSON.stringify({
              status: 'completed',
              search_run_id: searchRun.id,
              documents_created: documentIds.length,
              events_created: 0,
              duration_seconds: durationSeconds,
              message: `Pipeline completed in ${durationSeconds.toFixed(1)}s`,
            } as SearchOrchestratorResponse),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (processorError) {
          const processorMsg =
            processorError instanceof Error ? processorError.message : String(processorError);
          console.error('Document Processor error:', processorMsg);

          await createSearchRunStage(
            searchRun.id,
            'document_processor',
            'failed',
            0,
            processorMsg
          );

          await updateSearchRun(
            searchRun.id,
            {
              status: 'failed',
              error_message: `Document Processor failed: ${processorMsg}`,
            },
            startTime
          );

          throw processorError;
        }
      } catch (fetcherError) {
        const fetcherMsg = fetcherError instanceof Error ? fetcherError.message : String(fetcherError);
        console.error('Content Fetcher error:', fetcherMsg);

        await createSearchRunStage(
          searchRun.id,
          'content_fetcher',
          'failed',
          0,
          fetcherMsg
        );

        await updateSearchRun(
          searchRun.id,
          {
            status: 'failed',
            error_message: `Content Fetcher failed: ${fetcherMsg}`,
          },
          startTime
        );

        throw fetcherError;
      }
    } catch (hunterError) {
      const hunterMsg = hunterError instanceof Error ? hunterError.message : String(hunterError);
      console.error('Source Hunter error:', hunterMsg);

      await createSearchRunStage(
        searchRun.id,
        'source_hunter',
        'failed',
        0,
        hunterMsg
      );

      await updateSearchRun(
        searchRun.id,
        {
          status: 'failed',
          error_message: `Source Hunter failed: ${hunterMsg}`,
        },
        startTime
      );

      throw hunterError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Search Orchestrator error:', errorMessage);

    return new Response(
      JSON.stringify({
        status: 'failed',
        search_run_id: '',
        error: errorMessage,
      } as SearchOrchestratorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handleRequest);
