-- ============================================================================
-- Migration 014: Test semantic search directly in SQL
-- ============================================================================
-- Проверяем работает ли поиск вообще

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

-- Теперь попробуем функцию с тем же embedding
SELECT * FROM search_documents_by_embedding(
  (SELECT embedding FROM documents WHERE embedding IS NOT NULL LIMIT 1),
  0.5,
  10
);
