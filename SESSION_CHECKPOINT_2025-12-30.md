# Session Checkpoint - 2025-12-30
# Phase 4 Part 6 Complete: SQL-based Source Hunter Working

## 🎯 Главное достижение

**Полностью переписали Source Hunter с Edge Functions на pure PostgreSQL!**

### Проблема которую решали

After session 2025-12-29, we had working Source Hunter V2 via Edge Functions that created 27 documents. But async job queue was broken:

1. **pg_cron couldn't call Edge Functions** → 401 Unauthorized errors
2. **Tried pg_net extension** → same 401 errors
3. **Tried http extension** → same 401 errors
4. **Root cause:** PostgreSQL extensions CANNOT authenticate with Supabase Edge Functions Gateway

**Decision:** User chose option 3: "переписать всю логику в PostgreSQL" (rewrite everything in SQL)

---

## 📋 Что сделано

### 8 новых миграций (037-044)

#### Migration 037: `generate_search_query()`
- OpenAI query generation directly from PostgreSQL
- Uses Supabase Vault for OPENAI_API_KEY
- HTTP extension for API calls
- Returns: text (generated query)

#### Migration 038: `search_perplexity()`
- Perplexity AI search directly from PostgreSQL
- Uses Supabase Vault for PERPLEXITY_API_KEY
- Returns: TABLE(url text, title text)

#### Migration 039: `save_document_with_segment()`
- Document insertion with automatic segment linking
- ON CONFLICT DO NOTHING for idempotency
- Returns: UUID (document_id)

#### Migration 040: `run_source_hunter_sql()` v1
- Main orchestrator combining all functions
- Hardcoded limits: 1 segment, 3 sources, 10 URLs

#### Migration 041: `run_source_hunter_sql()` v2
- Added configurable parameters: `max_sources`, `max_urls_per_source`
- Default: 1 source, 3 URLs (avoid timeout)
- Added RAISE NOTICE logging for debugging
- Returns: JSONB summary

#### Migration 042: Timeout fixes (FAILED)
- Tried: SET LOCAL statement_timeout = '30s' / '60s'
- Result: Doesn't affect http extension timeout (5s hard limit)
- Lesson: statement_timeout ≠ http extension timeout

#### Migration 043: Simplified Perplexity request (SUCCESS!)
- Removed: search_recency_filter, temperature, system message
- Reduced: max_tokens from 1000 to 300
- Result: Completes within 5s timeout ✅

#### Migration 044: pg_cron setup
- Unscheduled: old 'process-pipeline-jobs' Edge Function job
- Scheduled: new 'run-sql-source-hunter' SQL job
- Schedule: Daily at 9:00 AM (0 9 * * *)
- Direct call: `SELECT run_source_hunter_sql(...)`

---

## ✅ Результаты тестирования

### Индивидуальное тестирование

**Migration 037 test:**
```sql
SELECT generate_search_query('RAC', 'Даичи', 'Найти критические события');
-- ✅ SUCCESS: Generated query returned
```

**Migration 038 test:**
```sql
SELECT * FROM search_perplexity('новости рынок кондиционеров Россия');
-- ✅ SUCCESS: 10 URLs returned
```

**Migration 039 test:**
```sql
SELECT save_document_with_segment('Test', 'https://test.com', source_id, segment_id);
-- ✅ SUCCESS: Document UUID returned
```

### Полный orchestrator test

**Migration 041 test:**
```sql
SELECT run_source_hunter_sql(
  (SELECT id FROM monitoring_profiles WHERE name = 'Daily Critical Monitoring'),
  1,  -- max_sources
  3   -- max_urls_per_source
);
```

**Result:**
```json
{
  "status": "success",
  "profile_id": "4180bc1e-c27b-4946-ae70-65f90d279b9a",
  "profile_name": "Daily Critical Monitoring",
  "documents_created": 3,
  "segment_links": 3,
  "sources_processed": 1,
  "errors_count": 0,
  "errors": []
}
```

**✅ ПОЛНЫЙ УСПЕХ: 3 документа созданы, 0 ошибок!**

---

## 🔧 Критические решения

### 1. Edge Functions Authentication Problem

**Problem:**
- PostgreSQL extensions (pg_net, http) can't authenticate with Edge Functions
- Gateway returns 401 "Invalid JWT" for ALL requests from PostgreSQL
- Even with correct apikey and Authorization headers

**Solution:**
- Pure SQL approach: write functions directly in PostgreSQL
- Direct API calls via http extension
- No Edge Functions = no authentication issues

**Trade-off:**
- Benefit: Works reliably, no auth hell
- Cost: HTTP timeout limited to 5 seconds (must optimize API requests)

### 2. HTTP Extension Timeout

**Problem:**
- http extension has hard 5-second timeout
- `SET LOCAL statement_timeout` DOESN'T affect it
- Complex Perplexity requests took >5s → timeout

**Solution:**
- Simplify API requests (remove optional parameters)
- Reduce max_tokens from 1000 to 300
- Result: 3-4 second response time ✅

### 3. Supabase Vault для API Keys

**Setup:**
```sql
-- Correct argument order: secret, name, description
SELECT vault.create_secret(
  'sk-xxx',              -- secret value
  'OPENAI_API_KEY',      -- name
  'OpenAI API Key'       -- description
);
```

**Common mistake:**
```sql
-- ❌ WRONG order: name, secret, description
SELECT vault.create_secret('OPENAI_API_KEY', 'sk-xxx', '...');
```

**Usage:**
```sql
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'OPENAI_API_KEY';
```

---

## 📊 Метрики

