# 🗺️ MarketMonitor Roadmap - Долгосрочный План

**Дата обновления:** 2025-12-13
**Версия:** 2.1 (Phase 3 Complete + Phase 4 Starting)
**Статус:** ✅ Phase 3 Complete (100%) - 🚀 Phase 4 In Progress (AI Agents Implementation)

---

## 📋 Обзор

MarketMonitor использует **AI Agents 2.0 Architecture** - Multi-Agent система с полным сохранением контента и RAG-based отчётами.

### Ключевые изменения архитектуры:

**БЫЛО (v0.1-0.4):**
```
Daily/Weekly/Monthly промпты → OpenAI → Events таблица (дубликаты, нет истории)
```

**СТАЛО (v0.5+):**
```
Daily Search (8 агентов) → Documents DB + Storage → RAG Reports (семантический поиск + полная история)
```

### Основные преимущества:
1. **Полное сохранение контента** - PDF, PPTX, HTML + embeddings
2. **Multi-Agent Pipeline** - специализированные агенты для каждой задачи
3. **RAG-based отчёты** - анализ накопленных данных, а не одноразовый поиск
4. **Семантический поиск** - pgvector + OpenAI embeddings (1536 dimensions)
5. **Управляемые справочники** - бренды, источники, сегменты через UI

---

## ✅ Phase 1: Foundation (2025-12-03 - COMPLETE)

**Дата завершения:** 2025-12-03

### Что было сделано:
- ✅ React 18 + TypeScript + Vite проект
- ✅ 50+ TypeScript интерфейсов (полная типизация, NO ANY)
- ✅ Tailwind CSS + Ant Design интеграция
- ✅ ESLint + Prettier конфигурация
- ✅ Полная документация (2000+ строк)
- ✅ CI/CD готовность для Netlify

**Статистика:**
- 26 файлов
- 5000+ строк кода
- 100% TypeScript strict mode

---

## ✅ Phase 2: MVP Authentication & Events (2025-12-04 - COMPLETE)

**Дата завершения:** 2025-12-04

### Backend:
- ✅ 4 SQL migrations (001-004)
  - Initial schema (events, ai_prompts, search_runs, job_schedules)
  - User profiles + auth triggers
  - Job scheduling
  - RLS policies
- ✅ Supabase auth интеграция
- ✅ Row Level Security for all tables

### Frontend:
- ✅ Authentication module
  - LoginForm, RegisterForm, ProtectedRoute
  - useAuth hook with session management
- ✅ Events management
  - EventsTable with CRUD operations
  - React Query integration
  - Ant Design components
- ✅ DashboardPage с статистикой

**Статистика:**
- 5 основных модулей
- 7 маршрутов (с защитой)
- 100% RLS enabled

---

## ✅ Phase 3: Admin UI + Document Management (2025-12-12 - COMPLETE)

**Дата завершения:** 2025-12-12

### Backend (9 Edge Functions):
1. ✅ **brands-api** (CRUD для брендов)
2. ✅ **sources-api** (CRUD для источников)
3. ✅ **documents-api** (upload + search + delete)
4. ✅ **users-api** (CRUD для пользователей)
5. ✅ **segments-api** (CRUD для сегментов)
6. ✅ **geographies-api** (CRUD для географии)
7. ✅ **source-urls-api** (управление URL)

**Все функции:**
- ✅ CORS headers правильно настроены
- ✅ Authentication проверка
- ✅ RLS policies соблюдены
- ✅ Type-safe responses (NO any!)
- ✅ Error handling

### Database (New):
- ✅ Migration 009: Documents table with pgvector
  - Embeddings (1536 dimensions)
  - Full-text search index (русский язык)
  - Vector search index (ivfflat)
- ✅ Supabase Storage bucket (market-documents)
  - Структура: pdfs/, presentations/, user-uploads/

### Frontend (4 Admin Modules):
1. ✅ **Brands Management**
   - BrandsManager, BrandFormModal
   - useBrands hook
   - Фильтры: category, country, is_active

2. ✅ **Sources Management**
   - SourcesManager, SourceFormModal
   - useSources hook
   - Фильтры: type, priority, frequency

3. ✅ **Documents Library**
   - DocumentsLibrary, DocumentUploadModal
   - useDocuments, useDocumentUpload hooks
   - Full-text search + semantic search UI
   - Drag & Drop upload
   - Embeddings generation

4. ✅ **Users Management**
   - UsersManager, UserFormModal
   - useUsers hook
   - Role management (admin/user)
   - Status management (active/inactive)

### AdminPanel:
- ✅ 4 tabs (Users, Brands, Sources, Documents)
- ✅ Admin-only routing
- ✅ AppLayout integration

**Статистика Phase 3:**
- ✅ 9 Edge Functions deployed
- ✅ 4 Admin Modules (20+ components)
- ✅ 5 Custom Hooks (React Query)
- ✅ 2 Migrations (009, 20241207_storage)
- ✅ 5000+ lines of code
- ✅ 17 total commits
- ✅ 100% type-safe (NO ANY!)

