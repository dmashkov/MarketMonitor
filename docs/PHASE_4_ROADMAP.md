# 🗺️ PHASE 4: IMPLEMENTATION ROADMAP

**Version:** 1.0.0
**Date:** 2025-12-14
**Status:** Complete Design ✅

---

## 📊 PHASE 4 BREAKDOWN

### **Phase 4 Part 1-3: COMPLETED ✅**
- ✅ Documents Library improvements
- ✅ Source Hunter Agent (basic structure)
- ✅ Content Fetcher Agent (basic structure)
- ✅ Prompts Management UI
- **Status:** Ready for enhancement and integration

### **Phase 4 Part 4-8: IN PROGRESS 🚀**

---

## 🎯 PHASE 4 PART 4: DOCUMENT PROCESSOR + INFRASTRUCTURE

### Goals
1. Create comprehensive database schema (Migration 017)
2. Implement Document Processor Agent
3. Create Search Orchestrator edge function
4. Build admin UI for running pipeline

### Deliverables

#### **4.1: Database Migration (Migration 017)**
- [ ] Create event_types table
- [ ] Update documents table (remove ARRAY columns, add is_duplicate, etc.)
- [ ] Create linking tables (document_brands, document_segments, etc.)
- [ ] Update search_runs table
- [ ] Create search_runs_stages table
- [ ] Create search_runs_prompts table
- [ ] Create monitoring_profiles table
- [ ] Create prompt_templates table
- [ ] Update events table (add source_type, document_id)
- [ ] Add RLS policies for all tables
- [ ] Add indexes for performance
- [ ] Seed event_types reference data
- [ ] Seed initial monitoring_profiles

**Files to Create/Modify:**
- `supabase/migrations/017_phase_4_pipeline.sql` (NEW)

**Estimated Time:** 2-3 hours

---

#### **4.2: Document Processor Agent**
- [ ] Create `supabase/functions/agents/document-processor/index.ts`
- [ ] Implement LLM prompt generation
- [ ] Implement classification logic (segment, event_types, brands, geographies)
- [ ] Implement JSON parsing from LLM response
- [ ] Implement embedding generation (text-embedding-3-small)
- [ ] Implement content cleaning (canonical layer)
- [ ] Implement database inserts (linking tables + document update)
- [ ] Implement error handling
- [ ] Create types file: `types.ts`
- [ ] Create Postman collection for testing

**Files to Create:**
- `supabase/functions/agents/document-processor/index.ts`
- `supabase/functions/agents/document-processor/types.ts`
- `supabase/functions/agents/document-processor/deno.json`
- `supabase/functions/agents/document-processor/README.md`
- `supabase/functions/agents/document-processor/POSTMAN_COLLECTION.json`

**Estimated Time:** 4-5 hours

**Tests:** 15+ unit tests

---

#### **4.3: Search Orchestrator (Main Coordinator)**
- [ ] Create `supabase/functions/search-orchestrator/index.ts`
- [ ] Implement sequential pipeline execution
- [ ] Implement search_run creation and tracking
- [ ] Implement search_runs_stages logging
- [ ] Implement error handling and rollback
- [ ] Implement response formatting
- [ ] Create types file: `types.ts`
- [ ] Create Postman collection for testing

**Files to Create:**
- `supabase/functions/search-orchestrator/index.ts`
- `supabase/functions/search-orchestrator/types.ts`
- `supabase/functions/search-orchestrator/deno.json`
- `supabase/functions/search-orchestrator/README.md`

**Estimated Time:** 3-4 hours

**Tests:** 10+ integration tests

---

#### **4.4: Admin UI - Pipeline Runner Tab**
- [ ] Create new tab in AdminPanel: "🚀 Запуск Pipeline"
- [ ] Create component: `RunPipelinePanel.tsx`
- [ ] Create hook: `usePipelineRunner.ts` (for API calls)
- [ ] Implement monitoring_profiles dropdown
- [ ] Implement "Run" button
- [ ] Implement progress display (real-time updates)
- [ ] Implement results display
- [ ] Implement error handling and display
- [ ] Create polling/WebSocket for progress updates

**Files to Create:**
- `frontend/src/modules/admin/pipeline/pages/RunPipelinePanel.tsx`
- `frontend/src/modules/admin/pipeline/hooks/usePipelineRunner.ts`
- `frontend/src/modules/admin/pipeline/components/PipelineProgress.tsx`
- `frontend/src/modules/admin/pipeline/components/PipelineResults.tsx`
- `frontend/src/modules/admin/pipeline/index.ts`

**Estimated Time:** 3-4 hours

---

### Phase 4 Part 4 Summary
- **Total Time:** ~12-16 hours
- **Files to Create:** 12-15
- **Test Cases:** 25+
- **Migrations:** 1 large migration

---

## 🎯 PHASE 4 PART 5: DEDUP + CRITICALITY SCORER

### Goals
1. Implement Dedup Agent
2. Implement Criticality Scorer Agent
3. Integration testing

