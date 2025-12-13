/**
 * Central Type Definitions for MarketMonitor
 * This is the SINGLE SOURCE OF TRUTH for all types
 *
 * All other files should import from here!
 */

/**
 * ============================================================================
 * User and Authentication Types
 * ============================================================================
 */

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    aud: string;
    created_at: string;
  };
  session: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    created_at: string;
  };
}

export interface AuthContextType {
  session: AuthSession | null;
  user: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
}

/**
 * ============================================================================
 * Market Event Types
 * ============================================================================
 */

export type EventType =
  | 'акция'
  | 'цены'
  | 'условия_оплаты'
  | 'pr'
  | 'тендер'
  | 'соглашение'
  | 'регулирование'
  | 'маркетплейс';

export type Channel = 'B2B' | 'B2G' | 'B2C';

export type Segment =
  | 'кондиционеры'
  | 'техника'
  | 'мультизональные_системы'
  | 'вентиляция'
  | 'тепловое_оборудование'
  | 'iot'
  | 'услуги';

/**
 * ============================================================================
 * NEW: Segment Entity Types (Database entities)
 * ============================================================================
 */

export interface SegmentEntity {
  id: string;
  name: string; // e.g., "RAC (Room Air Conditioner)"
  code: string; // e.g., "RAC", "VRF", "CHILLER"
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ============================================================================
 * NEW: Geography Types
 * ============================================================================
 */

export type GeographyType = 'country' | 'region' | 'city';

export interface Geography {
  id: string;
  name: string; // e.g., "Россия", "Центральный ФО", "Москва"
  code: string; // e.g., "RU", "RU_CFO", "RU_MOW"
  type: GeographyType;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ============================================================================
 * NEW: Source Management Types
 * ============================================================================
 */

export type SourceTypeCode =
  | 'DISTRIBUTOR'       // Дистрибьютор
  | 'MANUFACTURER'      // Производитель
  | 'BUSINESS_MEDIA'    // Деловые СМИ
  | 'TELEGRAM'          // Telegram канал
  | 'ASSOCIATION'       // Профессиональная ассоциация
  | 'INDUSTRY_PORTAL';  // Отраслевой портал

export interface SourceType {
  id: string;
  name: string;
  code: SourceTypeCode;
  description: string | null;
  created_at: string;
}

export type CheckFrequency = 'daily' | 'weekly' | 'monthly';

export interface Source {
  id: string;
  name: string; // e.g., "Русклимат", "MIDEA Russia"
  source_type_id: string;
  website_url: string | null;
  telegram_channel: string | null;
  description: string | null;
  is_active: boolean;
  priority: number; // 1-10
  check_frequency: CheckFrequency;
  last_checked_at: string | null;
  metadata: Record<string, unknown>; // NO any!
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SourceWithType extends Source {
  source_type?: SourceType;
}

export type SourceUrlType = 'news' | 'products' | 'blog' | 'press-release';

export interface SourceUrl {
  id: string;
  source_id: string;
  url: string;
  url_type: SourceUrlType;
  description: string | null;
  is_active: boolean;
  check_frequency: CheckFrequency;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceUrlWithSource extends SourceUrl {
  source?: Source;
}

/**
 * ============================================================================
 * NEW: Brand Management Types
 * ============================================================================
 */

export type BrandCategory = 'premium' | 'middle' | 'budget';

export interface Brand {
  id: string;
  name: string; // e.g., "Daikin", "Midea", "Gree"
  manufacturer: string | null; // Производитель (может отличаться от бренда)
  country: string | null; // Страна производства
  category: BrandCategory; // premium, middle, budget
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Many-to-Many связь между брендами и сегментами
 */
export interface BrandSegment {
  id: string;
  brand_id: string;
  segment_id: string;
  created_at: string;
}

/**
 * Brand с подгруженными сегментами
 */
export interface BrandWithSegments extends Brand {
  segments?: SegmentEntity[];
  segment_ids?: string[]; // Массив ID сегментов для удобства
}

/**
 * Form Data для создания бренда
 */
export interface CreateBrandFormData {
  name: string;
  manufacturer?: string;
  country?: string;
  category: BrandCategory;
  website_url?: string;
  logo_url?: string;
  description?: string;
  is_active?: boolean;
  segment_ids: string[]; // ID сегментов для связи
}

/**
 * Form Data для обновления бренда
 */
export interface UpdateBrandFormData extends Partial<CreateBrandFormData> {
  id: string;
}

/**
 * ============================================================================
 * NEW: Document Management Types
 * ============================================================================
 */

export type DocumentType = 'pdf' | 'docx' | 'pptx' | 'html' | 'webpage';

export interface Document {
  id: string;
  title: string;
  description: string | null;
  document_type: DocumentType;

