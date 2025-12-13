# 🚀 Testing Quick Start - Phase 4 Day 1

**Duration:** ~1-2 hours
**Type:** Manual + Automated Testing
**Target:** Documents Library + Source Hunter Agent

---

## ⚡ QUICK SETUP (5 minutes)

### 1. Prepare Environment

```bash
# Terminal 1: Start dev server
cd frontend
npm run dev
# Should show: ✓ built in XXms (http://localhost:5173)

# Terminal 2: Keep git terminal ready
cd ..
git status
```

### 2. Check Prerequisites

```bash
# Check TypeScript
npm run type-check
# Should show: ✓ No errors

# Check Node version
node --version
# Should be: v18+ or v20+

# Check Supabase local
supabase status
# Should show: Local Studio running
```

---

## 📱 QUICK TEST 1: Documents Library UI (15 minutes)

### Step 1: Navigate to Documents
1. Open http://localhost:5173
2. Login as admin
3. Go to Admin Panel
4. Click "Documents" tab

### Step 2: Test Download Button
```
✅ Check: Download button (↓) visible
✅ Check: Open button (📄) visible
✅ Click: Download → file downloads
✅ Click: Open → opens in new tab
```

### Step 3: Test File Size Column
```
✅ Check: "Размер" column exists
✅ Check: Sizes formatted (e.g., "1.5 MB")
✅ Check: Null sizes show "—"
```

### Step 4: Test Document Type Filter
```
✅ Select: "PDF" → only PDFs visible
✅ Select: "Word" → only DOCXs visible
✅ Check: Icons colored correctly (red, blue, orange, green, purple)
✅ Select: "Все типы" → all visible again
```

### Step 5: Test Semantic Search
```
✅ Type: "кондиционеры" in semantic search
✅ Click: "Искать по смыслу" button
✅ Wait: for results (loading spinner)
✅ Check: Modal opened with similarity scores
✅ Check: Scores colored (green, blue, orange)
```

**Result:** [ ] ✅ PASS / [ ] ❌ FAIL

---

## 🤖 QUICK TEST 2: Source Hunter Agent API (20 minutes)

### Option A: Using curl (recommended)

#### Test 1: Basic Request
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "новые кондиционеры на рынке России 2025",
    "date_range_days": 7
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "documents_created": 0,
  "urls": [],
  "message": "Found and saved 0 documents"
}
```

**Check:**
- [ ] Status 200 OK
- [ ] Response has all fields
- [ ] No errors

#### Test 2: Error Handling
```bash
curl -X POST http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Content-Type: application/json" \
  -d '{"prompt": ""}'
```

**Expected Response:**
```json
{
  "status": "error",
  "documents_created": 0,
  "urls": [],
  "error": "Missing required parameter: prompt"
}
```

**Check:**
- [ ] Status 400 Bad Request
- [ ] Error message clear
- [ ] Response valid JSON

#### Test 3: CORS Preflight
```bash
curl -i -X OPTIONS http://localhost:54321/functions/v1/agents/source-hunter \
  -H "Access-Control-Request-Method: POST"
```

**Expected Headers:**
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: ...
```

**Check:**
- [ ] Status 200
- [ ] CORS headers present

---

### Option B: Using Postman

1. **Import Collection:**
   - Open Postman
   - Import: `supabase/functions/agents/source-hunter/POSTMAN_COLLECTION.json`

2. **Run Tests:**
   - Click: Test 1: Basic Search
   - Check: Response status 200
   - Click: Test 2: Search with Segments
   - Check: Response has results
   - Click: Test 3: Search with Geography
   - Check: No errors
   - Click: Test 4: Error - Empty Prompt
   - Check: Status 400

3. **Verify:**
   - [ ] All tests show green ✓
   - [ ] No failed tests

---

### Option C: Using Test Script

```bash
# Make script executable
chmod +x test-source-hunter.sh

# Run automated tests
./test-source-hunter.sh
```

