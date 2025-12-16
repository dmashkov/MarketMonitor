-- ============================================================================
-- Migration 028: Prompt Templates & Monitoring Profiles for Scope-Aware Architecture
-- Date: 2025-12-16
-- Purpose: Create 3 monitoring scopes (Daily/Weekly/Monthly)
-- Architecture: Scope-Aware + Segment-Aware Query Generation
-- ============================================================================

-- 1. Add priority column to prompt_templates
ALTER TABLE public.prompt_templates
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 3;

COMMENT ON COLUMN public.prompt_templates.priority IS
'Prompt priority: 5=HIGH (daily critical), 3=MEDIUM (weekly overview), 2=LOW (monthly trends)';

-- 2. Add min_source_priority column to monitoring_profiles
ALTER TABLE public.monitoring_profiles
ADD COLUMN IF NOT EXISTS min_source_priority INT DEFAULT 1;

COMMENT ON COLUMN public.monitoring_profiles.min_source_priority IS
'Minimum source priority for filtering: 5=only critical sources, 3=medium+, 2=low+, 1=all';

-- ============================================================================
-- 3. SEED PROMPT TEMPLATES
-- ============================================================================

-- Template 1: Daily Critical Events (HIGH priority)
INSERT INTO public.prompt_templates (name, stage, template_text, priority, is_active, description)
VALUES (
  'Daily Critical Events',
  'hunt',
  'Найти КРИТИЧЕСКИЕ события на рынке климатического оборудования в России за последние 1-2 дня.

ПРИОРИТЕТ 1 (обязательно искать):
- Промо-акции, скидки, специальные предложения от дистрибьюторов
- Новые продукты, анонсы моделей от производителей
- Изменения условий поставок, кредитных программ
- Запуск производств в России, импортозамещение (ДАЖЕ СЛУХИ!)
- Крупные тендеры на VRF и промышленное оборудование
- Изменения в регуляции (правила ввоза, лицензирование, "Честный знак")
- Стратегические партнерства, дистрибьюторские соглашения

Сегменты: {segment_names}
География: Россия

Искать на сайтах:
- Дистрибьюторы климатического оборудования
- Производители (Daikin, Midea, Haier, LG, Ballu и др.)
- Тендерные площадки (ЕИС, Zakupki.gov.ru)
- Государственные органы (Минпромторг, Роспотребнадзор)

Вернуть ТОЛЬКО реальные URLs с актуальной информацией.',
  5,  -- HIGH priority
  true,
  'Ежедневный критический мониторинг для высокоприоритетных источников'
)
ON CONFLICT (name, stage) DO UPDATE SET
  template_text = EXCLUDED.template_text,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Template 2: Weekly Industry Overview (MEDIUM priority)
INSERT INTO public.prompt_templates (name, stage, template_text, priority, is_active, description)
VALUES (
  'Weekly Industry Overview',
  'hunt',
  'Найти отраслевые новости климатического рынка России за последние 7 дней.

ПРИОРИТЕТ 2 (средней важности):
- Новости профессиональных ассоциаций (АПИК, НП АВОК)
- Обзоры рынка климатического оборудования в бизнес-изданиях
- Аналитические статьи о трендах рынка HVAC
- Отраслевые мероприятия (выставки, конференции, семинары)
- Экспертные мнения, комментарии специалистов

Сегменты: {segment_names}
География: Россия

Искать на сайтах:
- Профессиональные ассоциации (АПИК, НП АВОК)
- Бизнес-издания (Коммерсант, РБК, Forbes)
- Отраслевые порталы (Abok.ru, C-O-K.ru)

Вернуть URLs с аналитическими материалами.',
  3,  -- MEDIUM priority
  true,
  'Еженедельный обзор отраслевых новостей для среднеприоритетных источников'
)
ON CONFLICT (name, stage) DO UPDATE SET
  template_text = EXCLUDED.template_text,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Template 3: Monthly Global Trends (LOW priority)
INSERT INTO public.prompt_templates (name, stage, template_text, priority, is_active, description)
VALUES (
  'Monthly Global Trends',
  'hunt',
  'Найти глобальные тренды в климатической индустрии за последний месяц.

ПРИОРИТЕТ 3 (низкий, но важный для стратегии):
- Новые технологии HVAC (IoT, AI, энергоэффективность)
- Глобальные тренды (декарбонизация, ESG, "зеленая" энергетика)
- Международные выставки, конференции (AHR Expo, Chillventa, Mostra Convegno)
- Глобальные инвестиции в климатическую индустрию
- Новые стандарты, международные регуляции

Сегменты: {segment_names}
География: Международная + Россия

Искать на сайтах:
- Международные отраслевые издания (HVAC Industry News, ACR News)
- Технологические порталы
- Аналитические агентства

Вернуть URLs с материалами о глобальных трендах.',
  2,  -- LOW priority
  true,
  'Ежемесячный анализ глобальных трендов для низкоприоритетных источников'
)
ON CONFLICT (name, stage) DO UPDATE SET
  template_text = EXCLUDED.template_text,
  priority = EXCLUDED.priority,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- 4. SEED MONITORING PROFILES
