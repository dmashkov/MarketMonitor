/**
 * Document Processor Agent
 *
 * Классификация документов и генерация embeddings
 * - Загружает контент из documents.content_text
 * - Вызывает GPT-4o для классификации: segment, event_types, brands, geographies
 * - Генерирует embeddings через text-embedding-3-small
 * - Создает записи в linking tables (document_brands, document_segments, etc.)
 * - Обновляет document с embedding и canonical content_text
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import {
  DocumentProcessorRequest,
  DocumentProcessorResponse,
  DocumentWithContent,
  ClassificationResult,
  LLMPromptData,
  ReferenceData,
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
// OpenAI Configuration
// ============================================================================

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Загрузить документы с контентом для обработки
 */
async function getDocumentsWithContent(documentIds: string[]): Promise<DocumentWithContent[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, content_text, source_url')
    .in('id', documentIds);

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data as DocumentWithContent[]) || [];
}

/**
 * Загрузить справочные данные для LLM prompts
 */
async function getReferenceData(): Promise<ReferenceData> {
  // Загрузить сегменты
  const { data: segmentsData } = await supabase
    .from('segments')
    .select('id, name')
    .eq('is_active', true);

  // Загрузить типы событий
  const { data: eventTypesData } = await supabase
    .from('event_types')
    .select('id, code, name')
    .eq('is_active', true);

  // Загрузить бренды
  const { data: brandsData } = await supabase
    .from('brands')
    .select('id, name')
    .eq('is_active', true);

  // Загрузить географии
  const { data: geographiesData } = await supabase
    .from('geographies')
    .select('id, name')
    .eq('is_active', true);

  return {
    segments: segmentsData || [],
    event_types: eventTypesData || [],
    brands: brandsData || [],
    geographies: geographiesData || [],
  };
}

/**
 * Генерировать LLM prompt для классификации документа
 */
function generateClassificationPrompt(
  document: DocumentWithContent,
  referenceData: ReferenceData
): string {
  const segmentsEnum = referenceData.segments.map((s) => `${s.name} (${s.id})`).join(', ');
  const eventTypesEnum = referenceData.event_types.map((e) => `${e.name} (${e.code})`).join(', ');
  const brandsList = referenceData.brands.map((b) => b.name).join(', ');
  const geographiesList = referenceData.geographies.map((g) => g.name).join(', ');

  return `You are a market analyst for HVAC equipment in Russia.

Analyze the following document about climate control market and classify it according to the available taxonomies.

Available segments: ${segmentsEnum}
Available event types: ${eventTypesEnum}
Available brands: ${brandsList}
Available geographies: ${geographiesList}

Document to analyze:
---
Title: ${document.title}
Content: ${(document.content_text || '').substring(0, 3000)}
---

Return ONLY a JSON object (no other text) with the following structure:
{
  "segment_id": "uuid or null",
  "event_type_ids": ["uuid1", "uuid2"],
  "brand_ids": ["uuid1", "uuid2"],
  "geography_ids": ["uuid1"]
}

Rules:
- segment_id: main segment category (one UUID or null if unclear)
- event_type_ids: one or more from the list (empty array if none apply)
- brand_ids: companies mentioned in the document (empty array if none)
- geography_ids: locations mentioned in the document (empty array if none)
- If you cannot map to a specific ID, use null or empty array
- The response MUST be valid JSON, nothing else`;
}

/**
 * Вызвать GPT-4o для классификации документа
 */
async function classifyDocument(
  document: DocumentWithContent,
  referenceData: ReferenceData
): Promise<ClassificationResult> {
  const prompt = generateClassificationPrompt(document, referenceData);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0].message.content.trim();

  // Parse JSON response
  try {
    const result = JSON.parse(content) as ClassificationResult;
    return result;
  } catch (e) {
    console.error('Failed to parse LLM response:', content);
    throw new Error(`Invalid JSON response from LLM: ${content.substring(0, 200)}`);
  }
}

/**
 * Генерировать embeddings для документа через text-embedding-3-small
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8191), // Limit to max tokens
      dimensions: 1536,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embeddings error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0].embedding;
}

/**
 * Очистить контент для canonical layer (убрать лишние пробелы, нормализовать)
 */
function canonicalizeContent(content: string | null): string | null {
  if (!content) return null;
  return content
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\n\s*\n/g, '\n') // Multiple newlines to single
    .trim();
}