### Deliverables

#### **5.1: Dedup Agent**
- [ ] Create `supabase/functions/agents/dedup/index.ts`
- [ ] Implement cosine similarity calculation (pgvector)
- [ ] Implement batch processing (50 docs at a time)
- [ ] Implement is_duplicate marking
- [ ] Implement error handling
- [ ] Create types file: `types.ts`

**Files to Create:**
- `supabase/functions/agents/dedup/index.ts`
- `supabase/functions/agents/dedup/types.ts`
- `supabase/functions/agents/dedup/deno.json`

**Estimated Time:** 2-3 hours

**Tests:** 10+ unit tests

---

#### **5.2: Criticality Scorer Agent**
- [ ] Create `supabase/functions/agents/criticality-scorer/index.ts`
- [ ] Implement LLM prompt generation
- [ ] Implement scoring logic (1-5)
- [ ] Implement batch processing (10 docs per LLM call)
- [ ] Implement database updates
- [ ] Implement error handling
- [ ] Create types file: `types.ts`

**Files to Create:**
- `supabase/functions/agents/criticality-scorer/index.ts`
- `supabase/functions/agents/criticality-scorer/types.ts`
- `supabase/functions/agents/criticality-scorer/deno.json`

**Estimated Time:** 3-4 hours

**Tests:** 12+ unit tests

**Cost:** ~$0.50 per run (gpt-4o calls)

---

### Phase 4 Part 5 Summary
- **Total Time:** ~5-7 hours
- **Files to Create:** 6
- **Test Cases:** 22+

---

## 🎯 PHASE 4 PART 6: EVENT EXTRACTOR + FINAL INTEGRATION

### Goals
1. Implement Event Extractor Agent
2. Full pipeline integration testing
3. Documentation updates

### Deliverables

#### **6.1: Event Extractor Agent**
- [ ] Create `supabase/functions/agents/event-extractor/index.ts`
- [ ] Implement LLM prompt generation
- [ ] Implement batch processing (documents → events)
- [ ] Support 0-N events per document
- [ ] Implement database inserts
- [ ] Implement document linking
- [ ] Implement error handling
- [ ] Create types file: `types.ts`

**Files to Create:**
- `supabase/functions/agents/event-extractor/index.ts`
- `supabase/functions/agents/event-extractor/types.ts`
- `supabase/functions/agents/event-extractor/deno.json`

**Estimated Time:** 3-4 hours

**Tests:** 15+ unit tests

---

#### **6.2: End-to-End Pipeline Testing**
- [ ] Create test monitoring_profiles
- [ ] Run full pipeline with 5-10 documents
- [ ] Verify data flow (raw → normalized → canonical)
- [ ] Check all linking tables populated correctly
- [ ] Verify events created with proper structure
- [ ] Performance testing (measure duration)
- [ ] Cost calculation (measure API calls)

**Estimated Time:** 2-3 hours

---

#### **6.3: Documentation Updates**
- [ ] Update DEVELOPMENT_STATUS.md
- [ ] Update PHASE_4_ARCHITECTURE.md with actual results
- [ ] Create operation guide for admins
- [ ] Document troubleshooting guide

**Estimated Time:** 1-2 hours

---

### Phase 4 Part 6 Summary
- **Total Time:** ~6-9 hours
- **Files to Create:** 3
- **Test Cases:** 15+
- **Full Pipeline Testing:** 1-2 runs

---

## 🎯 PHASE 4 PART 7: MONITORING PROFILES + PROMPT TEMPLATES UI

### Goals
1. Create UI for managing monitoring_profiles
2. Create UI for managing prompt_templates
3. Admin dashboard improvements

### Deliverables

#### **7.1: Monitoring Profiles Management UI**
- [ ] Create `frontend/src/modules/admin/monitoring-profiles/` module
- [ ] Create `MonitoringProfilesManager.tsx` (CRUD table)
- [ ] Create `MonitoringProfileFormModal.tsx` (create/edit)
- [ ] Create `useMonitoringProfiles.ts` (React Query hooks)
- [ ] Create `monitoring-profiles-api` Edge Function
- [ ] Implement filters (segment, brand, geography, event_type)
- [ ] Implement multi-select for scope configuration
- [ ] Add to AdminPanel as tab

**Files to Create:**
- `frontend/src/modules/admin/monitoring-profiles/index.ts`
- `frontend/src/modules/admin/monitoring-profiles/components/MonitoringProfilesManager.tsx`
- `frontend/src/modules/admin/monitoring-profiles/components/MonitoringProfileFormModal.tsx`
- `frontend/src/modules/admin/monitoring-profiles/hooks/useMonitoringProfiles.ts`
- `supabase/functions/monitoring-profiles-api/index.ts`

**Estimated Time:** 4-5 hours

---

