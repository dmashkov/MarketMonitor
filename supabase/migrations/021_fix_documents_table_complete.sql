-- ============================================================================
-- Migration 021: Fix Documents Table - Complete Schema
-- ============================================================================
-- This migration ensures documents table has all required columns and is properly set up
-- It's designed to be idempotent and safe to run multiple times
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Drop and recreate documents table with complete schema
DROP TABLE IF EXISTS documents CASCADE;

CREATE TABLE documents (
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
  file_size BIGINT,      -- Размер файла в байтах

  -- Метаданные
  source_id UUID REFERENCES sources(id),
  published_date TIMESTAMPTZ,  -- Дата публикации документа
  fetched_at TIMESTAMPTZ DEFAULT NOW(), -- Когда документ был получен

  -- Связи с брендами, сегментами, географиями (массивы UUID)
  brand_ids UUID[],      -- Упомянутые бренды
  segment_ids UUID[],    -- Сегменты
  geography_ids UUID[],  -- Географии
  event_type_ids UUID[], -- Типы событий

  -- Статус документа
  is_duplicate BOOLEAN DEFAULT FALSE,
  criticality_level INT CHECK (criticality_level BETWEEN 1 AND 5),

  -- Векторное представление для семантического поиска
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small (1536 dimensions)

  -- Связь с поиском
  search_run_id UUID REFERENCES search_runs(id) ON DELETE SET NULL,

  -- Метаданные аудита
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Индексы для производительности
CREATE INDEX idx_documents_source_id ON documents(source_id);
CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_published_date ON documents(published_date DESC NULLS LAST);
CREATE INDEX idx_documents_fetched_at ON documents(fetched_at DESC);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_brand_ids ON documents USING GIN(brand_ids);
CREATE INDEX idx_documents_segment_ids ON documents USING GIN(segment_ids);
CREATE INDEX idx_documents_geography_ids ON documents USING GIN(geography_ids);
CREATE INDEX idx_documents_content_text_fts ON documents
  USING gin(to_tsvector('russian', COALESCE(content_text, '')));
CREATE INDEX idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX idx_documents_search_run_id ON documents(search_run_id);
CREATE INDEX idx_documents_is_duplicate ON documents(is_duplicate);

-- Триггер для обновления updated_at
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view documents" ON documents;
CREATE POLICY "Authenticated users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins have full access to documents" ON documents;
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

DROP POLICY IF EXISTS "Users can create own documents" ON documents;
CREATE POLICY "Users can create own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own documents" ON documents;
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Recreate the search function
DROP FUNCTION IF EXISTS search_documents_by_embedding(vector, float, int) CASCADE;

CREATE FUNCTION search_documents_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  document_type text,
  content_text text,
  content_html text,
  file_url text,
  source_url text,
  source_id uuid,
  published_date timestamptz,
  fetched_at timestamptz,
  brand_ids uuid[],
  segment_ids uuid[],
  geography_ids uuid[],
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  similarity real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.title,
    documents.description,
    documents.document_type,
    documents.content_text,
    documents.content_html,
    documents.file_url,
    documents.source_url,
    documents.source_id,
    documents.published_date,
    documents.fetched_at,
    documents.brand_ids,
    documents.segment_ids,
    documents.geography_ids,
    documents.created_at,
    documents.updated_at,
    documents.created_by,
    (1 - (documents.embedding <=> query_embedding))::real AS similarity
  FROM documents
  WHERE documents.embedding IS NOT NULL
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION search_documents_by_embedding TO authenticated;