/**
 * Создать связи документа с бренда‌ми, сегментами, географией, типами событий
 */
async function createDocumentLinks(
  documentId: string,
  classification: ClassificationResult
): Promise<void> {
  // Link brands
  if (classification.brand_ids && classification.brand_ids.length > 0) {
    const brandLinks = classification.brand_ids.map((brand_id) => ({
      document_id: documentId,
      brand_id,
    }));

    const { error: brandError } = await supabase
      .from('document_brands')
      .insert(brandLinks)
      .select();

    if (brandError) {
      console.error('Error linking brands:', brandError);
    }
  }

  // Link segments
  if (classification.segment_id) {
    const { error: segError } = await supabase
      .from('document_segments')
      .insert({
        document_id: documentId,
        segment_id: classification.segment_id,
      })
      .select();

    if (segError) {
      console.error('Error linking segment:', segError);
    }
  }

  // Link geographies
  if (classification.geography_ids && classification.geography_ids.length > 0) {
    const geoLinks = classification.geography_ids.map((geography_id) => ({
      document_id: documentId,
      geography_id,
    }));

    const { error: geoError } = await supabase
      .from('document_geographies')
      .insert(geoLinks)
      .select();

    if (geoError) {
      console.error('Error linking geographies:', geoError);
    }
  }

  // Link event types
  if (classification.event_type_ids && classification.event_type_ids.length > 0) {
    const eventLinks = classification.event_type_ids.map((event_type_id) => ({
      document_id: documentId,
      event_type_id,
    }));

    const { error: eventError } = await supabase
      .from('document_event_types')
      .insert(eventLinks)
      .select();

    if (eventError) {
      console.error('Error linking event types:', eventError);
    }
  }
}

/**
 * Обработать один документ: классификация + embeddings + linking
 */
async function processDocument(
  document: DocumentWithContent,
  referenceData: ReferenceData
): Promise<void> {
  // 1. Classify document
  const classification = await classifyDocument(document, referenceData);

  // 2. Generate embeddings
  const embeddingText = [document.title, document.content_text].filter(Boolean).join(' ');
  const embedding = await generateEmbedding(embeddingText);

  // 3. Canonicalize content
  const canonicalContent = canonicalizeContent(document.content_text);

  // 4. Update document with embeddings and canonical content
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      embedding: embedding as unknown as string[], // Store as pgvector format
      content_text: canonicalContent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', document.id);

  if (updateError) {
    throw new Error(`Failed to update document ${document.id}: ${updateError.message}`);
  }

  // 5. Create linking table entries
  await createDocumentLinks(document.id, classification);
}

/**
 * Main handler
 */
async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const body = (await req.json()) as DocumentProcessorRequest;

    // Validate input
    if (!body.document_ids || body.document_ids.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          documents_processed: 0,
          documents_failed: 0,
          errors: [{ document_id: 'N/A', error: 'No document_ids provided' }],
        } as DocumentProcessorResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load documents
    const documents = await getDocumentsWithContent(body.document_ids);

    if (documents.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'error',
          documents_processed: 0,
          documents_failed: body.document_ids.length,
          errors: [{ document_id: 'N/A', error: 'No documents found' }],
        } as DocumentProcessorResponse),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Load reference data
    const referenceData = await getReferenceData();

    // Process each document
    let processedCount = 0;
    const errors: Array<{ document_id: string; error: string }> = [];

    for (const document of documents) {
      try {
        await processDocument(document, referenceData);
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing document ${document.id}:`, errorMessage);
        errors.push({
          document_id: document.id,
          error: errorMessage,
        });
      }
    }

    const failedCount = body.document_ids.length - processedCount;
    const response: DocumentProcessorResponse = {
      status: failedCount === 0 ? 'success' : failedCount === processedCount ? 'error' : 'partial',
      documents_processed: processedCount,
      documents_failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(response), {
      status: failedCount === 0 ? 200 : failedCount === processedCount ? 500 : 206,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Document processor error:', errorMessage);

    return new Response(
      JSON.stringify({
        status: 'error',
        documents_processed: 0,
        documents_failed: 0,
        errors: [{ document_id: 'N/A', error: errorMessage }],
      } as DocumentProcessorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handleRequest);
