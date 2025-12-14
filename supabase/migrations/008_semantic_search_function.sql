-- ============================================================================
-- Migration 008: Semantic Search RPC Function
-- ============================================================================
-- Создает PostgreSQL функцию для семантического поиска документов
-- используя pgvector cosine similarity
--
-- Dependencies:
-- - Migration 007 (documents table с VECTOR(1536) embedding column)
-- - pgvector extension (должен быть включен)
--
-- Date: 2024-12-07
-- ============================================================================

-- Проверяем что pgvector включен
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- RPC Function: search_documents_by_embedding
-- ============================================================================
-- Поиск документов по cosine similarity с query embedding
--
-- Parameters:
--   query_embedding - vector(1536) от OpenAI text-embedding-3-small
--   match_threshold - минимальная схожесть (0.0 - 1.0), default 0.7
--   match_count - сколько документов вернуть, default 10
--
-- Returns:
--   Список документов с полем similarity (1.0 = идентичный, 0.0 = разный)
--
-- Usage (from Edge Function):
--   await supabase.rpc('search_documents_by_embedding', {
--     query_embedding: [0.1, 0.2, ...], // 1536 floats
--     match_threshold: 0.7,
--     match_count: 10
--   });
-- ============================================================================

-- Drop existing function to allow return type changes
DROP FUNCTION IF EXISTS search_documents_by_embedding(vector, float, int);

CREATE OR REPLACE FUNCTION search_documents_by_embedding(
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
  similarity float
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
    -- Cosine similarity: 1 - (embedding <=> query_embedding)
    -- <=> это cosine distance operator от pgvector
    -- 1.0 = идентичные векторы, 0.0 = ортогональные векторы
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE documents.embedding IS NOT NULL
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Комментарии для документации
-- ============================================================================

COMMENT ON FUNCTION search_documents_by_embedding IS
'Семантический поиск документов используя OpenAI embeddings и pgvector cosine similarity.
Возвращает топ-N наиболее похожих документов с similarity score (0.0-1.0).';

-- ============================================================================
-- Permissions
-- ============================================================================

-- Authenticated users могут вызывать функцию
GRANT EXECUTE ON FUNCTION search_documents_by_embedding TO authenticated;

-- ============================================================================
-- Example Usage
-- ============================================================================

-- Пример вызова (в SQL):
/*
SELECT id, title, similarity
FROM search_documents_by_embedding(
  query_embedding := '[0.1, 0.2, 0.3, ...]'::vector(1536),
  match_threshold := 0.75,
  match_count := 5
);
*/

-- Пример вызова (из JavaScript Edge Function):
/*
const { data: results } = await supabaseClient.rpc('search_documents_by_embedding', {
  query_embedding: embeddingArray, // Array of 1536 floats
  match_threshold: 0.7,
  match_count: 10
});
*/

-- ============================================================================
-- Performance Notes
-- ============================================================================

-- Для оптимизации поиска по большим датасетам (>10k документов)
-- рекомендуется создать IVFFlat index:
--
-- CREATE INDEX ON documents
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);
--
-- ВАЖНО: index нужно создавать ПОСЛЕ того как в таблице есть данные!
-- Рекомендуется создавать index когда documents > 1000 записей.

-- ============================================================================
-- End of Migration 008
-- ============================================================================
