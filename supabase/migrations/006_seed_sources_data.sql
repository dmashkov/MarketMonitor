-- =====================================================
-- Migration 006: Seed Data - Sources, Segments, Geographies
-- Description: Начальные данные для источников мониторинга
-- Created: 2024-12-05
-- =====================================================

-- =====================================================
-- 1. SEGMENTS (Сегменты оборудования)
-- =====================================================

INSERT INTO public.segments (name, code, description) VALUES
  ('RAC (Room Air Conditioner)', 'RAC', 'Бытовые кондиционеры и сплит-системы'),
  ('VRF (Variable Refrigerant Flow)', 'VRF', 'Мультизональные системы кондиционирования'),
  ('Chiller', 'CHILLER', 'Чиллеры и системы центрального кондиционирования'),
  ('AHU (Air Handling Unit)', 'AHU', 'Приточно-вытяжные установки'),
  ('Промышленное тепловое оборудование', 'INDUSTRIAL_HEAT', 'Промышленные системы отопления и вентиляции'),
  ('Тепловые насосы', 'HEAT_PUMP', 'Тепловые насосы для отопления и ГВС'),
  ('Вентиляция', 'VENTILATION', 'Вентиляционное оборудование'),
  ('Холодильное оборудование', 'REFRIGERATION', 'Промышленное и коммерческое холодильное оборудование')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 2. GEOGRAPHIES (Географические зоны)
-- =====================================================

-- Страна
INSERT INTO public.geographies (name, code, type, parent_id) VALUES
  ('Россия', 'RU', 'country', NULL)
ON CONFLICT (code) DO NOTHING;

-- Федеральные округа
INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Центральный ФО', 'RU_CFO', 'region', id FROM public.geographies WHERE code = 'RU' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Северо-Западный ФО', 'RU_NWFO', 'region', id FROM public.geographies WHERE code = 'RU' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Южный ФО', 'RU_SFO', 'region', id FROM public.geographies WHERE code = 'RU' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Приволжский ФО', 'RU_PFO', 'region', id FROM public.geographies WHERE code = 'RU' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Уральский ФО', 'RU_UFO', 'region', id FROM public.geographies WHERE code = 'RU' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Сибирский ФО', 'RU_SIBFO', 'region', id FROM public.geographies WHERE code = 'RU' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Дальневосточный ФО', 'RU_DFO', 'region', id FROM public.geographies WHERE code = 'RU' LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- Основные города
INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Москва', 'RU_MOW', 'city', id FROM public.geographies WHERE code = 'RU_CFO' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Санкт-Петербург', 'RU_SPB', 'city', id FROM public.geographies WHERE code = 'RU_NWFO' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Екатеринбург', 'RU_EKB', 'city', id FROM public.geographies WHERE code = 'RU_UFO' LIMIT 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (name, code, type, parent_id)
SELECT 'Новосибирск', 'RU_NSK', 'city', id FROM public.geographies WHERE code = 'RU_SIBFO' LIMIT 1
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 3. SOURCE TYPES (Типы источников)
-- =====================================================

INSERT INTO public.source_types (name, code, description) VALUES
  ('Дистрибьютор', 'DISTRIBUTOR', 'Официальные дистрибьюторы климатического оборудования'),
  ('Производитель', 'MANUFACTURER', 'Представительства и филиалы производителей'),
  ('Деловые СМИ', 'BUSINESS_MEDIA', 'Бизнес издания и новостные порталы'),
  ('Telegram канал', 'TELEGRAM', 'Telegram каналы с отраслевыми новостями'),
  ('Профессиональная ассоциация', 'ASSOCIATION', 'Отраслевые ассоциации и объединения'),
  ('Отраслевой портал', 'INDUSTRY_PORTAL', 'Специализированные отраслевые порталы')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 4. SOURCES - Дистрибьюторы
