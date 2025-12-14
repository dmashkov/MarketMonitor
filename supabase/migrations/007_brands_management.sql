-- Migration 007: Brands Management
-- Создано: 2024-12-07
-- Описание: Таблицы для управления брендами и их связью с сегментами

-- ============================================================
-- ТАБЛИЦА: brands
-- ============================================================
-- Справочник брендов климатического оборудования
-- Примеры: Daikin, Midea, Haier, Ballu, Gree, TCL, etc.

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Основная информация
  name TEXT NOT NULL UNIQUE,                    -- Название бренда (например, "Daikin")
  manufacturer TEXT,                             -- Производитель (может отличаться от бренда)
  country TEXT,                                  -- Страна производства/головной офис

  -- Категоризация
  category TEXT CHECK (category IN ('premium', 'middle', 'budget')),

  -- Ссылки и медиа
  website_url TEXT,                              -- Официальный сайт
  logo_url TEXT,                                 -- Ссылка на логотип

  -- Дополнительная информация
  description TEXT,                              -- Краткое описание бренда

  -- Статус
  is_active BOOLEAN DEFAULT true,                -- Активен ли бренд для мониторинга

  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);
CREATE INDEX IF NOT EXISTS idx_brands_category ON brands(category);
CREATE INDEX IF NOT EXISTS idx_brands_is_active ON brands(is_active);

-- Триггер для обновления updated_at
DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарии
COMMENT ON TABLE brands IS 'Справочник брендов климатического оборудования';
COMMENT ON COLUMN brands.name IS 'Название бренда (уникальное)';
COMMENT ON COLUMN brands.category IS 'Категория: premium, middle, budget';
COMMENT ON COLUMN brands.is_active IS 'Активен ли бренд для мониторинга';

-- ============================================================
-- ТАБЛИЦА: brand_segments
-- ============================================================
-- Many-to-Many связь между брендами и сегментами
-- Один бренд может производить оборудование для нескольких сегментов

CREATE TABLE IF NOT EXISTS brand_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Связи
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,

  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Уникальная пара brand + segment
  UNIQUE(brand_id, segment_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_brand_segments_brand_id ON brand_segments(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_segments_segment_id ON brand_segments(segment_id);

-- Комментарии
COMMENT ON TABLE brand_segments IS 'Many-to-Many связь: бренды ↔ сегменты оборудования';

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Включаем Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_segments ENABLE ROW LEVEL SECURITY;

-- brands: все могут читать, только админы могут модифицировать
DROP POLICY IF EXISTS "Users can view brands" ON brands;
CREATE POLICY "Users can view brands"
  ON brands FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage brands" ON brands;
CREATE POLICY "Only admins can manage brands"
  ON brands FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- brand_segments: все могут читать, только админы могут модифицировать
DROP POLICY IF EXISTS "Users can view brand segments" ON brand_segments;
CREATE POLICY "Users can view brand segments"
  ON brand_segments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage brand segments" ON brand_segments;
CREATE POLICY "Only admins can manage brand segments"
  ON brand_segments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================
-- SEED DATA: Популярные бренды
-- ============================================================

-- Premium бренды
INSERT INTO brands (name, manufacturer, country, category, website_url, description, is_active) VALUES
  ('Daikin', 'Daikin Industries', 'Япония', 'premium', 'https://www.daikin.ru', 'Японский премиум бренд, лидер в VRF и промышленных системах', true),
  ('Mitsubishi Electric', 'Mitsubishi Electric', 'Япония', 'premium', 'https://www.mitsubishi-electric.ru', 'Японский бренд премиум класса', true),
  ('Fujitsu General', 'Fujitsu General', 'Япония', 'premium', 'https://www.fujitsu-general.ru', 'Японский производитель климатической техники', true),
  ('Panasonic', 'Panasonic Corporation', 'Япония', 'premium', 'https://www.panasonic.com/ru', 'Японский бренд с широкой линейкой', true)
ON CONFLICT (name) DO NOTHING;

-- Middle бренды (китайские лидеры)
INSERT INTO brands (name, manufacturer, country, category, website_url, description, is_active) VALUES
  ('Midea', 'Midea Group', 'Китай', 'middle', 'https://www.midea.ru', 'Крупнейший китайский производитель климатической техники', true),
  ('Gree', 'Gree Electric', 'Китай', 'middle', 'https://www.gree.ru', 'Китайский бренд, один из лидеров по объему производства', true),
  ('Haier', 'Haier Group', 'Китай', 'middle', 'https://www.haier.ru', 'Крупный китайский производитель бытовой техники', true),
  ('TCL', 'TCL Corporation', 'Китай', 'middle', 'https://www.tcl.com', 'Китайский бренд с широкой линейкой', true),
  ('Hisense', 'Hisense Group', 'Китай', 'middle', 'https://www.hisense.ru', 'Китайский производитель бытовой техники', true)
ON CONFLICT (name) DO NOTHING;

-- Budget бренды (локальные и бюджетные)
INSERT INTO brands (name, manufacturer, country, category, website_url, description, is_active) VALUES
  ('Ballu', 'Ballu Industrial Group', 'Россия/Китай', 'budget', 'https://www.ballu.ru', 'Популярный бюджетный бренд на российском рынке', true),
  ('Electrolux', 'Electrolux AB', 'Швеция', 'middle', 'https://www.electrolux.ru', 'Шведский производитель бытовой техники', true),
  ('Zanussi', 'Electrolux AB', 'Италия', 'budget', 'https://www.zanussi.ru', 'Итальянский бюджетный бренд (принадлежит Electrolux)', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED DATA: Связи брендов и сегментов
-- ============================================================

-- Для связей нам нужны ID сегментов из таблицы segments (Migration 005)
-- Предполагаем, что сегменты уже созданы: RAC, VRF, Chiller, AHU, Industrial, Heat Pumps, Ventilation, Refrigeration

-- Daikin (premium) - присутствует во всех сегментах
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Daikin'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF', 'Chiller', 'AHU', 'Industrial', 'Heat Pumps', 'Ventilation')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Mitsubishi Electric (premium) - RAC, VRF, Industrial
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Mitsubishi Electric'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF', 'Industrial', 'Heat Pumps')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Fujitsu General (premium) - RAC, VRF
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Fujitsu General'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Panasonic (premium) - RAC, VRF, Heat Pumps
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Panasonic'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF', 'Heat Pumps')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Midea (middle) - RAC, VRF, Chiller, AHU, Industrial
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Midea'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF', 'Chiller', 'AHU', 'Industrial')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Gree (middle) - RAC, VRF, Chiller
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Gree'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF', 'Chiller')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Haier (middle) - RAC, VRF, Chiller, Refrigeration
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Haier'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF', 'Chiller', 'Refrigeration')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- TCL (middle) - RAC
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'TCL'),
  id