---

## 🚀 Phase 4: AI Agents Implementation (2025-12-13 - IN PROGRESS)

**Дата начала:** 2025-12-13
**Ожидаемая длительность:** 3-4 недели
**Статус:** 0% (Starting)

### 1️⃣ Documents Library Finalization (1-2 часа)

#### A. Семантический поиск
- [ ] Проверить/создать RPC функцию `search_documents_by_embedding`
- [ ] Тестирование через DocumentsLibrary UI

#### B. Просмотр файлов
- [ ] Добавить Download button
- [ ] File size display
- [ ] Document type filter

### 2️⃣ Core Agents (Week 1-2)

#### Agent 1: Source Hunter
- [ ] Edge Function: `agents/source-hunter/index.ts`
- [ ] Автоматический поиск новых документов
- [ ] OpenAI Web Search интеграция
- [ ] Сохранение в documents таблицу
- **Время:** 2-3 часа
- **Cost:** ~$0.10/query

#### Agent 2: Content Fetcher
- [ ] Edge Function: `agents/content-fetcher/index.ts`
- [ ] Загрузка контента с URL
- [ ] HTML/PDF парсинг
- [ ] Text extraction
- **Время:** 1-2 часа

#### Agent 3: Document Processor
- [ ] Edge Function: `agents/document-processor/index.ts`
- [ ] Embedding generation (OpenAI text-embedding-3-small)
- [ ] Mentions extraction (brands, segments, geographies)
- [ ] Save to database
- **Время:** 2-3 часа
- **Cost:** ~$0.002 per 1K documents

#### Agent 4: Event Extractor
- [ ] Edge Function: `agents/event-extractor/index.ts`
- [ ] Document parsing through OpenAI
- [ ] Event extraction (title, description, type, etc.)
- [ ] Batch processing
- **Время:** 3-4 часа
- **Cost:** ~$0.05/document

### 3️⃣ Supporting Agents (Week 2-3)

#### Agent 5: Criticality Scorer
- [ ] Edge Function: `agents/criticality-scorer/index.ts`
- [ ] Score events 1-5
- [ ] Save reasoning and factors
- **Время:** 2 часа

#### Agent 6: Duplicate Detector
- [ ] Edge Function: `agents/duplicate-detector/index.ts`
- [ ] Cosine similarity search
- [ ] Merge similar events
- [ ] Threshold: 0.85
- **Время:** 1-2 часа

#### Agent 7: Alert Manager
- [ ] Edge Function: `agents/alert-manager/index.ts`
- [ ] Telegram bot integration
- [ ] Email notifications
- [ ] In-app alerts
- **Время:** 2-3 часа

#### Agent 8: Report Generator
- [ ] Edge Function: `agents/report-generator/index.ts`
- [ ] Daily/Weekly/Monthly reports
- [ ] Export to PDF/DOCX
- [ ] Save to reports table
- **Время:** 2-3 часа

### 4️⃣ Orchestration (Week 3)

#### Orchestrator
- [ ] Edge Function: `agents/orchestrator/index.ts`
- [ ] Coordinate all agents
- [ ] Error handling + retry logic
- [ ] Progress tracking
- **Время:** 2-3 часа

#### Custom Prompt Runner
- [ ] Edge Function: `agents/custom-prompt-runner/index.ts`
- [ ] Execute custom prompts
- [ ] Determine: new search vs use DB
- **Время:** 1-2 часа

### 5️⃣ Frontend UI (Week 2-3)

#### Custom Prompt Builder
- [ ] 3-step wizard
- [ ] Goal selection (find events / analyze / compare)
- [ ] Filters (brands, segments, geography, date)
- [ ] Custom instructions + preview
- [ ] Save & run functionality

#### Events Display Updates
- [ ] Source tracking column
- [ ] Criticality badges (1-5, color-coded)
- [ ] Criticality filtering
- [ ] Event source URL links

#### Reports Viewer
- [ ] Display saved reports
- [ ] Date range filtering
- [ ] Export options (PDF, DOCX)
- [ ] Report previews

### Phase 4 Metrics:
- **Total Edge Functions:** 11 (agents + orchestrator + runners)
- **Estimated tokens:** ~100K/month
- **Estimated cost:** $50-100/month
- **Execution time:** 2-3 minutes per full pipeline
- **Database size:** ~1GB for 10K documents

---

## 📋 Phase 5: Production Ready + Cron (Future)

**Ожидаемый старт:** 2025-12-27
**Ожидаемая длительность:** 1-2 недели

### Automation:
- [ ] GitHub Actions workflow (`.github/workflows/daily-search.yml`)
- [ ] Schedule: Daily at 09:00 UTC (12:00 MSK)
- [ ] Trigger orchestrator
- [ ] Environment setup

### Monitoring & Logging:
- [ ] Sentry integration for error tracking
- [ ] Token usage tracking (daily cost)
- [ ] Performance metrics (latency, throughput)
- [ ] Error rate monitoring
- [ ] Database growth monitoring

