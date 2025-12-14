-- ============================================================================
-- Migration: Create Storage Bucket for Documents
-- ============================================================================
-- Создание bucket для хранения документов (PDF, DOCX, PPTX)
-- Политики доступа:
-- - Authenticated users: READ
-- - Admins: READ, WRITE, DELETE
-- - Users: WRITE только в user-uploads/{user_id}/
-- ============================================================================

-- Создать bucket если не существует
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'market-documents',
  'market-documents',
  false, -- НЕ публичный (требуется аутентификация)
  52428800, -- 50MB лимит на файл
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/html'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS Policies для bucket
-- ============================================================================

-- Policy 1: Authenticated users могут ЧИТАТЬ все документы
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'market-documents');

-- Policy 2: Admins могут делать ВСЁ
DROP POLICY IF EXISTS "Admins have full access" ON storage.objects;
CREATE POLICY "Admins have full access"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'market-documents'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Policy 3: Users могут загружать в свою папку user-uploads/{user_id}/
DROP POLICY IF EXISTS "Users can upload to their folder" ON storage.objects;
CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'market-documents'
  AND (storage.foldername(name))[1] = 'user-uploads'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 4: Users могут удалять свои файлы
DROP POLICY IF EXISTS "Users can delete their files" ON storage.objects;
CREATE POLICY "Users can delete their files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'market-documents'
  AND (storage.foldername(name))[1] = 'user-uploads'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ============================================================================
-- Комментарии
-- ============================================================================

COMMENT ON TABLE storage.buckets IS 'Storage buckets для файлов';
COMMENT ON TABLE storage.objects IS 'Файлы в Storage buckets';
