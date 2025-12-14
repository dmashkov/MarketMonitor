/**
 * Document Processor Agent Types
 *
 * Классификация документов и генерация embeddings
 * - Берет content_text из документов
 * - Вызывает LLM для классификации (segment, event_types, brands, geographies)
 * - Генерирует embeddings через OpenAI
 * - Создает записи в linking tables
 * - Обновляет документы с embeddings и canonical content_text
 */

export interface DocumentProcessorRequest {
  document_ids: string[];
  search_run_id?: string;
}

export interface DocumentProcessorResponse {
  status: 'success' | 'partial' | 'error';
  documents_processed: number;
  documents_failed: number;
  errors?: Array<{
    document_id: string;
    error: string;
  }>;
}

export interface DocumentWithContent {
  id: string;
  title: string;
  content_text: string | null;
  source_url: string | null;
}

export interface ClassificationResult {
  segment_id: string | null;
  event_type_ids: string[];
  brand_ids: string[];
  geography_ids: string[];
}

export interface LLMPromptData {
  segment_type?: string;
  segments_enum: string;
  event_types_enum: string;
  brands_list: string;
  geographies_list: string;
  document_content_text: string;
}

export interface ReferenceData {
  segments: Array<{ id: string; name: string }>;
  event_types: Array<{ id: string; code: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  geographies: Array<{ id: string; name: string }>;
}
