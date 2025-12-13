-- ============================================================================
-- Migration 015: Fix similarity return type from float to real
-- ============================================================================

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