  // Контент
  content_text: string | null;
  content_html: string | null;
  file_url: string | null;
  file_size: number | null;
  source_url: string | null;

  // Метаданные
  source_id: string | null;
  published_date: string | null;
  fetched_at: string;

  // Mentions (массивы UUID)
  brand_ids: string[] | null;
  segment_ids: string[] | null;
  geography_ids: string[] | null;

  // Embeddings (vector для семантического поиска)
  embedding: number[] | null;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Document с подгруженными связями
 */
export interface DocumentWithRelations extends Document {
  source?: Source | null;
  brands?: Brand[];
  segments?: SegmentEntity[];
  geographies?: Geography[];
}

/**
 * Form Data для создания документа
 */
export interface CreateDocumentFormData {
  title: string;
  description?: string;
  document_type: DocumentType;
  content_text?: string;
  content_html?: string;
  file_url?: string;
  source_url?: string;
  source_id?: string;
  published_date?: string;
  brand_ids?: string[];
  segment_ids?: string[];
  geography_ids?: string[];
}

/**
 * Semantic Search Request
 */
export interface SemanticSearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

/**
 * Semantic Search Result
 */
export interface SemanticSearchResult extends Document {
  similarity: number; // 0.0 - 1.0 (1.0 = identical)
}

/**
 * ============================================================================
 * UPDATED: Market Event Types (with new fields)
 * ============================================================================
 */

export type CriticalityLevel = 1 | 2 | 3 | 4 | 5;

export interface MarketEvent {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  segment: Segment; // Legacy field (for backward compatibility)
  geography: string | null; // Legacy field (for backward compatibility)
  channel: Channel | null;
  event_type: EventType;
  company: string | null; // Company name
  description: string;
  criticality: number; // 1-5 (deprecated, use criticality_level)
  source_url: string | null; // Direct URL to original source
  raw_data: Record<string, unknown>; // Raw AI response (NO any!)
  found_by_search_run_id?: string; // FK to search_runs

  // NEW FIELDS:
  source_id: string | null; // FK to sources
  criticality_level: CriticalityLevel; // 1=низкая, 2=средняя, 3=обычная, 4=высокая, 5=критическая
  segment_id: string | null; // FK to segments
  geography_id: string | null; // FK to geographies
  detected_at: string; // When AI detected the event

  created_at: string;
  updated_at: string;
}

export interface MarketEventWithRelations extends MarketEvent {
  source?: Source;
  segment_entity?: SegmentEntity;
  geography_entity?: Geography;
}

export interface MarketEventFilter {
  dateFrom?: string;
  dateTo?: string;
  segments?: Segment[];
  channels?: Channel[];
  eventTypes?: EventType[];
  company?: string;
  minCriticality?: number;
  maxCriticality?: number;
  searchQuery?: string;
}

/**
 * ============================================================================
 * AI Prompt Types
 * ============================================================================
 */

export type SearchType =
  | 'marketing'
  | 'pricing'
  | 'regulations'
  | 'partnerships'
  | 'auctions'
  | 'general';

export type SearchDepth = 'daily' | 'weekly' | 'monthly';

export interface AIPrompt {
  id: string;
  name: string; // Unique name
  description: string | null;
  prompt_template: string; // Template with {variable} placeholders
  search_type: SearchType | null;
  is_active: boolean;
  parameters: PromptParameters; // Default parameters
  created_by: string; // User ID who created

  // NEW FIELDS:
  segment_id: string | null; // Специализация на определенный сегмент
  geography_id: string | null; // Географическая специализация
  search_depth: SearchDepth; // daily (акции), weekly (события), monthly (тренды)

