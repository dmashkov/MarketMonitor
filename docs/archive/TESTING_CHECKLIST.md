# ✅ Testing Checklist - Phase 4 Day 1

**Date:** 2025-12-13
**Version:** 0.6.0
**Tester:** [Your Name]
**Status:** Ready for Execution

---

## 📋 PRE-TEST SETUP

- [ ] Git pull latest changes
- [ ] Dev server running: `npm run dev`
- [ ] Supabase local setup ready
- [ ] OPENAI_API_KEY configured
- [ ] Browser DevTools ready (F12)
- [ ] Postman/curl installed
- [ ] Test database with sample documents

---

## 🧪 DOCUMENTS LIBRARY TESTS

### Test Group 1: Download & File Operations

#### Test 1.1: Download Button Display
- [ ] Navigate to Admin → Documents
- [ ] Verify Download button (↓ icon) visible
- [ ] Verify Open button (document icon) visible
- [ ] Buttons are spaced correctly
- **Status:** ✅ Pass / ❌ Fail

#### Test 1.2: Download Functionality
- [ ] Click Download button on PDF
- [ ] Verify file starts downloading
- [ ] Check download filename is correct
- [ ] Repeat with DOCX and PPTX
- **Status:** ✅ Pass / ❌ Fail

#### Test 1.3: Open in New Tab
- [ ] Click Open button (document icon)
- [ ] Verify file opens in new browser tab
- [ ] Verify it's the correct file
- [ ] Test with multiple document types
- **Status:** ✅ Pass / ❌ Fail

### Test Group 2: File Size Display

#### Test 2.1: File Size Formatting
- [ ] Document with 500 bytes → displays "500.0 B"
- [ ] Document with 1024 bytes → displays "1.0 KB"
- [ ] Document with 1048576 bytes → displays "1.0 MB"
- [ ] Document with null file_size → displays "—"
- **Status:** ✅ Pass / ❌ Fail

#### Test 2.2: File Size Column Visibility
- [ ] "Размер" column visible in table
- [ ] Column header aligned correctly
- [ ] Data centered in column
- [ ] Column width appropriate
- **Status:** ✅ Pass / ❌ Fail

### Test Group 3: Document Type Filter

#### Test 3.1: Filter Options
- [ ] Select dropdown visible and clickable
- [ ] 5 options available: All, PDF, Word, PowerPoint, HTML, Webpage
- [ ] Default is "Все типы"
- [ ] Each option has label
- **Status:** ✅ Pass / ❌ Fail

#### Test 3.2: Filter Functionality
- [ ] Select "PDF" → only PDF documents shown
- [ ] Select "Word" → only DOCX documents shown
- [ ] Select "PowerPoint" → only PPTX documents shown
- [ ] Select "HTML" → only HTML documents shown
- [ ] Select "Веб-страница" → only webpage documents shown
- [ ] Select "Все типы" → all documents shown again
- **Status:** ✅ Pass / ❌ Fail

#### Test 3.3: Filter with Icons
- [ ] PDF icon is red (🔴)
- [ ] Word icon is blue (🔵)
- [ ] PowerPoint icon is orange (🟠)
- [ ] HTML icon is green (🟢)
- [ ] Webpage icon is purple (🟣)
- [ ] Icons display in both "Тип" and "Файл" columns
- **Status:** ✅ Pass / ❌ Fail

### Test Group 4: Semantic Search

#### Test 4.1: Semantic Search Input
- [ ] "Семантический поиск (по смыслу)..." visible
- [ ] Input field accepts text
- [ ] Button "Искать по смыслу" visible
- [ ] Button has lightning icon (⚡)
- **Status:** ✅ Pass / ❌ Fail

#### Test 4.2: Semantic Search Execution
- [ ] Type query: "кондиционеры"
- [ ] Press Enter or click button
- [ ] Loading spinner appears
- [ ] Modal opens with results
- [ ] Results have similarity scores
- **Status:** ✅ Pass / ❌ Fail

#### Test 4.3: Semantic Search Results Display
- [ ] Document type icon visible
- [ ] Document title visible
- [ ] Publication date visible
- [ ] Source URL visible
- [ ] **Similarity score visible as colored tag:**
  - [ ] >90% = green
  - [ ] >80% = blue
  - [ ] ≤80% = orange
- [ ] Results sorted by similarity (descending)
- **Status:** ✅ Pass / ❌ Fail

---

## 🤖 SOURCE HUNTER AGENT TESTS

### Test Group 5: Folder Structure & Files

#### Test 5.1: Folder Exists
- [ ] Navigate to: `supabase/functions/agents/source-hunter/`
- [ ] Folder is created
- [ ] Readable permissions
- **Status:** ✅ Pass / ❌ Fail

#### Test 5.2: Required Files Present
- [ ] `index.ts` exists (500+ lines)
- [ ] `types.ts` exists (50+ lines)
- [ ] `README.md` exists
- [ ] `POSTMAN_COLLECTION.json` exists
- **Status:** ✅ Pass / ❌ Fail

#### Test 5.3: File Quality
- [ ] All files have proper syntax
- [ ] No syntax errors in index.ts
- [ ] TypeScript imports valid
- [ ] Comments and documentation present
- **Status:** ✅ Pass / ❌ Fail

### Test Group 6: Type Safety

