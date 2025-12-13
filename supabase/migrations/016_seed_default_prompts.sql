-- ============================================================================
-- Migration 016: Seed default AI prompts
-- ============================================================================

-- Insert default AI prompts for different search types and frequencies
INSERT INTO ai_prompts (
  name,
  description,
  prompt_template,
  search_type,
  search_depth,
  is_active,
  segment_id,
  geography_id,
  created_by
) VALUES
  -- Daily Search Prompts
  (
    'Daily Market Actions - All Segments',
    'Daily search for market events, actions, and announcements across all segments',
    'Найти события на рынке климатического оборудования в России за последние 1 день.
Искать: новости о акциях, снижении цен, промоциях, скидках.
Компании: Daikin, Midea, Haier, Ballu, Gree, LG, Panasonic и другие.
Источники: новостные сайты, пресс-релизы, социальные сети.

Формат ответа - JSON массив событий:
[{
  "date": "2025-12-13",
  "company": "Компания",
  "event_type": "акция",
  "channel": "B2B",
  "description": "Описание события",
  "criticality": 3,
  "source_url": "https://..."
}]',
    'marketing',
    'daily',
    true,
    NULL,
    NULL,
    NULL
  ),
  (
    'Daily Price Changes - RAC Segment',
    'Daily price monitoring for room air conditioner segment',
    'Найти изменения цен на кондиционеры RAC (Room Air Conditioner) в России за последние 1 день.
Искать: прайс-листы, ценовые анонсы, скидки, спецпредложения.
Бренды: Daikin, Midea, Haier, Ballu, Gree, LG.

Формат ответа - JSON массив:
[{
  "date": "2025-12-13",
  "company": "Компания",
  "event_type": "цены",
  "description": "Описание ценового события",
  "criticality": 2,
  "source_url": "https://..."
}]',
    'pricing',
    'daily',
    true,
    (SELECT id FROM segments WHERE code = 'RAC' LIMIT 1),
    (SELECT id FROM geographies WHERE code = 'RU' LIMIT 1),
    NULL
  ),
  -- Weekly Search Prompts
  (
    'Weekly Industry Partnerships',
    'Weekly search for partnerships, collaborations, and strategic alliances',
    'Найти события о партнерствах, сотрудничестве и стратегических альянсах на рынке климатического оборудования в России за последние 7 дней.
Компании: производители, дистрибьюторы, системные интеграторы.
Ключевые области: эксклюзивные представительства, совместные разработки, дистрибьютерские сети.

Формат ответа - JSON:
[{
  "date": "2025-12-13",
  "company": "Компания",
  "event_type": "соглашение",
  "description": "Описание партнерства",
  "criticality": 4,
  "source_url": "https://..."
}]',
    'partnerships',
    'weekly',
    true,
    NULL,
    NULL,
    NULL
  ),
  (
    'Weekly Regulatory Updates',
    'Weekly tracking of regulatory changes, standards, and compliance updates',
    'Найти информацию о нормативных изменениях, ГОСТах, и требованиях в сфере климатического оборудования в России за последние 7 дней.
Источники: Роспотребнадзор, Минэнерго, ГИЦ Минпромторга, ВНИИМП.
Ключевые темы: энергоэффективность, экологические требования, сертификация, маркировка.

Формат ответа - JSON:
[{
  "date": "2025-12-13",
  "event_type": "регулирование",
  "description": "Описание нормативного изменения",
  "criticality": 5,
  "source_url": "https://..."
}]',
    'regulations',
    'weekly',
    true,
    NULL,
    NULL,
    NULL
  ),
  -- Monthly Search Prompts
  (
    'Monthly Market Trends Analysis',
    'Monthly overview of market trends, growth patterns, and industry dynamics',
    'Проанализировать тренды на рынке климатического оборудования в России за последний месяц.
Анализировать: рост объемов продаж, изменение доли рынка между брендами, появление новых категорий оборудования.
Компании: Daikin, Midea, Haier, Ballu, Gree, LG, Panasonic, Toshiba и другие.
Сегменты: RAC, VRF, чиллеры, вентиляция, тепловые насосы.

Формат ответа - JSON с анализом тенденций:
[{
  "date": "2025-12-13",
  "event_type": "акция",
  "description": "Описание тренда или события",
  "criticality": 3,
  "analysis": "Анализ значения события для рынка"
}]',
    'general',
    'monthly',
    true,
    NULL,
    NULL,
    NULL
  ),
  (
    'Monthly Competitive Intelligence',
    'Monthly competitor activity tracking and market positioning analysis',
    'Собрать информацию о конкурентной деятельности ведущих брендов на рынке климатического оборудования в России за последний месяц.
Мониторить: запуск новых продуктов, маркетинговые кампании, расширение дистрибьюторской сети, участие в выставках.
Ключевые конкуренты: Daikin, Midea, Haier, LG.

Формат ответа - JSON:
[{
  "date": "2025-12-13",
  "company": "Компания",
  "event_type": "pr",
  "description": "Конкурентное действие",
  "criticality": 3,
  "competitor_segment": "Категория оборудования"
}]',
    'marketing',
    'monthly',
    true,
    NULL,
    NULL,
    NULL
  );

-- Add RLS policy for ai_prompts if not exists
DROP POLICY IF EXISTS "authenticated_users_read_prompts" ON ai_prompts;
CREATE POLICY "authenticated_users_read_prompts"
  ON ai_prompts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admins_manage_prompts" ON ai_prompts;
CREATE POLICY "admins_manage_prompts"
  ON ai_prompts
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin');
