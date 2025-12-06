/**
 * Shared types for Edge Functions
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
  date: string; // ISO date (YYYY-MM-DD)
  segment: Segment;
  geography: string | null;
  channel: Channel | null;
  event_type: EventType;
  company: string | null;
  description: string;
  criticality: number; // 1-5
  source_url: string | null;
}

export interface SearchRunParams {
  days?: number; // How many days back to search (default: 7)
  segments?: Segment[]; // Filter by segments (optional)
  event_types?: EventType[]; // Filter by event types (optional)
}

export interface SearchRunResult {
  search_run_id: string;
  status: 'completed' | 'failed';
  events_found: number;
  events: MarketEvent[];
  error_message?: string;
  execution_time_seconds: number;
}
