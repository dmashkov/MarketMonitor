/**
 * Search Orchestrator Agent Types
 *
 * Координирование всех агентов в последовательной цепочке
 * - Управление поиском и отслеживанием
 * - Вызов Source Hunter → Content Fetcher → Document Processor
 * - Создание записей в search_runs и search_runs_stages
 */

export interface SearchOrchestratorRequest {
  monitoring_profile_id: string;
}

export interface SearchOrchestratorResponse {
  status: 'running' | 'completed' | 'failed';
  search_run_id: string;
  documents_created?: number;
  events_created?: number;
  duration_seconds?: number;
  error?: string;
  message?: string;
}

export interface SearchRun {
  id: string;
  type: string;
  status: string;
  monitoring_profile_id: string;
  documents_created: number;
  events_created: number;
  started_at: string;
  completed_at: string | null;
  execution_time_ms: number | null;
  error_message: string | null;
  created_by: string | null;
}

export interface SearchRunStage {
  id: string;
  search_run_id: string;
  stage_name: string;
  status: string;
  documents_processed: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface MonitoringProfile {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  segment_ids: string[];
  brand_ids: string[];
  geography_ids: string[];
  event_type_ids: string[];
  priority: number;
  max_sources_per_run: number;
  dedupe_threshold: number;
  prompt_template_id: string | null;
  schedule_cron: string | null;
}

export interface PromptTemplate {
  id: string;
  name: string;
  stage: 'search' | 'classify' | 'extract' | 'score';
  template_text: string;
  is_active: boolean;
  description: string | null;
}

export interface AgentResponse {
  status: 'success' | 'partial' | 'error';
  [key: string]: unknown;
}

export interface SourceHunterResponse extends AgentResponse {
  documents_created: number;
  document_ids: string[];
  errors?: Array<{ source_id?: string; error: string }>;
}

export interface ContentFetcherResponse extends AgentResponse {
  documents_updated: number;
  documents_failed: number;
  errors?: Array<{ document_id: string; error: string }>;
}

export interface DocumentProcessorResponse extends AgentResponse {
  documents_processed: number;
  documents_failed: number;
  errors?: Array<{ document_id: string; error: string }>;
}