-- =====================================================

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'Русклимат',
  (SELECT id FROM public.source_types WHERE code = 'DISTRIBUTOR' LIMIT 1),
  'https://rusclimate.ru',
  'Крупнейший дистрибьютор климатического оборудования в России',
  10,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'Даичи',
  (SELECT id FROM public.source_types WHERE code = 'DISTRIBUTOR' LIMIT 1),
  'https://daiichi.ru',
  'Официальный дистрибьютор японского климатического оборудования',
  9,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'АЯК',
  (SELECT id FROM public.source_types WHERE code = 'DISTRIBUTOR' LIMIT 1),
  'https://ayak.ru',
  'Дистрибьютор климатической техники, VRF систем',
  9,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'Бриз',
  (SELECT id FROM public.source_types WHERE code = 'DISTRIBUTOR' LIMIT 1),
  'https://briz.ru',
  'Дистрибьютор систем вентиляции и кондиционирования',
  8,
  'daily'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. SOURCES - Производители
-- =====================================================

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'MIDEA Russia',
  (SELECT id FROM public.source_types WHERE code = 'MANUFACTURER' LIMIT 1),
  'https://midea.ru',
  'Официальное представительство MIDEA в России',
  10,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'GREE Russia',
  (SELECT id FROM public.source_types WHERE code = 'MANUFACTURER' LIMIT 1),
  'https://gree.ru',
  'Официальное представительство GREE в России',
  10,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'HAIER Russia',
  (SELECT id FROM public.source_types WHERE code = 'MANUFACTURER' LIMIT 1),
  'https://haier.com/ru',
  'Официальное представительство HAIER в России',
  9,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'TCL Russia',
  (SELECT id FROM public.source_types WHERE code = 'MANUFACTURER' LIMIT 1),
  'https://tcl.com/ru',
  'Официальное представительство TCL в России',
  9,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'HISENSE Russia',
  (SELECT id FROM public.source_types WHERE code = 'MANUFACTURER' LIMIT 1),
  'https://hisense.ru',
  'Официальное представительство HISENSE в России',
  9,
  'daily'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. SOURCES - Деловые СМИ
-- =====================================================

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'Forbes Россия',
  (SELECT id FROM public.source_types WHERE code = 'BUSINESS_MEDIA' LIMIT 1),
  'https://www.forbes.ru',
  'Деловое издание Forbes, российская версия',
  8,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'Ведомости',
  (SELECT id FROM public.source_types WHERE code = 'BUSINESS_MEDIA' LIMIT 1),
  'https://www.vedomosti.ru',
  'Ведущее деловое издание России',
  9,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'Коммерсантъ',
  (SELECT id FROM public.source_types WHERE code = 'BUSINESS_MEDIA' LIMIT 1),
  'https://www.kommersant.ru',
  'Ежедневная общенациональная деловая газета',
  9,
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'РБК',
  (SELECT id FROM public.source_types WHERE code = 'BUSINESS_MEDIA' LIMIT 1),
  'https://www.rbc.ru',
  'Российская медиагруппа РБК',
  8,
  'daily'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. SOURCES - Профессиональные ассоциации
-- =====================================================

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'АВОК (Ассоциация инженеров по отоплению, вентиляции, кондиционированию воздуха)',
  (SELECT id FROM public.source_types WHERE code = 'ASSOCIATION' LIMIT 1),
  'https://www.abok.ru',
  'Главная профессиональная ассоциация в сфере HVAC',
  10,
  'weekly'
ON CONFLICT DO NOTHING;

INSERT INTO public.sources (name, source_type_id, website_url, description, priority, check_frequency)
SELECT
  'АПИК (Ассоциация предприятий индустрии климата)',
  (SELECT id FROM public.source_types WHERE code = 'ASSOCIATION' LIMIT 1),
  'https://apic.ru',
  'Ассоциация предприятий индустрии климата',
  10,
  'weekly'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 8. SOURCE_URLS - Конкретные разделы для мониторинга
-- =====================================================

-- Русклимат
INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'Русклимат' LIMIT 1),
  'https://rusclimate.ru/news/',
  'news',
  'Раздел новостей Русклимат',
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'Русклимат' LIMIT 1),
  'https://rusclimate.ru/actions/',
  'news',
  'Акции и спецпредложения Русклимат',
  'daily'
ON CONFLICT DO NOTHING;

-- MIDEA
INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'MIDEA Russia' LIMIT 1),
  'https://midea.ru/news/',
  'news',
  'Новости MIDEA Россия',
  'daily'
ON CONFLICT DO NOTHING;

INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'MIDEA Russia' LIMIT 1),
  'https://midea.ru/press/',
  'press-release',
  'Пресс-релизы MIDEA',
  'daily'
