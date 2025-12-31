-- Migration 039: Save Document with Segment Linking
-- Purpose: Save found document to DB with automatic segment linking

-- =====================================================
-- Function 3: Save document with segment link
-- =====================================================

CREATE OR REPLACE FUNCTION save_document_with_segment(
  p_title text,
  p_url text,
  p_source_id uuid,
  p_segment_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_document_id uuid;
BEGIN
  -- Insert document
  INSERT INTO documents (
    title,
    document_type,
    source_url,
    file_url,
    content_text,
    source_id,
    published_date,
    fetched_at
  )
  VALUES (
    p_title,
    'webpage',
    p_url,
    p_url,
    format('Документ загружен с %s', p_url),
    p_source_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_document_id;

  -- Create segment link
  INSERT INTO document_segments (
    document_id,
    segment_id
  )
  VALUES (
    v_document_id,
    p_segment_id
  )
  ON CONFLICT (document_id, segment_id) DO NOTHING;

  RETURN v_document_id;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error saving document: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION save_document_with_segment(text, text, uuid, uuid) TO postgres;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 039 complete!';
  RAISE NOTICE '   - save_document_with_segment() function created';
  RAISE NOTICE '   - Saves document + creates segment link';
  RAISE NOTICE '   - Returns document_id';
  RAISE NOTICE '   ';
  RAISE NOTICE '🧪 Test: SELECT save_document_with_segment(''Test'', ''https://test.com'', source_id, segment_id);';
END $$;