**Expected Output:**
```
✓ Status Code: 200
✓ Status Code: 200
✓ Status Code: 200
✓ Status Code: 400

Passed: 4/4
Failed: 0/4
Score: 100%

✓ ALL TESTS PASSED!
```

**Result:** [ ] ✅ PASS / [ ] ❌ FAIL

---

## 📋 QUICK TEST 3: Code Quality (10 minutes)

### TypeScript Check
```bash
cd frontend
npm run type-check
```
- [ ] ✅ No errors
- [ ] ✅ No `any` types
- [ ] ✅ All types resolved

### Folder Structure
```bash
ls -la supabase/functions/agents/source-hunter/
```

Should show:
- [ ] ✅ index.ts
- [ ] ✅ types.ts
- [ ] ✅ README.md
- [ ] ✅ POSTMAN_COLLECTION.json

### File Sizes
```bash
wc -l supabase/functions/agents/source-hunter/*.ts
```

Should show:
- [ ] ✅ index.ts: 400+ lines
- [ ] ✅ types.ts: 30+ lines

---

## 🎯 QUICK SCORING

### Documents Library (5 items)
- [ ] Download button works: Yes / No
- [ ] File size displays: Yes / No
- [ ] Type filter works: Yes / No
- [ ] Icons colored: Yes / No
- [ ] Semantic search works: Yes / No

**Score: __ / 5** (__ %)

### Source Hunter Agent (5 items)
- [ ] Folder structure correct: Yes / No
- [ ] Files present: Yes / No
- [ ] API responds 200: Yes / No
- [ ] Error handling works: Yes / No
- [ ] CORS headers present: Yes / No
- [ ] TypeScript compiles: Yes / No

**Score: __ / 6** (__ %)

### Overall
**Total: __ / 11** (____ %)

---

## ✅ SIGN-OFF CHECKLIST

- [ ] **Documents Library**: All 5 tests pass
- [ ] **Source Hunter Agent**: All 6 tests pass
- [ ] **Code Quality**: TypeScript checks pass
- [ ] **No Critical Issues**: All working as expected
- [ ] **Ready for Next Phase**: Yes

---

## 📊 QUICK RESULTS

**Status:**
- [ ] ✅ ALL PASS - Ready for next phase
- [ ] 🟡 MOSTLY PASS - Minor issues, proceed with caution
- [ ] ❌ FAILURES - Fix issues before proceeding

**Issues Found:** __ (if any)

---

## 🔧 TROUBLESHOOTING

### Issue: TypeScript errors
```bash
# Solution: Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run type-check
```

### Issue: Supabase Edge Function not responding
```bash
# Solution: Check Supabase local status
supabase status
# If not running:
supabase start
```

### Issue: API returns 404
```bash
# Solution: Verify function exists
supabase functions list
# Should show: agents/source-hunter
```

### Issue: CORS errors in browser
```bash
# Solution: Headers are configured in code
# Check: supabase/functions/agents/source-hunter/index.ts
# Look for: corsHeaders constant
```

---

## 📚 REFERENCE DOCS

- **Full Test Plan:** `TEST_PLAN_PHASE4_DAY1.md`
- **Testing Checklist:** `TESTING_CHECKLIST.md`
- **Source Hunter README:** `supabase/functions/agents/source-hunter/README.md`
- **Postman Collection:** `supabase/functions/agents/source-hunter/POSTMAN_COLLECTION.json`

---

## 🎓 LEARNING RESOURCES

- **TypeScript Strict Mode:** https://www.typescriptlang.org/tsconfig#strict
- **CORS Headers:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **REST API Testing:** https://www.postman.com/api-platform/api-testing/
- **Deno Edge Functions:** https://docs.deno.com/deploy/

---

**Estimated Time:** 45 minutes - 1.5 hours
**Difficulty:** Easy to Medium
**Version:** 1.0.0
**Created:** 2025-12-13