ON CONFLICT DO NOTHING;

-- Forbes
INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'Forbes Россия' LIMIT 1),
  'https://www.forbes.ru/biznes',
  'news',
  'Раздел "Бизнес" Forbes',
  'daily'
ON CONFLICT DO NOTHING;

-- Ведомости
INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'Ведомости' LIMIT 1),
  'https://www.vedomosti.ru/business',
  'news',
  'Раздел "Бизнес" Ведомости',
  'daily'
ON CONFLICT DO NOTHING;

-- АВОК
INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'АВОК (Ассоциация инженеров по отоплению, вентиляции, кондиционированию воздуха)' LIMIT 1),
  'https://www.abok.ru/news/',
  'news',
  'Новости АВОК',
  'weekly'
ON CONFLICT DO NOTHING;

-- АПИК
INSERT INTO public.source_urls (source_id, url, url_type, description, check_frequency)
SELECT
  (SELECT id FROM public.sources WHERE name = 'АПИК (Ассоциация предприятий индустрии климата)' LIMIT 1),
  'https://apic.ru/news/',
  'news',
  'Новости АПИК',
  'weekly'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 9. SAMPLE AI PROMPTS с сегментами и глубиной
-- =====================================================

-- Daily: RAC сегмент - акции и спецпредложения
INSERT INTO public.ai_prompts (
  name,
  prompt_template,
  search_type,
  is_active,
  segment_id,
  search_depth
)
SELECT
  'Daily RAC Акции',
  'Найди информацию о текущих акциях, скидках и спецпредложениях на бытовые кондиционеры и сплит-системы (RAC) в России. Фокус на краткосрочные маркетинговые активности (от 1 дня до 2 недель). Источники: дистрибьюторы, производители, розничные сети.',
  'market_monitoring',
  true,
  (SELECT id FROM public.segments WHERE code = 'RAC' LIMIT 1),
  'daily'
ON CONFLICT DO NOTHING;

-- Weekly: VRF сегмент - проекты и контракты
INSERT INTO public.ai_prompts (
  name,
  prompt_template,
  search_type,
  is_active,
  segment_id,
  search_depth
)
SELECT
  'Weekly VRF Проекты',
  'Найди информацию о новых проектах, контрактах, сотрудничестве в сегменте мультизональных систем кондиционирования (VRF) в России. Фокус на: внедрения в крупных объектах, стратегические соглашения, дилерские контракты. Источники: деловые СМИ, пресс-релизы производителей, отраслевые порталы.',
  'market_monitoring',
  true,
  (SELECT id FROM public.segments WHERE code = 'VRF' LIMIT 1),
  'weekly'
ON CONFLICT DO NOTHING;

-- Monthly: Общий рынок - тренды и аналитика
INSERT INTO public.ai_prompts (
  name,
  prompt_template,
  search_type,
  is_active,
  segment_id,
  search_depth
)
SELECT
  'Monthly Market Trends',
  'Найди аналитические материалы, обзоры рынка, прогнозы и тренды климатической индустрии России. Фокус на: импортозамещение, новые производства, изменения законодательства, статистика продаж, стратегические тенденции. Источники: деловые СМИ, отраслевые ассоциации (АВОК, АПИК), аналитические агентства.',
  'market_monitoring',
  true,
  NULL,
  'monthly'
ON CONFLICT DO NOTHING;

-- =====================================================
-- 10. CRITICALITY EXAMPLES - для справки
-- =====================================================

COMMENT ON COLUMN public.events.criticality_level IS
'Уровень критичности события (1-5):
1 = Низкая (routine news, мелкие анонсы)
2 = Средняя (локальные акции, небольшие сделки)
3 = Обычная (стандартные события, типовые новости)
4 = Высокая (крупные сделки, важные анонсы, стратегические партнерства)
5 = Критическая (запуск производства, мега-контракты с девелоперами, изменения законодательства, импортозамещение)

Примеры критичности 5:
- Стратегическое соглашение с крупными девелоперами (ПИК, Самолет, Эталон)
- Запуск или анонс импортозамещающего производства
- Крупные государственные контракты (>100 млн руб)
- Изменения в технических регламентах
- Банкротство или уход крупного игрока с рынка';
