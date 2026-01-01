# ✅ SOLUTION: Add Vault Secrets via Supabase Dashboard UI

**Problem:** SQL Editor cannot add vault secrets due to `pgsodium` encryption permissions.

**Solution:** Use Supabase Dashboard UI (Vault) instead.

---

## 🎯 CORRECT STEPS (3 minutes)

### 1️⃣ Get Your New Service Role Key

1. Open: https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/api

2. Find **"Project API keys"** section

3. Look for **"service_role"** key (NOT anon!)

4. If you already rotated it: copy the NEW key
   If NOT rotated yet: Click "Reset" → Copy the new key

5. **SAVE IT** somewhere safe (password manager)

---

### 2️⃣ Add Secret to Vault via UI

1. Open Vault Settings:
   https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/vault/secrets

2. Click **"New secret"** button

3. Fill in the form:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Secret:** Paste your service_role key from Step 1
   - **Description (optional):** Service Role Key for calling Edge Functions from SQL

4. Click **"Add secret"**

5. ✅ Done! The UI handles all encryption automatically.

---

### 3️⃣ Verify Secret is Accessible

Open SQL Editor and run:

```sql
-- Check if secret exists
SELECT name, description, created_at
FROM vault.secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
-- Should return 1 row

-- Test reading decrypted value (first 20 chars only for security)
SELECT
  name,
  LEFT(decrypted_secret, 20) || '...' as secret_preview
FROM vault.decrypted_secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
-- Should return: "eyJhbGciOiJIUzI1NiIs..."
```

**Important:** Never log or display full secret values!

---

### 4️⃣ Apply Migration 051 (Secure pg_cron)

Now that the secret is in vault, apply the migration:

1. Open SQL Editor:
   https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/sql/new

2. Copy FULL content from:
   `supabase/migrations/051_fix_pg_cron_security.sql`

3. Execute

4. Verify:
   ```sql
   SELECT jobid, jobname, schedule, active
   FROM cron.job
   WHERE jobname = 'process-pipeline-jobs';
   ```

Expected: 1 row with `active = true`

---

## 🎯 Why Dashboard UI Works But SQL Doesn't?

| Method | Runs As | Has Vault Write Access? |
|--------|---------|------------------------|
| SQL Editor | `postgres` role | ❌ NO - lacks pgsodium crypto permissions |
| Dashboard UI | `supabase_admin` | ✅ YES - full vault access |
| CLI `supabase secrets set` | Service account | ✅ YES - uses API with admin token |

**Bottom line:** Only `supabase_admin` role can write to vault. SQL Editor doesn't have this role.

---

## 🔐 Alternative: Use Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Set environment variable
export SUPABASE_ACCESS_TOKEN="your-personal-access-token"

# Add secret via CLI
npx supabase secrets set \
  --project-ref aggiamgeplckdrnbqmob \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

But Dashboard UI is simpler and works immediately.

---

## ❌ What DOESN'T Work (Don't Waste Time)

1. ❌ Direct `INSERT INTO vault.secrets` - Permission denied
2. ❌ `SECURITY DEFINER` function - Still no pgsodium access
3. ❌ Migration 052 helper functions - Can't bypass vault permissions
4. ❌ Granting permissions manually - Supabase restricts this

**ONLY works:**
- ✅ Supabase Dashboard UI (Vault page)
- ✅ Supabase CLI `secrets set`
- ✅ Supabase Management API

---

## 📚 Links

- **Vault Settings:** https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/vault/secrets
- **API Keys:** https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/api
- **Vault Docs:** https://supabase.com/docs/guides/database/vault

---

**Created:** 2026-01-01
**File:** VAULT_DASHBOARD_SOLUTION.md