### Performance Optimization:
- [ ] Profile API calls
- [ ] Cache embeddings
- [ ] Batch processing optimization
- [ ] Cost per document optimization
- [ ] Query optimization

### Testing & QA:
- [ ] E2E tests for full pipeline
- [ ] Load testing (10K documents)
- [ ] Cost analysis and optimization
- [ ] Quality assessment (event accuracy)
- [ ] User acceptance testing

### Deployment:
- [ ] Production database preparation
- [ ] Backup strategy
- [ ] Disaster recovery plan
- [ ] Performance SLA setup

---

## 💡 Phase 6: Advanced Features (Future)

**Ожидаемый старт:** 2026-01-10
**Ожидаемая длительность:** 3-4 недели

### Features:
- [ ] Telegram channel integration
- [ ] Email digest reports
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Competitor tracking
- [ ] Market trend analysis
- [ ] Predictive analytics
- [ ] Custom report scheduling

### Integrations:
- [ ] Slack bot
- [ ] Microsoft Teams
- [ ] Jira integration
- [ ] Google Sheets export
- [ ] S3 backup
- [ ] Datadog monitoring

---

## 📊 Overall Timeline

```
Phase 1: Foundation          ✅ 2025-12-03
Phase 2: MVP Auth+Events    ✅ 2025-12-04
Phase 3: Admin UI            ✅ 2025-12-12
Phase 4: AI Agents           🚀 2025-12-13 (3-4 недели)
Phase 5: Production Ready    📋 2025-12-27 (1-2 недели)
Phase 6: Advanced Features   💡 2026-01-10 (3-4 недели)

Total MVP Duration: ~6-8 недель (3 декабря - конец января)
```

---

## 🎯 Key Metrics & Goals

### Cost per Operation:
- **Embedding generation:** $0.002 per 1K documents (text-embedding-3-small)
- **Event extraction:** $0.05 per document (gpt-4o-mini)
- **Criticality scoring:** $0.02 per 10 events (gpt-4o-mini)
- **Total daily cost:** $5-10 (for 200 documents/day)

### Performance Targets:
- **Semantic search:** <500ms
- **Full pipeline:** 2-3 minutes per search
- **Embeddings:** <1 minute per 1K documents
- **99.9% uptime** for production

### Quality Metrics:
- **Event accuracy:** >90% (manual verification)
- **Duplicate detection:** >95% (f1 score)
- **Criticality scoring:** >80% agreement with human experts
- **Type safety:** 100% (NO ANY in code)

---

## 🔄 Release Schedule

### v0.6.0 (Current - 2025-12-13)
- ✅ Phase 3 Complete (Admin UI 100%)
- 🚀 Phase 4 Starting (Source Hunter Agent)
- Features: Brands, Sources, Documents, Users management

### v0.7.0 (Expected 2025-12-20)
- ✅ Phase 4 - 50% (Core agents: Source Hunter, Content Fetcher, Document Processor)
- Features: Automated document collection + processing

### v0.8.0 (Expected 2026-01-03)
- ✅ Phase 4 - 100% (All agents + orchestrator)
- Features: Full AI pipeline working end-to-end

### v1.0.0 (Expected 2026-01-17)
- ✅ Phase 5 Complete (Production Ready)
- Features: Daily cron jobs, monitoring, optimization

### v1.1.0+ (Ongoing)
- Phase 6 features, integrations, analytics

---

## ✨ Success Criteria

### Phase 4 Success:
- [ ] All 11 Edge Functions deployed and tested
- [ ] Full pipeline runs end-to-end without errors
- [ ] 100+ documents can be processed per day
- [ ] Cost < $10/day
- [ ] Semantic search works with >0.7 similarity
- [ ] Events are extracted correctly >90%

### Phase 5 Success:
- [ ] Daily cron jobs run automatically
- [ ] Zero manual intervention needed
- [ ] Monitoring dashboard active
- [ ] Cost tracking accurate
- [ ] <5% error rate in production

### Phase 6 Success:
- [ ] Telegram integration working
- [ ] Mobile app functional
- [ ] Advanced analytics available
- [ ] User satisfaction > 8/10

---

## 🚀 How to Stay on Track

1. **Daily Standup:**
   - Review TODO.md
   - Check current blockers
   - Update PROGRESS.md

2. **Weekly Review:**
   - Check phase progress
   - Update DEVELOPMENT_STATUS.md
   - Adjust timeline if needed

3. **Biweekly Demo:**
   - Show working features
   - Get user feedback
   - Adjust requirements

4. **Auto-Update Protocol:**
   - After each `git push`, update documentation
   - Maintain accurate metrics
   - Keep timeline realistic

---

## 📞 Contact & Support

For questions about the roadmap:
1. Check CLAUDE.md (AI context)
2. Check DEVELOPMENT_STATUS.md (current status)
3. Check TODO.md (detailed tasks)
4. Check PROGRESS.md (session notes)

---

**Version:** 2.1
**Last Updated:** 2025-12-13
**Status:** Phase 3 ✅ Complete, Phase 4 🚀 In Progress
**Next Review:** Weekly (every Friday)
