# ⚡ Quick Fix: Vault Permission Error

**Error:** `permission denied for function _crypto_aead_det_noncegen`

**Solution:** ❌ SQL doesn't work! ✅ Use Supabase Dashboard UI

---

## 🚫 Why SQL Fails

Vault uses `pgsodium` encryption which requires `supabase_admin` role.
SQL Editor runs as `postgres` which doesn't have these permissions.

**Only works:**
- ✅ Supabase Dashboard UI (recommended)
- ✅ Supabase CLI `secrets set`

---

## 📋 CORRECT STEPS (3 minutes)

### 1️⃣ Open Vault in Dashboard (30 sec)

Go to: https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/vault/secrets

---

### 2️⃣ Add Service Role Key (1 min)

1. Click **"New secret"** button

2. Fill in:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Secret:** Your new service_role key (from API settings)
   - **Description:** Service Role Key for calling Edge Functions from SQL

3. Click **"Add secret"**

✅ Done! No SQL needed.

---

### 3️⃣ Verify in SQL (30 sec)

Now you can verify it worked:

```sql
SELECT name, description, created_at
FROM vault.secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
-- Should return 1 row
```

---

### 3️⃣ Verify Secret Was Added (30 sec)

```sql
-- Check if exists
SELECT vault_secret_exists('SUPABASE_SERVICE_ROLE_KEY');
-- Should return: true

-- List all secrets
SELECT * FROM list_vault_secrets();
-- Should show: SUPABASE_SERVICE_ROLE_KEY with description
```

---

### 4️⃣ Apply Migration 051 - Secure pg_cron (2 min)

```sql
-- =====================================================
-- Copy FULL content from:
-- supabase/migrations/051_fix_pg_cron_security.sql
-- =====================================================

-- Then verify:
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'process-pipeline-jobs';
-- Should return: 1 row with active = true
```

---

## ✅ All Done!

Your vault is now secure and pg_cron job uses vault instead of hardcoded JWT.

---

## 🔧 Troubleshooting

**Q: Still getting permission error?**
A: Make sure you ran migration 052 FIRST, then try adding secret again.

**Q: upsert_vault_secret() function not found?**
A: Migration 052 didn't apply correctly. Copy the ENTIRE file content and run again.

**Q: pg_cron job not working?**
A: Check cron job logs:
```sql
SELECT status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
ORDER BY start_time DESC
LIMIT 5;
```

---

## 📚 New Helper Functions Available

After migration 052, you can use:

1. **Add/Update Secret:**
   ```sql
   SELECT upsert_vault_secret('SECRET_NAME', 'secret-value', 'Description');
   ```

2. **Check if Secret Exists:**
   ```sql
   SELECT vault_secret_exists('SECRET_NAME');
   ```

3. **List All Secrets (names only, not values!):**
   ```sql
   SELECT * FROM list_vault_secrets();
   ```

---

**File:** VAULT_QUICK_FIX.md
**Created:** 2026-01-01
