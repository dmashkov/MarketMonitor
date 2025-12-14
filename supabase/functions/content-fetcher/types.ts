/**
 * Content Fetcher Agent Types
 *
 * Загрузка и парсинг контента с URLs, найденных Source Hunter агентом
 * - Поддерживает HTML, PDF, DOCX, PPTX, TXT
 * - Извлекает текстовый контент
 * - Сохраняет в documents таблицу
 */

export interface ContentFetcherRequest {
  document_id: string;
  url: string;
  document_type: 'pdf' | 'docx' | 'pptx' | 'html' | 'webpage';
}

export interface ContentFetcherResponse {
  status: 'success' | 'error';
  document_id: string;
  content_length: number;
  error?: string;
  message?: string;
}

export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  mimeType: string;
  fetchedAt: string;
  fileSize?: number;
}

export interface ParseResult {
  text: string;
  language?: string;
  encoding?: string;
  rawLength: number;
}