  created_at: string;
  updated_at: string;
}

export interface AIPromptWithRelations extends AIPrompt {
  segment?: SegmentEntity;
  geography?: Geography;
}

/**
 * Связь Many-to-Many между промптами и сегментами
 */
export interface PromptSegment {
  prompt_id: string;
  segment_id: string;
  created_at: string;
}

export interface PromptParameters {
  date_range_days?: number;
  segments?: Segment[];
  geographies?: string[];
  channels?: Channel[];
  include_pr?: boolean;
  min_criticality?: number;
  [key: string]: unknown; // NO any!
}

export interface PromptTestResult {
  success: boolean;
  events: Partial<MarketEvent>[];
  rawResponse: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
}

/**
 * ============================================================================
 * OpenAI API Types (NEW!)
 * ============================================================================
 */

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenAISearchRequest {
  promptText: string;
  parameters: PromptParameters;
}

export interface OpenAISearchResult {
  date: string;
  segment: Segment;
  event_type: EventType;
  company: string;
  description: string;
  criticality: number;
  source_url: string;
}

export interface OpenAISearchResponse {
  events: OpenAISearchResult[];
  total_found: number;
  search_query: string;
}

/**
 * ============================================================================
 * Job Schedule Types
 * ============================================================================
 */

export interface JobSchedule {
  id: string;
  prompt_id: string;
  name: string; // Descriptive name
  cron_expression: string; // e.g., "0 9 * * *"
  is_active: boolean;
  parameters: PromptParameters;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_status?: 'success' | 'failed' | 'running';
  created_by: string; // User ID who created
  created_at: string;
  updated_at: string;
}

export interface ScheduleWithPrompt extends JobSchedule {
  prompt?: AIPrompt;
}

/**
 * ============================================================================
 * Search Run Types
 * ============================================================================
 */

export type SearchRunStatus = 'running' | 'completed' | 'failed';

export interface SearchRun {
  id: string;
  prompt_id: string;
  status: SearchRunStatus;
  events_found: number;
  parameters_used: PromptParameters;
  error_message: string | null;
  triggered_by: string; // User ID
  is_scheduled: boolean;
  started_at: string;
  completed_at: string | null;
  execution_time_seconds?: number;
  created_at?: string;
}

export interface SearchRunWithDetails extends SearchRun {
  prompt?: AIPrompt;
  triggerUser?: UserProfile;
  events?: MarketEvent[];
}

/**
 * ============================================================================
 * Audit Log Types
 * ============================================================================
 */

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create_prompt'
  | 'update_prompt'
  | 'delete_prompt'
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'create_user'
  | 'update_user'
  | 'delete_user'
  | 'create_schedule'
  | 'update_schedule'
  | 'delete_schedule'
  | 'run_search';

export type AuditResourceType = 'prompt' | 'event' | 'user' | 'schedule' | 'search_run';

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * ============================================================================
 * API Response Types
 * ============================================================================
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * ============================================================================
 * Dashboard Statistics Types
 * ============================================================================
 */

export interface DashboardStats {
  totalEvents: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
  avgCriticality: number;
  uniqueCompanies: number;
  criticalEventsCount: number; // Criticality >= 4
}

export interface EventStats {
  byType: Record<EventType, number>;
  bySegment: Record<Segment, number>;
  byChannel: Record<Channel, number>;
  byCriticality: Record<number, number>;
}

export interface TimeSeriesData {
  date: string;
  count: number;
  criticality?: number;
}

/**
 * ============================================================================
 * Export Report Types
 * ============================================================================
 */

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  dateFrom: string;
  dateTo: string;
  segments?: Segment[];
  channels?: Channel[];
  includeStats?: boolean;
  columns?: (keyof MarketEvent)[];
}

export interface ExportResult {
  filename: string;
  url: string;
  format: ExportFormat;
  generatedAt: string;
  recordCount: number;
}

/**
 * ============================================================================
 * Form Types
 * ============================================================================
 */

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  passwordConfirm: string;
  fullName?: string;
}

export interface CreateUserFormData {
  email: string;
  fullName: string;
  role: UserRole;
}

export interface CreatePromptFormData {
  name: string;
  description: string;
  promptTemplate: string;
  searchType: SearchType;
  parameters: PromptParameters;
  isActive: boolean;
}

export interface CreateScheduleFormData {
  promptId: string;
  name: string;
  cronExpression: string;
  parameters: PromptParameters;
  isActive: boolean;
}

/**
 * ============================================================================
 * Error Types
 * ============================================================================
 */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  details?: ValidationError[];
}
