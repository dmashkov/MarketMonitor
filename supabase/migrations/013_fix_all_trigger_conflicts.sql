-- ============================================================================
-- Migration 013: Fix trigger conflicts by dropping and recreating
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS trigger_job_schedules_updated_at ON job_schedules;
DROP TRIGGER IF EXISTS trigger_sources_updated_at ON sources;
DROP TRIGGER IF EXISTS trigger_segments_updated_at ON segments;
DROP TRIGGER IF EXISTS trigger_brands_updated_at ON brands;
DROP TRIGGER IF EXISTS trigger_documents_updated_at ON documents;

-- Recreate all triggers
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_job_schedules_updated_at
  BEFORE UPDATE ON job_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_segments_updated_at
  BEFORE UPDATE ON segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
