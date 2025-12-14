-- ============================================================================
-- Migration 014: Test semantic search directly in SQL
-- ============================================================================
-- Проверяем работает ли поиск вообще

-- Ensure all required columns exist
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS content_html TEXT;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS brand_ids UUID[];
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS segment_ids UUID[];
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS geography_ids UUID[];

-- Сначала проверим, есть ли вообще documents с embedding
SELECT COUNT(*) as total_docs, COUNT(embedding) as docs_with_embedding
FROM documents;

-- Посмотрим на одну из них
SELECT id, title, embedding::text as embedding_preview,
       (embedding <-> embedding) as zero_distance
FROM documents
WHERE embedding IS NOT NULL
LIMIT 1;

-- Попробуем найти одного документа, используя его же embedding (should return similarity = 1.0)
WITH doc AS (
  SELECT id, title, embedding, content_text
  FROM documents
  WHERE embedding IS NOT NULL
  LIMIT 1
)
SELECT
  d.id,
  d.title,
  d.content_text,
  1 - (d.embedding <=> doc.embedding) as similarity
FROM documents d, doc
WHERE d.embedding IS NOT NULL
ORDER BY d.embedding <=> doc.embedding
LIMIT 10;

-- Теперь попробуем функцию с тем же embedding (only if documents table is not empty)
-- Avoid running if no documents exist
DO $$
DECLARE
  doc_count INT;
BEGIN
  SELECT COUNT(*) INTO doc_count FROM documents WHERE embedding IS NOT NULL LIMIT 1;
  IF doc_count > 0 THEN
    EXECUTE 'SELECT * FROM search_documents_by_embedding(
      (SELECT embedding FROM documents WHERE embedding IS NOT NULL LIMIT 1),
      0.5,
      10
    )';
  END IF;
END $$;
