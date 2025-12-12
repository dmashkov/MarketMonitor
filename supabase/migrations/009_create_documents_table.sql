-- ============================================================================
-- Migration 009: Create Documents Table
-- ============================================================================
-- Создание таблицы documents для хранения PDF/DOCX/PPTX/HTML документов
-- С поддержкой семантического поиска через pgvector embeddings
-- ============================================================================

-- Включаем расширение vector для embeddings (если еще не включено)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ТАБЛИЦА: documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Основная информация
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT CHECK (document_type IN (
    'pdf',
    'docx',
    'pptx',
    'html',
    'webpage'
  )) NOT NULL,

  -- Контент
  content_text TEXT,     -- Извлеченный текст для full-text search и embeddings
  content_html TEXT,     -- HTML версия контента
  file_url TEXT,         -- Ссылка на файл в Supabase Storage (bucket: market-documents)
  source_url TEXT,       -- URL откуда взят документ (для веб-страниц)

  -- Метаданные
  source_id UUID REFERENCES sources(id),
  published_date TIMESTAMP WITH TIME ZONE,  -- Дата публикации документа
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Когда документ был получен

  -- Связи с брендами, сегментами, географиями (массивы UUID)
  brand_ids UUID[],      -- Упомянутые бренды
  segment_ids UUID[],    -- Сегменты
  geography_ids UUID[],  -- Географии

  -- Векторное представление для семантического поиска
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small (1536 dimensions)

  -- Метаданные аудита
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- Индексы для производительности
-- ============================================================================

-- Основные индексы
CREATE INDEX idx_documents_source_id ON documents(source_id);
CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_published_date ON documents(published_date DESC NULLS LAST);
CREATE INDEX idx_documents_fetched_at ON documents(fetched_at DESC);
CREATE INDEX idx_documents_created_by ON documents(created_by);

-- GIN индексы для массивов (быстрый поиск по вхождению)
CREATE INDEX idx_documents_brand_ids ON documents USING GIN(brand_ids);
CREATE INDEX idx_documents_segment_ids ON documents USING GIN(segment_ids);
CREATE INDEX idx_documents_geography_ids ON documents USING GIN(geography_ids);

-- Full-text search индекс (русский язык)
CREATE INDEX idx_documents_content_text_fts ON documents
  USING gin(to_tsvector('russian', COALESCE(content_text, '')));

-- Векторный индекс для семантического поиска (IVFFlat)
-- lists = 100 оптимально для ~10K-100K документов
CREATE INDEX idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- Триггеры
-- ============================================================================

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy 1: Все authenticated users могут читать документы
CREATE POLICY "Authenticated users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Admins могут делать всё
CREATE POLICY "Admins have full access to documents"
  ON documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy 3: Users могут создавать свои документы
CREATE POLICY "Users can create own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Policy 4: Users могут обновлять свои документы
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Policy 5: Users могут удалять свои документы
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ============================================================================
-- Комментарии
-- ============================================================================

COMMENT ON TABLE documents IS 'Хранилище документов (PDF, DOCX, PPTX, HTML) с семантическим поиском';
COMMENT ON COLUMN documents.content_text IS 'Текст для full-text search и генерации embeddings';
COMMENT ON COLUMN documents.embedding IS 'Vector embedding (1536 dims) для семантического поиска через OpenAI';
COMMENT ON COLUMN documents.brand_ids IS 'Массив UUID брендов, упомянутых в документе';
COMMENT ON COLUMN documents.segment_ids IS 'Массив UUID сегментов';
COMMENT ON COLUMN documents.geography_ids IS 'Массив UUID географий';