#### **7.2: Prompt Templates Management UI**
- [ ] Create `frontend/src/modules/admin/prompt-templates/` module
- [ ] Create `PromptTemplatesManager.tsx` (CRUD table)
- [ ] Create `PromptTemplateFormModal.tsx` (with editor)
- [ ] Create `usePromptTemplates.ts` (React Query hooks)
- [ ] Create `prompt-templates-api` Edge Function
- [ ] Implement template editor with placeholder visualization
- [ ] Add to AdminPanel as tab

**Files to Create:**
- `frontend/src/modules/admin/prompt-templates/index.ts`
- `frontend/src/modules/admin/prompt-templates/components/PromptTemplatesManager.tsx`
- `frontend/src/modules/admin/prompt-templates/components/PromptTemplateFormModal.tsx`
- `frontend/src/modules/admin/prompt-templates/hooks/usePromptTemplates.ts`
- `supabase/functions/prompt-templates-api/index.ts`

**Estimated Time:** 4-5 hours

---

### Phase 4 Part 7 Summary
- **Total Time:** ~8-10 hours
- **Files to Create:** 10
- **AdminPanel Tabs:** +2 new tabs

---

## 🎯 PHASE 4 PART 8: SCHEDULING + OPTIMIZATION

### Goals (PHASE 5, not Part 8)
This is future work, not in Phase 4 MVP.

Will include:
- [ ] CRON scheduling for monitoring_profiles
- [ ] Parallel execution of agents
- [ ] Alert Manager Agent
- [ ] Report Generator Agent
- [ ] Scheduler UI

---

## 📊 TIMELINE SUMMARY

| Part | Goal | Time | Status |
|------|------|------|--------|
| 1-3 | Source Hunter, Content Fetcher, Prompts Mgmt | 2 weeks | ✅ DONE |
| **4** | **Document Processor + Search Orchestrator + UI** | **12-16h** | 🚀 **NEXT** |
| **5** | **Dedup + Criticality Scorer** | **5-7h** | 📋 NEXT |
| **6** | **Event Extractor + Integration** | **6-9h** | 📋 NEXT |
| **7** | **Monitoring Profiles + Prompts UI** | **8-10h** | 📋 NEXT |
| **8+** | **Scheduling, Optimization (Phase 5)** | TBD | 📋 FUTURE |

**Total Phase 4 (Parts 4-7):** ~31-42 hours

---

## 🎯 START: PHASE 4 PART 4

### Step 1: Database Migration
```bash
# Create migration 017
supabase migrations new phase_4_pipeline

# Edit supabase/migrations/017_phase_4_pipeline.sql
# Add all tables from DATABASE_SCHEMA.md

# Apply locally
supabase db reset

# Deploy to production
supabase db push
```

### Step 2: Source Hunter Updates
```bash
# Update existing source-hunter agent to:
# - Accept search_run_id parameter
# - Store documents with content_text (first 500 chars from URL)
# - Record each stage in search_runs_stages
```

### Step 3: Content Fetcher Updates
```bash
# Update existing content-fetcher agent to:
# - Work with new documents schema
# - Extract published_date from HTML
# - Update linking tables properly
```

### Step 4: Document Processor (NEW)
```bash
# Create document-processor edge function
# Implement LLM classification
# Implement embedding generation
# Create linking tables
```

### Step 5: Search Orchestrator (NEW)
```bash
# Create search-orchestrator edge function
# Coordinate all agents in sequence
# Manage search_runs and search_runs_stages
# Implement error handling
```

### Step 6: Admin UI (NEW)
```bash
# Add "🚀 Запуск Pipeline" tab
# Implement monitoring_profiles selection
# Display pipeline progress
# Show final results
```

---

## ✅ MVP DEFINITION

**Phase 4 Part 4 MVP includes:**
- ✅ Full database schema
- ✅ Document Processor Agent (with LLM classification)
- ✅ Search Orchestrator (sequential pipeline)
- ✅ Admin UI (run button + progress)
- ✅ One monitoring_profile (for testing)
- ✅ End-to-end data flow (raw → canonical → events)

**NOT included in MVP:**
- ❌ Dedup agent (implement in Part 5)
- ❌ Criticality Scorer (implement in Part 5)
- ❌ Event Extractor (implement in Part 6)
- ❌ Monitoring profiles UI (implement in Part 7)
- ❌ Prompt templates UI (implement in Part 7)
- ❌ CRON scheduling (Phase 5)
- ❌ Parallel execution (Phase 5)

---

## 🔍 SUCCESS CRITERIA (Phase 4 Part 4)

- [ ] Migration 017 applied successfully
- [ ] All new tables created with proper RLS
- [ ] Source Hunter produces documents
- [ ] Content Fetcher fills content_text
- [ ] Document Processor classifies and embeds documents
- [ ] Linking tables populated correctly
- [ ] Search Orchestrator runs full pipeline
- [ ] Admin UI allows running pipeline
- [ ] Progress tracking works
- [ ] Full pipeline takes <15 minutes for 10 documents
- [ ] No data loss or corruption
- [ ] Proper error handling throughout

---

