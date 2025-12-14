/**
 * Source Hunter Agent Types
 *
 * Автоматический поиск новых документов по промптам
 */

export interface SourceHunterRequest {
  prompt: string;
  segment_ids?: string[];
  geography_ids?: string[];
  date_range_days?: number;
  monitoring_profile_id?: string;
  search_run_id?: string;
}

export interface SourceHunterResponse {
  status: 'success' | 'error';
  documents_created: number;
  document_ids?: string[];
  urls: string[];
  error?: string;
  message?: string;
}

export interface SearchSource {
  id: string;
  name: string;
  type: 'distributor' | 'manufacturer' | 'media' | 'website';
  website: string | null;
  telegram: string | null;
  priority: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}
