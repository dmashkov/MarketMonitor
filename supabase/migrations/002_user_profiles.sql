-- ============================================================================
-- MIGRATION 002: User Profiles
-- ============================================================================
-- Created: 2024-12-04
-- Purpose: Create user profiles table and setup automatic profile creation
--
-- Features:
--   - Link to Supabase Auth users
--   - Role-based access control
--   - Automatic profile creation on signup
--   - First user becomes admin (if needed)

-- ============================================================================
-- USER PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at DESC);

-- ============================================================================
-- TRIGGER: Automatic Profile Creation on Auth Signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Check if this is the first user (will be admin)
  SELECT COUNT(*) INTO user_count FROM user_profiles;

  -- Create new profile
  INSERT INTO user_profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'user' END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- TRIGGER: Update updated_at on user_profiles
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'Extended user profile information linked to auth.users';
COMMENT ON COLUMN user_profiles.role IS 'User role: admin (full access) or user (limited access)';
COMMENT ON COLUMN user_profiles.is_active IS 'If false, user cannot access the system';
COMMENT ON COLUMN user_profiles.created_by IS 'User ID who created this profile (for audit trail)';

-- ============================================================================
-- HELPER FUNCTION: Get user with full info
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.email,
    up.full_name,
    up.role,
    up.is_active,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  WHERE up.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION STATUS
-- ============================================================================
-- ✅ user_profiles table created
-- ✅ Automatic profile creation trigger setup
-- ✅ First user becomes admin
-- ⏳ Next: JOB SCHEDULES TABLE (migration 003)
-- ⏳ Next: RLS POLICIES (migration 004)
