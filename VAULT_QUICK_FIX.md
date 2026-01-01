# ⚡ Quick Fix: Vault Permission Error

**Error:** `permission denied for function _crypto_aead_det_noncegen`

**Solution:** Use helper function instead of direct INSERT

---

## 📋 IMMEDIATE STEPS (10 minutes)

### 1️⃣ Apply Migration 052 (2 min)

Open Supabase SQL Editor and run:

```sql
-- =====================================================
-- Copy FULL content from:
-- supabase/migrations/052_create_vault_helper_functions.sql
-- =====================================================

-- Then verify it worked:
SELECT * FROM list_vault_secrets();
```

Expected: List of secret names (should return empty if no secrets yet)

---

### 2️⃣ Add Service Role Key to Vault (1 min)

**IMPORTANT:** Replace `YOUR_NEW_KEY_HERE` with the key from Supabase Dashboard!

```sql
SELECT upsert_vault_secret(
  'SUPABASE_SERVICE_ROLE_KEY',
  'YOUR_NEW_KEY_HERE',
  'Service Role Key for calling Edge Functions from SQL'
);
```

Expected output:
```json
{
  "success": true,
  "secret_id": "uuid-here",
  "secret_name": "SUPABASE_SERVICE_ROLE_KEY",
  "message": "Secret added/updated successfully"
}
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
