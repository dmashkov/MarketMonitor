-- ============================================================================
-- Migration 010: Add file_size column to documents table
-- ============================================================================
-- Добавляем поле file_size для хранения размера файла в байтах
-- ============================================================================

ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Комментарий
COMMENT ON COLUMN documents.file_size IS 'Размер файла в байтах';
