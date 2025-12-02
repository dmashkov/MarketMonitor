/**
 * User and Authentication Types
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

/**
 * Market Event Types
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

export interface MarketEvent {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  segment: Segment;
  geography: string | null; // Region name
  channel: Channel | null;
  event_type: EventType;
  company: string | null; // Company name
  description: string;
  criticality: number; // 1-5
  source_url: string | null; // URL to original source
  raw_data: Record<string, any>; // Raw AI response
  found_by_search_run_id?: string; // FK to search_runs
  created_at: string;
  updated_at: string;
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
 * AI Prompt Types
 */
export type SearchType =
  | 'marketing'
  | 'pricing'
  | 'regulations'
  | 'partnerships'
  | 'auctions'
  | 'general';

export interface AIPrompt {
  id: string;
  name: string; // Unique name
  description: string | null;
  prompt_template: string; // Template with {variable} placeholders
  search_type: SearchType | null;
  is_active: boolean;
  parameters: PromptParameters; // Default parameters
  created_by: string; // User ID who created
  created_at: string;
  updated_at: string;
}

export interface PromptParameters {
  date_range_days?: number;
  segments?: Segment[];
  geographies?: string[];
  channels?: Channel[];
  include_pr?: boolean;
  min_criticality?: number;
  [key: string]: any;
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
 * Job Schedule Types
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
 * Search Run Types
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
 * Audit Log Types
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
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * API Response Types
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
 * Dashboard Statistics Types
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
 * Export Report Types
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
 * Form Types
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
 * Error Types
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
