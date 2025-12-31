# TODO - MarketMonitor

**Последнее обновление:** 2025-12-30
**Версия:** 0.9.0
**Текущий статус:** ✅ Phase 4 Part 6 Complete - SQL-based Source Hunter Working!

---

## 🔥 IMMEDIATE PRIORITIES (Next Session)

### 1. Monitor pg_cron Auto-Runs 🔥🔥🔥
**Priority:** HIGH
**Estimated Time:** 1-2 days observation
**Blockers:** None
**Dependencies:** SQL Source Hunter (✅ Done)

**Why:** Need to confirm pg_cron job runs successfully every day at 9:00 AM and creates documents.

**Tasks:**
- [ ] Wait for 1-2 automatic runs (9:00 AM daily)
- [ ] Check Supabase logs for errors
- [ ] Verify documents are created daily
- [ ] Monitor success rate and performance
- [ ] Review any errors or issues

**Verification queries:**
```sql
-- Check pg_cron job status
SELECT * FROM cron.job WHERE jobname = 'run-sql-source-hunter';

-- Check recent documents
SELECT DATE(created_at) as date, COUNT(*) as docs
FROM documents
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

### 2. Scale Up SQL Orchestrator 🔥🔥
**Priority:** HIGH (after monitoring)
**Estimated Time:** 1-2 hours
**Blockers:** Must confirm stability first
**Dependencies:** Monitor pg_cron (1-2 days)

**Why:** Currently processing only 1 source × 3 URLs = 3 docs/day. Need to scale to 10-15 docs/day.

**Tasks:**
- [ ] Confirm 1-2 successful auto-runs
- [ ] Update run_source_hunter_sql() limits:
  - FROM: 1 source, 3 URLs
  - TO: 2-3 sources, 5 URLs
- [ ] Test manually first
- [ ] Update pg_cron job with new limits
- [ ] Monitor for timeouts
- [ ] Gradually increase if stable

**Target:** 10-15 documents per day (3-5 sources × 5 URLs)

---

### 3. Content Fetcher Integration 🔥🔥
**Priority:** HIGH
**Estimated Time:** 3-4 hours
**Blockers:** None
**Dependencies:** SQL Source Hunter (✅ Done)

**Why:** Documents have URLs but no HTML content. Need content for Event Extractor.

**Tasks:**
- [ ] Create Migration 045 - Add fetch_error, retry_count columns
- [ ] Update Content Fetcher - batch processing + error handling
- [ ] Create SQL function to call Content Fetcher from orchestrator
- [ ] Test with real documents (3-10 docs)
- [ ] Verify 80%+ fetch success rate
- [ ] Integrate with pg_cron job
- [ ] Deploy to production

**See:** `CONTENT_FETCHER_ROADMAP.md` for detailed plan

---

## 🎯 PHASE 4 REMAINING WORK

### Part 7: Event Extractor Integration (Not Started)
**Estimated Time:** 4-6 hours
**Dependencies:** Content Fetcher

**Tasks:**
- [ ] Update Event Extractor to work with new document format
- [ ] Create SQL function wrapper or Edge Function call
- [ ] Integrate with orchestrator
- [ ] Test extraction quality
- [ ] Verify events → documents linking

---

### Part 8: Criticality Scorer + Duplicate Detector (Not Started)
**Estimated Time:** 3-5 hours
**Dependencies:** Event Extractor

**Tasks:**
- [ ] Implement Criticality Scorer (1-5 scoring)
- [ ] Implement Duplicate Detector (cosine similarity)
- [ ] Integrate both into pipeline
- [ ] Test deduplication accuracy

---

## 📋 TECHNICAL DEBT & IMPROVEMENTS

### High Priority 🔥
- [x] **~~Remove Edge Function timeout issue~~** - RESOLVED (SQL approach)
- [x] **~~Fix 401 authentication errors~~** - RESOLVED (SQL approach)
- [ ] **Improve document title parsing** - Fix generic "Document from domain.com"
- [ ] **Add retry logic for failed API calls** - Perplexity/OpenAI retries
- [ ] **Clean up temporary test files** - After confirming stability (1-2 weeks)

### Medium Priority
- [ ] **Add monitoring dashboard** - Track pipeline success rates
- [ ] **Implement cost tracking** - Per-run Perplexity/OpenAI costs
- [ ] **Add email notifications** - Pipeline completion alerts
- [ ] **Improve error messages in UI** - More user-friendly errors

### Low Priority
- [ ] **Add document preview in UI** - Show content_html preview
- [ ] **Implement semantic search** - Use pgvector for document search
- [ ] **Add export functionality** - Export documents to CSV/Excel
- [ ] **Create analytics dashboard** - Success rates, costs, timing

---

## 🐛 KNOWN ISSUES

### ✅ RESOLVED
- ~~Edge Function Timeout~~ - FIXED (SQL-based approach)
- ~~401 Authentication Errors~~ - FIXED (SQL functions, no Edge Functions)
- ~~HTTP Timeout (5s)~~ - FIXED (simplified Perplexity requests)
- ~~Async Job Queue broken~~ - NOT NEEDED (pg_cron calls SQL directly)

### Important
- ⚠️ **Low Coverage** - Only 1 source × 3 URLs per run (3 docs/day)
  - **Fix:** Scale up after monitoring (Priority #2)

- ⚠️ **Title Extraction** - Generic "Document from domain.com" titles
  - **Fix:** Improve parsing from Perplexity response

- ⚠️ **No HTML Content** - Documents have URLs but no content
  - **Fix:** Content Fetcher integration (Priority #3)

### Minor
- ⚠️ **Temporary Test Files** - Root directory has test_*.sql files
  - **Fix:** Delete after 1-2 weeks of stability

- ⚠️ **No Content Preview** - Can't see document content in UI
  - **Fix:** Add content_html preview modal

---

## 📚 DOCUMENTATION TASKS

### Completed ✅
- ✅ SESSION_CHECKPOINT_2025-12-30.md - Full session report
- ✅ SESSION_CONTEXT.md - Updated with SQL approach
- ✅ LESSONS_LEARNED.md - Added 3 new problems + solutions
- ✅ CLEANUP_SUMMARY.md - Root directory cleanup
- ✅ Updated CLAUDE.md - Version 0.9.0
- ✅ Updated TODO.md - This file!
- ✅ Moved ROADMAP.md to archive - Outdated
- ✅ Created sql-scripts/ - Utility scripts
- ✅ Created docs/archive/ - Historical documents

### Pending
- [ ] Update AI_AGENTS_ARCHITECTURE_V3.md - Add SQL approach section
- [ ] Create PRODUCTION_DEPLOYMENT.md - Deployment checklist
- [ ] Update README.md - Add new features

---

## 🚀 PHASE 5: Production Ready (Future)

**Not Started** - After Phase 4 complete

### Tasks:
- [x] ~~Implement cron jobs~~ - DONE (pg_cron scheduled)
- [ ] Setup monitoring & alerting
- [ ] Add user management UI
- [ ] Implement email notifications
- [ ] Create admin analytics dashboard
- [ ] Setup backup & recovery procedures
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Production deployment

**Estimated Time:** 2-3 weeks

---

## 📊 PROGRESS TRACKING

### Phase 4 Status: 60% Complete ⬆️ (was 50%)

**Completed:**
- ✅ Part 1: Documents Library Improvements
- ✅ Part 2: Source Hunter Agent (stub)
- ✅ Part 3: Content Fetcher Agent (standalone)
- ✅ Part 4: Document Processor + Search Orchestrator + Admin UI
- ✅ Part 5: Source Hunter V2 Scope-Aware + Segment-Aware (Edge Functions)
- ✅ **Part 6: SQL-based Source Hunter Complete** 🆕
  - 8 migrations (037-044)
  - Pure PostgreSQL implementation
  - pg_cron automated scheduling
  - Supabase Vault for API keys
  - 3 documents created successfully (0 errors)

**In Progress:**
- 🚧 Monitoring auto-runs (1-2 days observation)
- 🚧 Scaling orchestrator (after monitoring)
- 🚧 Content Fetcher Integration (next priority)

**Not Started:**
- ⏳ Part 7: Event Extractor Integration
- ⏳ Part 8: Criticality Scorer + Duplicate Detector
- ⏳ Part 9: End-to-End Testing

---

## 🎯 NEXT SESSION GOALS

**Priority Order:**
1. 📊 **Monitor pg_cron** - Wait 1-2 days, check auto-runs (passive)
2. ⬆️ **Scale orchestrator** - Increase to 2-3 sources (1-2 hours)
3. 🔥 **Content Fetcher** - Get HTML content for documents (3-4 hours)
4. 🟢 **Event Extractor** - Extract events from documents (4-6 hours)

**Recommended:**
- Day 1-2: Monitor (passive observation)
- Day 3: Scale up + Content Fetcher
- Day 4: Event Extractor

---

## 💡 OPTIMIZATION IDEAS (Future)

- [ ] Parallel processing of segments (multiple sources concurrently)
- [ ] Caching of Perplexity results (reduce API calls)
- [ ] Incremental updates (only new documents since last run)
- [ ] Smart source selection (prioritize sources with recent updates)
- [ ] A/B testing of prompts (compare quality metrics)
- [ ] Automated quality scoring (track relevance over time)
- [ ] Error notifications via Telegram/email

---

## 🏗️ ARCHITECTURAL DECISIONS LOG

### 2025-12-30: SQL-based Source Hunter
**Decision:** Rewrite Source Hunter from Edge Functions to pure PostgreSQL

**Reasons:**
- PostgreSQL extensions can't authenticate with Edge Functions (401 errors)
- pg_cron needs direct SQL function calls
- Simpler, faster, more reliable
- Eliminates cold starts and authentication issues

**Trade-offs:**
- ✅ Benefits: Works reliably, easier debugging, no auth issues
- ❌ Cost: HTTP timeout limited to 5 seconds (must optimize requests)

**Outcome:** SUCCESS - 3 documents created, 0 errors, pg_cron scheduled

---

## 📞 BLOCKERS & QUESTIONS

**Current Blockers:** None! 🎉

**Questions for User:**
- Wait 1-2 days for monitoring or proceed with Content Fetcher immediately?
- Any specific sources/segments to prioritize for scaling?
- Keep temporary test SQL files or delete now?

---

## ✅ SESSION FINALIZATION CHECKLIST

**При финализации КАЖДОЙ сессии обновляй:**
- [ ] **TODO.md** (этот файл) - прогресс, новые задачи
- [ ] **SESSION_CONTEXT.md** - что сделано, следующие шаги, приоритеты

**При значимых вехах (Phase Complete, Major Change):**
- [ ] **SESSION_CHECKPOINT_YYYY-MM-DD.md** - детальный отчёт (только при major milestone!)
- [ ] **LESSONS_LEARNED.md** - новые проблемы + решения (если нашли)
- [ ] **DEVELOPMENT_STATUS.md** - статус фаз (если изменился прогресс)
- [ ] **CLAUDE.md** - версия, прогресс (если major change)

---

**Last Updated:** 2025-12-30 (Session: SQL-based Source Hunter Complete)
**Next Review:** After 1-2 days monitoring or Content Fetcher implementation
**Version:** 0.9.0
