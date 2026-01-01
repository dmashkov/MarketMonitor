# 🚨 Security Incident Response - Exposed Secrets

**Date:** 2026-01-01
**Severity:** CRITICAL
**Status:** ⏳ IMMEDIATE ACTION REQUIRED

## What Happened

GitHub Security detected **exposed Supabase secrets** in the public repository:
1. Service Role JWT tokens (full database access)
2. Personal Access Tokens
3. Database passwords

## Current Status

✅ **COMPLETED:**
- [x] Identified all exposed secrets (7 total)
- [x] Removed sensitive files from git tracking
- [x] Updated `.gitignore` to prevent future leaks
- [x] Created migration 051 to fix insecure pg_cron job
- [x] Committed security fixes

⏳ **REQUIRES YOUR ACTION:**
- [ ] Rotate Supabase Service Role Key (5 minutes)
- [ ] Remove secrets from git history (10 minutes)
- [ ] Apply migration 051 to production (2 minutes)
- [ ] Update vault with new key (3 minutes)

---

## ⚡ STEP 1: Rotate Service Role Key (DO THIS NOW!)

**Time:** 5 minutes
**Why:** Old keys are exposed in git history and GitHub

### Instructions:

1. Open: https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/api

2. Find **"Service Role Key"** section (service_role JWT)

3. Click **"Generate new key"** or **"Reset"**
   - ⚠️ WARNING: This will invalidate ALL old keys immediately
   - Edge Functions using old key will fail until updated

4. **COPY the new key** - you'll need it for:
   - Vault (Step 4)
   - Edge Functions configuration (if any)
   - Local development `.env` files

5. **Store securely** in password manager (1Password, LastPass, etc.)

### Affected Systems (will need update after rotation):
- ✅ pg_cron job (will auto-update after migration 051)
- ⚠️ Any Edge Functions using `SUPABASE_SERVICE_ROLE_KEY` env var
- ⚠️ Local development `.env` files

---

## 🗑️ STEP 2: Remove Secrets from Git History

**Time:** 10 minutes
**Why:** Secrets are still in git commit history

⚠️ **WARNING:** This will rewrite git history and require force push!

### Option A: BFG Repo-Cleaner (Recommended - Faster)

```powershell
# 1. Install BFG (if not installed)
scoop install bfg
# OR download from: https://rtyley.github.io/bfg-repo-cleaner/

# 2. Backup repository (IMPORTANT!)
cd C:\Work\VSCodeProjects
git clone --mirror MarketMonitor MarketMonitor-backup.git

# 3. Run BFG to remove files with secrets
cd MarketMonitor
bfg --delete-files "add_service_role_key_to_vault.sql"
bfg --delete-files "fix_stuck_jobs.sql"
bfg --delete-files "settings.local.json"
bfg --delete-files "test_pipeline.ps1"

# 4. Clean up git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Verify files are gone from history
git log --all --full-history --oneline -- "sql-scripts/add_service_role_key_to_vault.sql"
# Should return empty

# 6. Force push (CAREFUL!)
git push origin --force --all
git push origin --force --tags
```

### Option B: Git Filter-Repo (Alternative)

```powershell
# 1. Install git-filter-repo
pip install git-filter-repo

# 2. Backup first!
cd C:\Work\VSCodeProjects
cp -r MarketMonitor MarketMonitor-backup

# 3. Remove files
cd MarketMonitor
git filter-repo --path sql-scripts/add_service_role_key_to_vault.sql --invert-paths
git filter-repo --path sql-scripts/fix_stuck_jobs.sql --invert-paths
git filter-repo --path .claude/settings.local.json --invert-paths
git filter-repo --path test_pipeline.ps1 --invert-paths

# 4. Force push
git push origin --force --all
```

### Option C: GitHub Web UI (Easiest but Destructive)

If you don't need git history:

1. Create a new empty repository on GitHub
2. Copy only current files (not .git folder)
3. Push to new repository
4. Update remote URL
5. Delete old repository

---

## 🔒 STEP 3: Apply Migration 051 (Fix pg_cron Security)

**Time:** 2 minutes
**Why:** pg_cron job still uses old hardcoded JWT

### Instructions:

1. Open Supabase Dashboard SQL Editor:
   https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/sql/new

2. **Apply migration 051** (secure pg_cron job):
   ```sql
   -- Copy full content from: supabase/migrations/051_fix_pg_cron_security.sql
   -- Paste and execute
   ```

   Expected output: `✅ Migration 051 complete!`

3. Verify pg_cron job:
   ```sql
   SELECT jobid, jobname, schedule, active
   FROM cron.job
   WHERE jobname = 'process-pipeline-jobs';
   ```

   Expected output: 1 row with `active = true`

