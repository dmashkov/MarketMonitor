-- Migration 052: Create helper functions for vault secret management
-- Purpose: Provide secure way to add/update secrets in vault
--
-- SECURITY: Uses SECURITY DEFINER to allow authenticated users to manage secrets
-- without direct access to vault.secrets table

-- =====================================================
-- Function 1: Add or update secret in vault
-- =====================================================

CREATE OR REPLACE FUNCTION public.upsert_vault_secret(
  p_secret_name text,
  p_secret_value text,
  p_description text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER -- Run with creator's privileges (postgres)
SET search_path = public, vault
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret_id uuid;
  v_result jsonb;
BEGIN
  -- Validate inputs
  IF p_secret_name IS NULL OR p_secret_name = '' THEN
    RAISE EXCEPTION 'Secret name cannot be empty';
  END IF;

  IF p_secret_value IS NULL OR p_secret_value = '' THEN
    RAISE EXCEPTION 'Secret value cannot be empty';
  END IF;

  -- Try to insert or update the secret
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (
    p_secret_name,
    p_secret_value,
    COALESCE(p_description, 'Added via upsert_vault_secret()')
  )
  ON CONFLICT (name) DO UPDATE
  SET
    secret = EXCLUDED.secret,
    description = COALESCE(EXCLUDED.description, vault.secrets.description),
    updated_at = NOW()
  RETURNING id INTO v_secret_id;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'secret_id', v_secret_id,
    'secret_name', p_secret_name,
    'message', 'Secret added/updated successfully'
  );

  RAISE NOTICE 'Secret "%" added/updated successfully', p_secret_name;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Return error details
  v_result := jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE
  );

  RAISE WARNING 'Failed to upsert secret "%": %', p_secret_name, SQLERRM;

  RETURN v_result;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.upsert_vault_secret IS
'Securely add or update a secret in vault.secrets. Uses SECURITY DEFINER to bypass permission issues.';

-- =====================================================
-- Function 2: Check if secret exists
-- =====================================================

CREATE OR REPLACE FUNCTION public.vault_secret_exists(
  p_secret_name text
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, vault
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM vault.secrets WHERE name = p_secret_name
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.vault_secret_exists IS
'Check if a secret exists in vault without revealing its value.';

-- =====================================================
-- Function 3: List all secret names (not values!)
-- =====================================================

CREATE OR REPLACE FUNCTION public.list_vault_secrets()
RETURNS TABLE(
  secret_name text,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public, vault
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    name::text,
    vault.secrets.description::text,
    vault.secrets.created_at,
    vault.secrets.updated_at
  FROM vault.secrets
  ORDER BY name;
END;
$$;

COMMENT ON FUNCTION public.list_vault_secrets IS
'List all secret names and metadata (does not expose secret values).';

-- =====================================================
-- Grant permissions
-- =====================================================

-- Allow authenticated users to execute these functions
GRANT EXECUTE ON FUNCTION public.upsert_vault_secret TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_secret_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_vault_secrets TO authenticated;

-- Also allow service_role (for Edge Functions)
GRANT EXECUTE ON FUNCTION public.upsert_vault_secret TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_secret_exists TO service_role;
GRANT EXECUTE ON FUNCTION public.list_vault_secrets TO service_role;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 052 complete!';
  RAISE NOTICE '   - Created upsert_vault_secret() function';
  RAISE NOTICE '   - Created vault_secret_exists() function';
  RAISE NOTICE '   - Created list_vault_secrets() function';
  RAISE NOTICE '   - Granted permissions to authenticated and service_role';
  RAISE NOTICE '   ';
  RAISE NOTICE '📝 Usage example:';
  RAISE NOTICE '   SELECT upsert_vault_secret(''SUPABASE_SERVICE_ROLE_KEY'', ''your-key-here'', ''Service role key for Edge Functions'');';
END $$;