#### Test 6.1: TypeScript Compilation
```bash
cd frontend
npm run type-check
```
- [ ] No TypeScript errors
- [ ] No `any` types used
- [ ] All interfaces exported
- **Status:** ✅ Pass / ❌ Fail

#### Test 6.2: Type Definitions
- [ ] SourceHunterRequest defined correctly
- [ ] SourceHunterResponse defined correctly
- [ ] SearchSource interface present
- [ ] SearchResult interface present
- **Status:** ✅ Pass / ❌ Fail

### Test Group 7: API Request Structure

#### Test 7.1: Basic Request
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "новые кондиционеры на рынке России 2025",
    "date_range_days": 7
  }'
```
- [ ] Request accepted
- [ ] Response status 200
- [ ] Response contains: status, documents_created, urls
- [ ] No errors in response
- **Status:** ✅ Pass / ❌ Fail

#### Test 7.2: Request with Segments
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "тепловые насосы",
    "segment_ids": ["seg-id-1", "seg-id-2"],
    "date_range_days": 30
  }'
```
- [ ] Request accepted
- [ ] Segment filter applied
- [ ] Response status 200
- **Status:** ✅ Pass / ❌ Fail

#### Test 7.3: Request with Geography
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "рынок",
    "geography_ids": ["geo-moscow"],
    "date_range_days": 14
  }'
```
- [ ] Request accepted
- [ ] Geography filter applied
- [ ] Response status 200
- **Status:** ✅ Pass / ❌ Fail

### Test Group 8: Error Handling

#### Test 8.1: Empty Prompt Error
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{"prompt": ""}'
```
- [ ] Status: 400
- [ ] Error message: "Missing required parameter: prompt"
- [ ] Response format valid
- **Status:** ✅ Pass / ❌ Fail

#### Test 8.2: Invalid JSON Error
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```
- [ ] Status: 400
- [ ] Error message present
- [ ] No server crash
- **Status:** ✅ Pass / ❌ Fail

#### Test 8.3: No Sources Found
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test",
    "segment_ids": ["non-existent-uuid"]
  }'
```
- [ ] Status: 400
- [ ] Error message about no sources
- **Status:** ✅ Pass / ❌ Fail

### Test Group 9: CORS Headers

#### Test 9.1: Response Headers
```bash
curl -i -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```
- [ ] Header: `Access-Control-Allow-Origin: *`
- [ ] Header: `Access-Control-Allow-Headers: ...`
- [ ] Response has proper headers
- **Status:** ✅ Pass / ❌ Fail

#### Test 9.2: CORS Preflight
```bash
curl -i -X OPTIONS http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```
- [ ] Status: 200
- [ ] CORS headers present
- **Status:** ✅ Pass / ❌ Fail

### Test Group 10: Documentation

#### Test 10.1: README.md Quality
- [ ] Overview section present
- [ ] Architecture diagram/description
- [ ] API Request example
- [ ] API Response example
- [ ] Environment variables documented
- [ ] Testing instructions included
- [ ] Performance metrics listed
- [ ] Integration points described
- **Status:** ✅ Pass / ❌ Fail

#### Test 10.2: POSTMAN_COLLECTION.json
- [ ] Valid JSON format
- [ ] Can be imported to Postman
- [ ] 4 test cases present
- [ ] All URLs correct
- [ ] All bodies valid
- [ ] Descriptive test names
- **Status:** ✅ Pass / ❌ Fail

---

## 📊 SCORING

### Documents Library (5 tests)
- Test 1.x (Download): __ / 3
- Test 2.x (File Size): __ / 2
- Test 3.x (Filter): __ / 3
- Test 4.x (Semantic Search): __ / 3

**Documents Library Score: __ / 11**

### Source Hunter Agent (5 tests)
- Test 5.x (Folder & Files): __ / 3
- Test 6.x (Type Safety): __ / 2
- Test 7.x (API Request): __ / 3
- Test 8.x (Error Handling): __ / 3
- Test 9.x (CORS): __ / 2
- Test 10.x (Documentation): __ / 2

**Source Hunter Score: __ / 15**

### Overall Score
**Total: __ / 26 tests passed**

**Percentage: __ %**

---

## 🎯 ACCEPTANCE CRITERIA

- [ ] ✅ ALL 26 tests PASS (100%)
- [ ] ✅ NO critical issues
- [ ] ✅ Code is type-safe
- [ ] ✅ Documentation is complete
- [ ] ✅ API works as documented
- [ ] ✅ UI is functional

---

## 📝 ISSUES FOUND

```
Issue #1: [Describe issue]
- Severity: Critical / High / Medium / Low
- Steps: ...
- Fix: ...

Issue #2: [Describe issue]
...
```

---

## ✅ SIGN-OFF

**Tester Name:** _________________________

**Date:** 2025-12-13

**Time Spent:** ________

**Status:**
- [ ] Ready for next phase
- [ ] Needs fixes first
- [ ] Blocked by issues

**Notes:**
```
[Additional notes]
```

---

## 📚 REFERENCE

- Full Test Plan: `TEST_PLAN_PHASE4_DAY1.md`
- Test Script: `test-source-hunter.sh`
- Source Hunter Agent: `supabase/functions/agents/source-hunter/`
- Documents Library: `frontend/src/modules/admin/documents/components/DocumentsLibrary.tsx`

---

**Version:** 1.0.0
**Created:** 2025-12-13
**Status:** Ready for Testing