-- ============================================================================

-- Profile 1: Daily Critical Monitoring
INSERT INTO public.monitoring_profiles (
  name,
  description,
  is_active,
  segment_ids,
  geography_ids,
  priority,
  max_sources_per_run,
  min_source_priority,
  dedupe_threshold,
  prompt_template_id
)
SELECT
  'Daily Critical Monitoring',
  'Ежедневный мониторинг критических событий: промо-акции, производства, тендеры, регуляция',
  true,
  (SELECT ARRAY_AGG(id) FROM public.segments WHERE is_active = true),
  (SELECT ARRAY_AGG(id) FROM public.geographies WHERE code = 'RU'),
  5,  -- HIGH priority
  30, -- MAX 30 источников
  5,  -- ТОЛЬКО high-priority источники (distributors, manufacturers, government, tenders)
  0.85,
  (SELECT id FROM public.prompt_templates WHERE name = 'Daily Critical Events' AND stage = 'hunt' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.monitoring_profiles WHERE name = 'Daily Critical Monitoring'
);

-- Profile 2: Weekly Industry Overview
INSERT INTO public.monitoring_profiles (
  name,
  description,
  is_active,
  segment_ids,
  geography_ids,
  priority,
  max_sources_per_run,
  min_source_priority,
  dedupe_threshold,
  prompt_template_id
)
SELECT
  'Weekly Industry Overview',
  'Еженедельный обзор отраслевых новостей: ассоциации, бизнес-медиа, аналитика',
  true,
  (SELECT ARRAY_AGG(id) FROM public.segments WHERE is_active = true),
  (SELECT ARRAY_AGG(id) FROM public.geographies WHERE code = 'RU'),
  3,  -- MEDIUM priority
  15, -- MAX 15 источников
  3,  -- ТОЛЬКО medium+ источники (associations, some media)
  0.85,
  (SELECT id FROM public.prompt_templates WHERE name = 'Weekly Industry Overview' AND stage = 'hunt' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.monitoring_profiles WHERE name = 'Weekly Industry Overview'
);

-- Profile 3: Monthly Global Trends
INSERT INTO public.monitoring_profiles (
  name,
  description,
  is_active,
  segment_ids,
  geography_ids,
  priority,
  max_sources_per_run,
  min_source_priority,
  dedupe_threshold,
  prompt_template_id
)
SELECT
  'Monthly Global Trends',
  'Ежемесячный анализ глобальных трендов: технологии, международные выставки, инвестиции',
  true,
  (SELECT ARRAY_AGG(id) FROM public.segments WHERE is_active = true),
  NULL,  -- Международная география (не только РФ)
  2,  -- LOW priority
  10, -- MAX 10 источников
  2,  -- ВСЕ источники (включая low-priority аналитику)
  0.85,
  (SELECT id FROM public.prompt_templates WHERE name = 'Monthly Global Trends' AND stage = 'hunt' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.monitoring_profiles WHERE name = 'Monthly Global Trends'
);

-- ============================================================================
-- 5. VERIFICATION QUERIES (commented out, run manually if needed)
-- ============================================================================

-- Check prompt templates
-- SELECT id, name, stage, priority, is_active
-- FROM public.prompt_templates
-- WHERE stage = 'hunt'
-- ORDER BY priority DESC;

-- Check monitoring profiles
-- SELECT
--   id,
--   name,
--   priority,
--   min_source_priority,
--   max_sources_per_run,
--   is_active
-- FROM public.monitoring_profiles
-- ORDER BY priority DESC;

-- Check profile → template linkage
-- SELECT
--   mp.name as profile_name,
--   mp.priority as profile_priority,
--   mp.min_source_priority,
--   pt.name as template_name,
--   pt.priority as template_priority
-- FROM public.monitoring_profiles mp
-- LEFT JOIN public.prompt_templates pt ON mp.prompt_template_id = pt.id
-- WHERE mp.is_active = true
-- ORDER BY mp.priority DESC;

-- ============================================================================
-- Migration Complete
-- ============================================================================
