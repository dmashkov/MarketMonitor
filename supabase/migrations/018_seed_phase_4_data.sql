-- Migration 018: Phase 4 Initial Data Seeding
-- Date: 2025-12-14
-- Purpose: Seed initial event types, prompt templates, and monitoring profiles

-- ============================================================================
-- 1. SEED EVENT_TYPES
-- ============================================================================

INSERT INTO public.event_types (code, name, description, is_active)
VALUES
  ('promo_discount', 'Скидка/Акция', 'Рекламные скидки, акции, промоции', true),
  ('price_change', 'Изменение цены', 'Изменение цены на продукцию', true),
  ('payment_terms', 'Условия оплаты', 'Изменение условий оплаты, кредитных программ', true),
  ('assortment_launch', 'Запуск ассортимента', 'Запуск новых моделей, продуктов', true),
  ('distribution_change', 'Изменение дистрибуции', 'Изменение каналов продаж, дилеров', true),
  ('tender_project', 'Тендер/Проект', 'Тендеры, госзакупки, проекты', true),
  ('pr_media', 'PR/Медиа', 'Пресс-релизы, статьи, упоминания в медиа', true),
  ('regulatory', 'Регуляция', 'Изменения в законодательстве, стандартах', true),
  ('logistics_supply', 'Логистика/Поставки', 'Изменения в поставках, логистике', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. SEED PROMPT_TEMPLATES
-- ============================================================================

INSERT INTO public.prompt_templates (name, stage, template_text, is_active, description)
VALUES
  (
    'Document Classification',
    'classify',
    'You are a market analyst for HVAC equipment in Russia.

Analyze the following document about climate control market and classify it according to the available taxonomies.

Available segments: {segments_enum}
Available event types: {event_types_enum}
Available brands: {brands_list}
Available geographies: {geographies_list}

Document to analyze:
---
Title: {title}
Content: {content_text}
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
- The response MUST be valid JSON, nothing else',
    true,
    'Main classification template for document processor agent'
  ),
  (
    'Event Extraction',
    'extract',
    'You are extracting market events from climate equipment news in Russia.

Document:
Title: {title}
Segments: {segment_names}
Brands: {brand_names}
Geographies: {geography_names}
Content: {content_text}

Extract structured events. Each event must have:
- date (YYYY-MM-DD or inferred from context)
- event_type (from enum)
- description (2-3 sentences)
- company (if mentioned)
- segment (from document)
- geography (if mentioned)
- source_url (from document)

Return JSON:
{
  "events": [
    {
      "date": "2025-12-14",
      "event_type": "promo_discount",
      "description": "...",
      "company": "Daikin",
      "segment": "RAC",
      "geography": "Moscow",
      "criticality_level": 3
    }
  ]
}

Rules:
- Can return 0, 1, 2, or more events
- If no clear events, return empty array
- Be specific and factual',
    true,
    'Event extraction template for event extractor agent'
  ),
  (
    'Criticality Scoring',
    'score',
    'You are evaluating market importance of climate equipment news in Russia.

Document summary:
Title: {title}
Segments: {segment_names}
Brands: {brand_names}
Event types: {event_type_names}
Content: {content_text_first_200_chars}

Rate importance (1-5):
1 = Minor, local event, low impact
2 = Regional event, some impact
3 = Noteworthy, moderate impact
4 = Important, significant market impact
5 = Critical, affects entire market

Return JSON:
{
  "criticality_level": 1-5,
  "reasoning": "brief explanation"
}',
    true,
    'Criticality scoring template for criticality scorer agent'
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. SEED MONITORING_PROFILES
-- ============================================================================

INSERT INTO public.monitoring_profiles (
  name,
  description,
  is_active,
  segment_ids,
  brand_ids,
  geography_ids,
  event_type_ids,
  priority,
  max_sources_per_run,
  dedupe_threshold,
  prompt_template_id
)
SELECT
  'MVP Test Profile - All Segments',
  'Initial test profile monitoring all segments and event types in Russia',
  true,
  (SELECT ARRAY_AGG(id) FROM public.segments WHERE is_active = true),
  ARRAY[]::UUID[],
  (SELECT ARRAY_AGG(id) FROM public.geographies WHERE is_active = true),
  (SELECT ARRAY_AGG(id) FROM public.event_types WHERE is_active = true),
  5,
  20,
  0.85,
  (SELECT id FROM public.prompt_templates WHERE name = 'Document Classification' AND stage = 'classify' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.monitoring_profiles
  WHERE name = 'MVP Test Profile - All Segments'
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
