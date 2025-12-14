/**
 * Content Fetcher Agent
 *
 * Загрузка и парсинг контента с URLs:
 * - Выполняет HTTP запросы к найденным URLs
 * - Парсит HTML, извлекает текст из PDF/DOCX/PPTX
 * - Сохраняет контент в documents.content_text
 * - Обновляет fetched_at и content_length
 * - Обрабатывает ошибки (404, 403, timeout, etc.)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { ContentFetcherRequest, ContentFetcherResponse, FetchedContent, ParseResult } from './types.ts';

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
// Helpers - Content Fetching
// ============================================================================

/**
 * Загрузить контент с URL с таймаутом и retry логикой
 */
async function fetchContent(url: string, maxRetries: number = 3): Promise<Response> {
  const timeout = 15000; // 15 секунд
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MarketMonitor/1.0 (Content Fetcher Agent)',
          Accept:
            'text/html, application/xhtml+xml, application/xml;q=0.9, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.presentationml.presentation, */*;q=0.8',
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `Attempt ${attempt}/${maxRetries} failed for ${url}:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

/**
 * Парсить HTML и извлечь текстовый контент
 */
function parseHTML(html: string): ParseResult {
  try {
    // Удалить скрипты и стили
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Удалить HTML теги
    cleaned = cleaned
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Нормализовать пробелы
    const text = cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');

    return {
      text,
      language: 'ru',
      encoding: 'utf-8',
      rawLength: html.length,
    };
  } catch (error) {
    console.error('Error parsing HTML:', error);
    throw error;
  }
}

/**
 * Парсить PDF (простой текстовый экстрактор)
 * Для полноценного парсинга нужна библиотека типа pdf-parse
 */
function parsePDF(buffer: ArrayBuffer): ParseResult {
  try {
    // Простой парсер: ищем текст между потоками
    const view = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(view);

    // Базовая очистка PDF текста
    const cleaned = text
      .replace(/\x00/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length < 500) // Отфильтровать бинарный мусор
      .join('\n');

    return {
      text: cleaned.substring(0, 50000), // Ограничить размер
      language: 'ru',
      encoding: 'utf-8',
      rawLength: buffer.byteLength,
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

/**
 * Парсить DOCX (ZIP архив с XML)
 * Для полноценного парсинга нужна библиотека типа docx-parser
 */
async function parseDOCX(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // DOCX это ZIP архив, нужна специализированная библиотека
    // Для MVP: возвращаем упрощенный результат
    const view = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(view);

    // Ищем текст между XML тегами
    const matches = text.match(/<t>([^<]+)<\/t>/g) || [];
    text = matches.map((m) => m.replace(/<\/?t>/g, '')).join(' ');

    return {
      text: text.substring(0, 50000),
      language: 'ru',
      encoding: 'utf-8',
      rawLength: buffer.byteLength,
    };
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw error;
  }
}

/**
 * Парсить PPTX (ZIP архив с XML)
 * Для полноценного парсинга нужна библиотека типа pptx-parser
 */
async function parsePPTX(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // PPTX это ZIP архив, нужна специализированная библиотека
    // Для MVP: возвращаем упрощенный результат
    const view = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(view);

    // Ищем текст между XML тегами
    const matches = text.match(/<a:t>([^<]+)<\/a:t>/g) || [];
    text = matches.map((m) => m.replace(/<a:?t>/g, '')).join(' ');

    return {
      text: text.substring(0, 50000),
      language: 'ru',
      encoding: 'utf-8',
      rawLength: buffer.byteLength,
    };
  } catch (error) {
    console.error('Error parsing PPTX:', error);
    throw error;
  }
}

/**
 * Парсить текстовый контент на основе MIME типа
 */
async function parseContent(
  buffer: ArrayBuffer | string,
  mimeType: string,
  documentType: string
): Promise<ParseResult> {
  try {
    if (typeof buffer === 'string') {
      // Уже текст (HTML)
      return parseHTML(buffer);
    }

    switch (documentType) {
      case 'pdf':
        return parsePDF(buffer);
      case 'docx':
        return await parseDOCX(buffer);
      case 'pptx':
        return await parsePPTX(buffer);
      case 'html':
      case 'webpage':
        return parseHTML(new TextDecoder().decode(new Uint8Array(buffer)));
      default:
        // По умолчанию пытаемся распарсить как текст
        const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));
        return {
          text,
          language: 'ru',
          encoding: 'utf-8',
          rawLength: buffer instanceof ArrayBuffer ? buffer.byteLength : buffer.length,
        };
    }
  } catch (error) {
    console.error('Error parsing content:', error);
    throw error;
  }
}

/**
 * Обновить документ с загруженным контентом
 */
async function updateDocument(
  documentId: string,
  content: string,
  contentLength: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('documents')
      .update({
        content_text: content,
        content_length: contentLength,
        fetched_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      console.error('Error updating document:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating document:', error);
    return false;
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
    const requestData: ContentFetcherRequest = await request.json();

    // Determine mode: batch (document_ids array) or single (document_id + url)
    if (requestData.document_ids && requestData.document_ids.length > 0) {
      // BATCH MODE: Process multiple documents
      console.log(`Starting Content Fetcher batch mode for ${requestData.document_ids.length} documents`);

      let documentsUpdated = 0;
      let documentsFailed = 0;

      // Fetch URLs for all documents first
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, file_url, source_url, document_type')
        .in('id', requestData.document_ids);

      if (error || !documents) {
        return new Response(
          JSON.stringify({
            status: 'error',
            documents_updated: 0,
            documents_failed: requestData.document_ids.length,
            error: `Failed to fetch documents: ${error?.message}`,
          } as ContentFetcherResponse),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Process each document
      for (const doc of documents) {
        try {
          const url = doc.file_url || doc.source_url;
          if (!url) {
            documentsFailed++;
            continue;
          }

          console.log(`Fetching document ${doc.id} from: ${url}`);

          const response = await fetchContent(url);
          if (!response.ok) {
            console.warn(`Failed to fetch ${doc.id}: HTTP ${response.status}`);
            documentsFailed++;
            continue;
          }

          const contentType = response.headers.get('content-type') || '';
          let contentData: ArrayBuffer | string;

          if (contentType.includes('application/json') || contentType.includes('text/')) {
            contentData = await response.text();
          } else {
            contentData = await response.arrayBuffer();
          }

          const parseResult = await parseContent(contentData, contentType, doc.document_type);

          if (!parseResult.text || parseResult.text.trim().length === 0) {
            documentsFailed++;
            continue;
          }

          const updated = await updateDocument(doc.id, parseResult.text, parseResult.text.length);
          if (updated) {
            documentsUpdated++;
          } else {
            documentsFailed++;
          }
        } catch (docError) {
          console.error(`Error processing document ${doc.id}:`, docError);
          documentsFailed++;
        }
      }

      return new Response(
        JSON.stringify({
          status: 'success',
          documents_updated: documentsUpdated,
          documents_failed: documentsFailed,
          message: `Processed ${documentsUpdated} documents, ${documentsFailed} failed`,
        } as ContentFetcherResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else if (requestData.document_id && requestData.url) {
      // SINGLE MODE: Legacy support for single document
      console.log(`Starting Content Fetcher for document: ${requestData.document_id}`);

      const response = await fetchContent(requestData.url);
      if (!response.ok) {
        return new Response(
          JSON.stringify({
            status: 'error',
            document_id: requestData.document_id,
            content_length: 0,
            error: `HTTP ${response.status}: ${response.statusText}`,
          } as ContentFetcherResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const contentType = response.headers.get('content-type') || '';
      let contentData: ArrayBuffer | string;

      if (contentType.includes('application/json') || contentType.includes('text/')) {
        contentData = await response.text();
      } else {
        contentData = await response.arrayBuffer();
      }

      const parseResult = await parseContent(contentData, contentType, requestData.document_type);

      if (!parseResult.text || parseResult.text.trim().length === 0) {
        return new Response(
          JSON.stringify({
            status: 'error',
            document_id: requestData.document_id,
            content_length: 0,
            error: 'No text content extracted from document',
          } as ContentFetcherResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const updated = await updateDocument(
        requestData.document_id,
        parseResult.text,
        parseResult.text.length
      );

      if (!updated) {
        return new Response(
          JSON.stringify({
            status: 'error',
            document_id: requestData.document_id,
            content_length: 0,
            error: 'Failed to update document in database',
          } as ContentFetcherResponse),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          status: 'success',
          document_id: requestData.document_id,
          content_length: parseResult.text.length,
          message: `Fetched and stored ${parseResult.text.length} characters`,
        } as ContentFetcherResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'Missing required parameters: either (document_ids) for batch mode or (document_id + url) for single mode',
        } as ContentFetcherResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Content Fetcher Agent error:', error);

    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ContentFetcherResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

Deno.serve(handler);