**Note:** Migration 052 is NOT needed. It was an attempt to add vault secrets via SQL, but only Supabase Dashboard UI can write to vault.

---

## 🔐 STEP 4: Update Vault with New Key

**Time:** 2 minutes
**Why:** Migration 051 reads from vault

### ⚠️ IMPORTANT: Use Dashboard UI (NOT SQL!)

SQL Editor cannot write to vault due to `pgsodium` encryption permissions.
**Use Supabase Dashboard UI instead.**

### Instructions:

1. **Get your NEW service_role key** (from Step 1):
   - Should start with `eyJhbGciOiJIUzI1NiIs...`
   - If you didn't rotate yet: https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/api

2. **Open Vault Settings:**
   https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob/settings/vault/secrets

3. **Click "New secret"** button

4. **Fill in the form:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Secret: Paste your service_role key
   - Description: `Service Role Key for calling Edge Functions from SQL`

5. **Click "Add secret"**

6. **Verify in SQL Editor:**
   ```sql
   SELECT name, description, created_at
   FROM vault.secrets
   WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
   -- Should return 1 row
   ```

**Why Dashboard UI and not SQL?**
Only `supabase_admin` role can write to vault. SQL Editor runs as `postgres` which lacks pgsodium crypto permissions.

---

## 📊 What Was Exposed

### Files Removed from Git:

1. **`sql-scripts/add_service_role_key_to_vault.sql`**
   - Service Role JWT (expires 2034)
   - Project: aggiamgeplckdrnbqmob

2. **`sql-scripts/fix_stuck_jobs.sql`**
   - Service Role JWT (different token)
   - Same project

3. **`supabase/migrations/036_setup_pg_cron_job.sql`** (⚠️ STILL IN REPO)
   - Service Role JWT hardcoded in pg_cron job
   - Fixed by migration 051

4. **`.claude/settings.local.json`**
   - SUPABASE_ACCESS_TOKEN (personal token: `sbp_91472dbd...`)
   - Database password: `F8nrZ46LY&Ngo$j`

5. **`test_pipeline.ps1`**
   - Only anon key (public, safe)
   - Removed as precaution

### Impact Assessment:

**CRITICAL:**
- Service Role JWT gives **FULL DATABASE ACCESS** (bypasses RLS)
- Can read/write/delete ANY data
- Can call Edge Functions
- Can modify schema

**HIGH:**
- Personal Access Token allows CLI access to Supabase project
- Database password allows direct PostgreSQL connection

**LOW:**
- Anon key is public anyway (used in frontend)

---

## 🛡️ Prevention Measures Implemented

1. **Updated `.gitignore`:**
   ```gitignore
   # SQL scripts with potential secrets
   sql-scripts/*
   !sql-scripts/README.md
   !sql-scripts/.gitkeep

   # Claude Code settings (may contain personal access tokens)
   .claude/settings.local.json

   # Test scripts (may contain API keys)
   *.ps1
   test_*.sh
   ```

2. **Security documentation added:**
   - `sql-scripts/README.md` with warnings
   - Best practices for vault usage

3. **Migration 051 created:**
   - Secure pg_cron job using vault
   - No hardcoded secrets

---

## ✅ Verification Checklist

After completing all steps:

- [ ] New Service Role Key generated in Supabase Dashboard
- [ ] Old keys invalidated (test by calling API with old key - should fail)
- [ ] Git history cleaned (check with `git log --all --full-history --oneline -- "sql-scripts/add_service_role_key_to_vault.sql"`)
- [ ] Force pushed to GitHub
- [ ] GitHub Security alerts resolved (check: https://github.com/dmashkov/MarketMonitor/security)
- [ ] Migration 051 applied to production
- [ ] Vault updated with new key
- [ ] pg_cron job working (check `cron.job_run_details` table)
- [ ] Edge Functions still working (if any)

---

## 📚 References

- **GitHub Security Alert:** https://github.com/dmashkov/MarketMonitor/security
- **Supabase Dashboard:** https://supabase.com/dashboard/project/aggiamgeplckdrnbqmob
- **Vault Documentation:** https://supabase.com/docs/guides/database/vault
- **BFG Repo-Cleaner:** https://rtyley.github.io/bfg-repo-cleaner/

---

## 🆘 Need Help?

If something goes wrong:

1. **Restore from backup:**
   ```powershell
   cd C:\Work\VSCodeProjects
   rm -rf MarketMonitor
   git clone MarketMonitor-backup.git MarketMonitor
   ```

2. **Contact Supabase support** if database access issues

3. **Check git reflog** to recover commits:
   ```powershell
   git reflog
   git reset --hard <commit-hash>
   ```

---

**Last Updated:** 2026-01-01
**Document:** SECURITY_INCIDENT_RESPONSE.md