FROM segments
WHERE name IN ('RAC')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Hisense (middle) - RAC, VRF
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Hisense'),
  id
FROM segments
WHERE name IN ('RAC', 'VRF')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Ballu (budget) - RAC, Ventilation, Heat Pumps
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Ballu'),
  id
FROM segments
WHERE name IN ('RAC', 'Ventilation', 'Heat Pumps')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Electrolux (middle) - RAC, Heat Pumps, Refrigeration
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Electrolux'),
  id
FROM segments
WHERE name IN ('RAC', 'Heat Pumps', 'Refrigeration')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- Zanussi (budget) - RAC, Refrigeration
INSERT INTO brand_segments (brand_id, segment_id)
SELECT
  (SELECT id FROM brands WHERE name = 'Zanussi'),
  id
FROM segments
WHERE name IN ('RAC', 'Refrigeration')
ON CONFLICT (brand_id, segment_id) DO NOTHING;

-- ============================================================
-- ФУНКЦИИ ДЛЯ РАБОТЫ С БРЕНДАМИ
-- ============================================================

-- Функция для получения всех сегментов бренда
CREATE OR REPLACE FUNCTION get_brand_segments(p_brand_id UUID)
RETURNS TABLE (
  segment_id UUID,
  segment_name TEXT,
  segment_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.code
  FROM segments s
  INNER JOIN brand_segments bs ON bs.segment_id = s.id
  WHERE bs.brand_id = p_brand_id
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция для получения всех брендов в сегменте
CREATE OR REPLACE FUNCTION get_segment_brands(p_segment_id UUID)
RETURNS TABLE (
  brand_id UUID,
  brand_name TEXT,
  brand_category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.category
  FROM brands b
  INNER JOIN brand_segments bs ON bs.brand_id = b.id
  WHERE bs.segment_id = p_segment_id
    AND b.is_active = true
  ORDER BY b.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ГОТОВО!
-- ============================================================

-- Проверка: сколько брендов создано
DO $$
DECLARE
  brand_count INTEGER;
  segment_link_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO brand_count FROM brands;
  SELECT COUNT(*) INTO segment_link_count FROM brand_segments;

  RAISE NOTICE 'Migration 007 completed successfully!';
  RAISE NOTICE 'Brands created: %', brand_count;
  RAISE NOTICE 'Brand-Segment links created: %', segment_link_count;
END $$;