### Код
- **Миграций:** 8 (037-044)
- **SQL кода:** ~800 строк PL/pgSQL
- **Функций:** 4 (generate_query, search, save, orchestrator)
- **Test files:** 6 (temporary, для отладки)

### Performance
- **Время выполнения:** <10 секунд (1 source × 3 URLs)
- **API calls:** 1 OpenAI + 1 Perplexity
- **Cost:** ~$0.03 per run
- **Success rate:** 100% (0 errors in final test)

### Database
- **Documents created:** 3 (first successful orchestrator run)
- **Segment links:** 3 (AHU segment)
- **Coverage:** 1 segment × 1 source = minimal (by design, to avoid timeout)

---

## 🚀 Production Setup

### pg_cron Configuration

**Job:** `run-sql-source-hunter`
**Schedule:** `0 9 * * *` (daily at 9:00 AM)
**Command:**
```sql
SELECT run_source_hunter_sql(
  (SELECT id FROM monitoring_profiles WHERE name = 'Daily Critical Monitoring' LIMIT 1),
  1,  -- max_sources (conservative)
  3   -- max_urls_per_source (conservative)
);
```

**Verification:**
```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'run-sql-source-hunter';
```

---

## 🎓 Lessons Learned (NEW!)

### Добавлено в LESSONS_LEARNED.md:

1. **Problem #8: Edge Functions Authentication Hell**
   - PostgreSQL can't call Edge Functions (401 errors)
   - Solution: Pure SQL approach with http extension
   - Supabase Vault for encrypted API keys

2. **Problem #9: HTTP Extension Timeout (5s)**
   - Hard limit, statement_timeout doesn't help
   - Solution: Simplify API requests
   - Debug with clock_timestamp() timing

3. **Problem #10: Supabase Vault Setup**
   - Correct argument order: secret, name, description
   - Access via vault.decrypted_secrets
   - SECURITY DEFINER functions required

---

## ⚠️ Known Limitations

### Low Coverage (By Design)
- **Current:** 1 source × 3 URLs = 3 documents per run
- **Reason:** Conservative limits to avoid timeout
- **Future:** Scale up to 3-5 sources after monitoring

### No HTML Content
- **Current:** Documents have URLs but no content_html
- **Impact:** Can't extract events yet
- **Next Step:** Content Fetcher integration (3-4 hours)

---

## 📁 Файлы

### Новые миграции
- `supabase/migrations/037_sql_source_hunter_functions.sql`
- `supabase/migrations/038_perplexity_search_function.sql`
- `supabase/migrations/039_save_document_function.sql`
- `supabase/migrations/040_orchestrator_function.sql`
- `supabase/migrations/041_orchestrator_with_limits.sql`
- `supabase/migrations/042_fix_http_timeouts.sql`
- `supabase/migrations/043_simplify_perplexity_request.sql`
- `supabase/migrations/044_update_pg_cron_to_sql.sql`

### Test files (temporary)
- `test_037_migration.sql` - test OpenAI query generation
- `test_038_migration.sql` - test Perplexity search
- `test_039_migration.sql` - test document saving
- `test_040_migration.sql` - test full orchestrator (timed out)
- `test_040_minimal.sql` - reduced scope test
- `test_041_simple.sql` - minimal orchestrator test
- `test_perplexity_simple.sql` - debug Perplexity timeout
- `check_*.sql` - various checks
- `verify_setup.sql` - final verification

**Note:** Test files can be deleted after stability confirmed (1-2 weeks).

### Обновлённая документация
- `SESSION_CONTEXT.md` - updated с новыми приоритетами
- `LESSONS_LEARNED.md` - added 3 new problems + solutions
- `CLAUDE.md` - version bump to 0.9.0, Phase 4 60% progress

---

## 🔜 Следующие шаги

### 1. Мониторинг (1-2 дня)
- Проверить pg_cron автоматические запуски
- Убедиться что документы создаются каждый день
- Проверить логи на ошибки

**Verification queries:**
```sql
-- Check pg_cron job status
SELECT * FROM cron.job WHERE jobname = 'run-sql-source-hunter';

-- Check recent documents
SELECT * FROM documents ORDER BY created_at DESC LIMIT 10;

-- Check last 7 days stats
SELECT DATE(created_at) as date, COUNT(*) as documents
FROM documents
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 2. Масштабирование (после подтверждения стабильности)
- Увеличить с 1 до 2-3 sources
- Увеличить с 3 до 5 URLs per source
- Target: 10-15 documents per day

### 3. Content Fetcher Integration (3-4 hours)
- Fetch HTML for created documents
- Store in `content_html` column
- See: `CONTENT_FETCHER_ROADMAP.md`

### 4. Document Processor (next agent)
- Extract events from HTML
- Criticality scoring
- Save to `events` table

---

## ✅ Success Criteria Met

- [x] SQL-based Source Hunter created
- [x] All 4 functions tested individually
- [x] Full orchestrator tested (3 documents created)
- [x] pg_cron configured and scheduled
- [x] Supabase Vault setup for API keys
- [x] Zero authentication errors
- [x] Zero timeout errors
- [x] Documentation updated

---

## 🎉 Статус

**Phase 4 Part 6: COMPLETE ✅**

**Прогресс Phase 4:** 60% (Source Hunter V2 fully working, ready for scaling)

**Версия проекта:** 0.9.0

**Next Session:** Monitor auto-runs, then Content Fetcher or scaling

---

**Checkpoint created:** 2025-12-30
**Session duration:** ~3 hours
**Major blocker removed:** Edge Functions authentication → SQL approach
**Architecture shift:** Edge Functions → Pure PostgreSQL (simpler, faster, reliable)
