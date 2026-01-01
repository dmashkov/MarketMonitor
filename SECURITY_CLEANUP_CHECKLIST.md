# 🔒 Security Cleanup Checklist

**Date:** 2026-01-01
**Status:** ⏳ IN PROGRESS
**Time Required:** ~20 minutes

---

## ✅ STEP 1: Rotate Service Role Key (5 min)

### 1.1 Open Supabase Dashboard

**Link:** https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/api

### 1.2 Generate New Service Role Key

1. Scroll to **"Project API keys"** section
2. Find **"service_role"** (secret key)
3. Click **"Reset service_role key"** or **"Generate new key"**
4. ⚠️ **IMPORTANT:** Copy the NEW key immediately!
5. Save in password manager (1Password, LastPass, etc.)

**Expected format:** `eyJhbGciOiJIUzI1NiIs...` (200-300 chars)

### 1.3 Test Old Key Is Invalid (Optional)

```bash
# This should fail with 401 Unauthorized
curl -X POST https://aggiamgeplckdrnbqmob.supabase.co/functions/v1/source-hunter \
  -H "Authorization: Bearer OLD_KEY_HERE" \
  -H "Content-Type: application/json"
```

**Status:** [ ] COMPLETED

---

## ✅ STEP 2: Add New Key to Vault (3 min)

### 2.1 Open Vault Settings

**Link:** https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/vault/secrets

### 2.2 Update SUPABASE_SERVICE_ROLE_KEY

**IF secret already exists:**
1. Find `SUPABASE_SERVICE_ROLE_KEY` in list
2. Click **Edit** or **Delete** → **New secret**
3. Name: `SUPABASE_SERVICE_ROLE_KEY`
4. Secret: Paste NEW key from Step 1.2
5. Description: `Service Role Key for calling Edge Functions from SQL`
6. Click **Save**

**IF secret doesn't exist:**
1. Click **"New secret"**
2. Fill in form (same as above)
3. Click **Add secret**

### 2.3 Verify in SQL

```sql
SELECT
  name,
  LEFT(decrypted_secret, 20) || '...' as preview,
  LENGTH(decrypted_secret) as length,
  updated_at
FROM vault.decrypted_secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
```

**Expected:**
- Preview should start with new key prefix
- `updated_at` should be recent (< 5 min ago)

**Status:** [ ] COMPLETED

---

## ✅ STEP 3: Test pg_cron Still Works (2 min)

### 3.1 Check Recent Cron Execution

```sql
SELECT
  status,
  return_message,
  start_time,
  EXTRACT(EPOCH FROM (end_time - start_time))::numeric(5,2) as duration_sec
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
ORDER BY start_time DESC
LIMIT 3;
```

**Expected:** Recent executions (< 5 min) with `status = 'succeeded'`

### 3.2 If Cron Failed

If you see errors after key rotation:
1. Wait 1-2 minutes (cron runs every minute)
2. Check again
3. If still failing, vault key may not be updated correctly

**Status:** [ ] COMPLETED

---

## ✅ STEP 4: Clean Git History with BFG (10 min)

### 4.1 Install BFG Repo-Cleaner

**Windows (Scoop):**
```powershell
scoop install bfg
```

**OR download manually:**
- https://rtyley.github.io/bfg-repo-cleaner/
- Download `bfg.jar`
- Run with `java -jar bfg.jar`

### 4.2 Backup Repository

```powershell
cd C:\Work\VSCodeProjects
git clone --mirror MarketMonitor MarketMonitor-backup.git
```

**Verify backup created:**
```powershell
dir MarketMonitor-backup.git
# Should show files: config, HEAD, objects/, refs/, etc.
```

### 4.3 Run BFG to Remove Sensitive Files

```powershell
cd MarketMonitor

# Remove files with exposed secrets
bfg --delete-files "add_service_role_key_to_vault.sql"
bfg --delete-files "fix_stuck_jobs.sql"
bfg --delete-files "settings.local.json"
bfg --delete-files "test_pipeline.ps1"
```

**Expected output:**
```
Using repo : C:\Work\VSCodeProjects\MarketMonitor\.git

Found X commits
Found Y blobs
...
Deleted files: add_service_role_key_to_vault.sql
BFG run is complete!
```

### 4.4 Clean Up Git

```powershell
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**This will take 2-5 minutes.**

### 4.5 Verify Files Removed from History

```powershell
git log --all --full-history --oneline -- "sql-scripts/add_service_role_key_to_vault.sql"
```

**Expected:** Empty output (no commits found)

**Status:** [ ] COMPLETED

---

## ✅ STEP 5: Force Push to GitHub (2 min)

⚠️ **WARNING:** This will rewrite GitHub history!

### 5.1 Push All Branches

```powershell
git push origin --force --all
```

**Expected output:**
```
+ 3b80e5e...8aacc51 main -> main (forced update)
```

### 5.2 Push All Tags (if any)

```powershell
git push origin --force --tags
```

### 5.3 Verify on GitHub

1. Open: https://github.com/dmashkov/MarketMonitor
2. Check recent commits
3. Old commits with secrets should be **gone**

**Status:** [ ] COMPLETED

---

## ✅ STEP 6: Verify GitHub Security Alerts Closed (1 min)

### 6.1 Open Security Tab

**Link:** https://github.com/dmashkov/MarketMonitor/security

### 6.2 Check Alerts

**Expected:**
- ✅ All alerts should be **closed** or **resolved**
- No new alerts

**If alerts still show:**
- Wait 5-10 minutes (GitHub scans asynchronously)
- Refresh page
- If still present after 30 min, contact GitHub support

**Status:** [ ] COMPLETED

---

## ✅ FINAL VERIFICATION

Run all these checks:

```sql
-- 1. Vault secret exists and is recent
SELECT name, updated_at
FROM vault.secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

-- 2. pg_cron job is active
SELECT jobname, active
FROM cron.job
WHERE jobname = 'process-pipeline-jobs';

-- 3. Recent cron executions succeeded
SELECT status, start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-pipeline-jobs')
ORDER BY start_time DESC
LIMIT 3;
```

```powershell
# 4. Git history is clean
git log --all --full-history --oneline -- "sql-scripts/add_service_role_key_to_vault.sql"
# Should be empty

# 5. Latest commits are on GitHub
git log --oneline -5
# Should match GitHub commits
```

---

## 🎉 COMPLETION CHECKLIST

- [ ] Service Role Key rotated
- [ ] New key added to Vault
- [ ] pg_cron still works with new key
- [ ] Git history cleaned with BFG
- [ ] Force pushed to GitHub
- [ ] GitHub Security alerts closed
- [ ] Backup created (MarketMonitor-backup.git)

**All done?** Delete backup after 1 week:
```powershell
rm -rf C:\Work\VSCodeProjects\MarketMonitor-backup.git
```

---

**Document:** SECURITY_CLEANUP_CHECKLIST.md
**Created:** 2026-01-01
**Updated:** 2026-01-01
