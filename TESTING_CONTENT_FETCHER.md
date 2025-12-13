# 🧪 Testing Plan - Content Fetcher Agent (Phase 4 - Part 2)

**Date:** 2025-12-13
**Agent:** Content Fetcher
**Phase:** Phase 4 - Part 2/5
**Status:** Ready for Testing

---

## 📋 Quick Overview

Content Fetcher Agent загружает и парсит контент с URLs, найденных Source Hunter агентом.

### Основные функции:
- ✅ Загрузка контента с таймаутом и retry логикой
- ✅ Парсинг HTML, PDF, DOCX, PPTX, TXT
- ✅ Сохранение контента в `documents.content_text`
- ✅ Обработка ошибок (404, 403, таймауты)
- ✅ CORS поддержка

---

## 🎯 Test Scenarios

### Test Group 1: File Structure & Types

#### Test 1.1: Folder Structure
```bash
ls -la supabase/functions/agents/content-fetcher/
```

**Expected files:**
- [ ] `index.ts` (600+ lines)
- [ ] `types.ts` (40+ lines)
- [ ] `README.md` (complete)
- [ ] `POSTMAN_COLLECTION.json` (valid)

**Status:** ✅ Pass / ❌ Fail

#### Test 1.2: TypeScript Compilation
```bash
cd frontend
npm run type-check
```

**Expected:**
- [ ] ✅ No TypeScript errors
- [ ] ✅ No `any` types
- [ ] ✅ All imports resolved

**Status:** ✅ Pass / ❌ Fail

#### Test 1.3: Type Definitions
```bash
grep -r "export interface" supabase/functions/agents/content-fetcher/types.ts
```

**Should find:**
- [ ] ContentFetcherRequest
- [ ] ContentFetcherResponse
- [ ] FetchedContent
- [ ] ParseResult

**Status:** ✅ Pass / ❌ Fail

---

### Test Group 2: Basic API Tests

#### Test 2.1: Fetch HTML Content
```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-001",
    "url": "https://www.example.com",
    "document_type": "webpage"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "document_id": "test-001",
  "content_length": <number > 0>,
  "message": "Fetched and stored ... characters"
}
```

**Checks:**
- [ ] Status 200 OK
- [ ] Response has all required fields
- [ ] content_length > 0
- [ ] status = "success"

**Status:** ✅ Pass / ❌ Fail

#### Test 2.2: Fetch with different document types
```bash
# PDF
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-002",
    "url": "https://example.com/document.pdf",
    "document_type": "pdf"
  }'

# DOCX
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-003",
    "url": "https://example.com/document.docx",
    "document_type": "docx"
  }'

# PPTX
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-004",
    "url": "https://example.com/document.pptx",
    "document_type": "pptx"
  }'
```

**Expected:** All return status 200 (or 400 if URL doesn't exist)

**Checks:**
- [ ] PDF: status 200 or 400 (depending on URL)
- [ ] DOCX: status 200 or 400
- [ ] PPTX: status 200 or 400

**Status:** ✅ Pass / ❌ Fail

---

### Test Group 3: Error Handling

#### Test 3.1: Invalid URL
```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-005",
    "url": "https://not-exist-domain-12345.com/page",
    "document_type": "webpage"
  }'
```

**Expected Response:**
```json
{
  "status": "error",
  "document_id": "test-005",
  "content_length": 0,
  "error": "..."
}
```

**Checks:**
- [ ] Status 400 Bad Request
- [ ] Error message present and descriptive
- [ ] status = "error"
- [ ] content_length = 0

**Status:** ✅ Pass / ❌ Fail

#### Test 3.2: Missing Required Parameters
```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{"document_id": "test-006"}'
```

**Expected:**
- [ ] Status 400
- [ ] Error: "Missing required parameters: document_id, url"
- [ ] Response valid JSON

**Status:** ✅ Pass / ❌ Fail

#### Test 3.3: Empty Request Body
```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:**
- [ ] Status 400
- [ ] Proper error message
- [ ] No server crash

**Status:** ✅ Pass / ❌ Fail

#### Test 3.4: Invalid JSON
```bash
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```

**Expected:**
- [ ] Status 400 or 500
- [ ] Error message about JSON parsing
- [ ] No server crash

**Status:** ✅ Pass / ❌ Fail

---

### Test Group 4: CORS & Headers

#### Test 4.1: CORS Preflight Request
```bash
curl -i -X OPTIONS http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

**Expected Headers:**
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type
```

**Checks:**
- [ ] Status 200
- [ ] Access-Control-Allow-Origin present
- [ ] Access-Control-Allow-Headers present

**Status:** ✅ Pass / ❌ Fail

#### Test 4.2: Response Headers in Success
```bash
curl -i -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{"document_id": "test-007", "url": "https://www.example.com", "document_type": "webpage"}'
```

**Expected:**
- [ ] Content-Type: application/json
- [ ] CORS headers present
- [ ] Proper HTTP status codes

**Status:** ✅ Pass / ❌ Fail

---

### Test Group 5: Content Parsing

#### Test 5.1: HTML Parsing
```bash
# Create test HTML file
curl -s "https://www.example.com" > /tmp/test.html

# Fetch and check parsing
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{"document_id": "test-008", "url": "https://www.example.com", "document_type": "webpage"}'
```

**Expected:**
- [ ] Status 200
- [ ] content_length > 0
- [ ] No HTML tags in returned content_length calculation

**Status:** ✅ Pass / ❌ Fail

#### Test 5.2: Content Size Validation
```bash
# For valid content
curl -s -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{"document_id": "test-009", "url": "https://www.example.com", "document_type": "webpage"}' \
  | jq '.content_length'
```

**Expected:**
- [ ] content_length is a number
- [ ] content_length > 0
- [ ] content_length < 50000 (limit per README)

**Status:** ✅ Pass / ❌ Fail

---

### Test Group 6: Timeout & Retry Logic

#### Test 6.1: Request Timeout Handling
```bash
# This should timeout after 15 seconds
curl --max-time 20 -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{"document_id": "test-010", "url": "https://httpbin.org/delay/20", "document_type": "webpage"}'
```

**Expected:**
- [ ] Returns error response (not hang)
- [ ] Error message mentions timeout

**Status:** ✅ Pass / ❌ Fail

---

### Test Group 7: Integration with Source Hunter

#### Test 7.1: Response from Source Hunter Format
```bash
# Simulating Source Hunter finding document and Content Fetcher fetching it
curl -X POST http://localhost:54321/functions/v1/agents/content-fetcher \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://www.example.com",
    "document_type": "webpage"
  }'
```

**Expected:**
- [ ] Accepts document_id from Source Hunter
- [ ] Status 200 or appropriate error
- [ ] Response format matches integration expectations

**Status:** ✅ Pass / ❌ Fail

---

### Test Group 8: Code Quality

#### Test 8.1: No `any` Types
```bash
grep -r "any" supabase/functions/agents/content-fetcher/*.ts | grep -v "// " || echo "✓ No any types found"
```

**Expected:** No `any` types (except in comments)

**Status:** ✅ Pass / ❌ Fail

#### Test 8.2: Function Signatures
```bash
grep -E "^(async )?function|^const.*=.*=>" supabase/functions/agents/content-fetcher/index.ts | head -10
```

**Expected:**
- [ ] All functions have explicit return types
- [ ] All parameters are typed
- [ ] No implicit `any`

**Status:** ✅ Pass / ❌ Fail

#### Test 8.3: Error Handling
```bash
grep -c "catch\|error\|throw" supabase/functions/agents/content-fetcher/index.ts
```

**Expected:**
- [ ] Error handling present (>5 error cases)
- [ ] Try-catch blocks where appropriate
- [ ] Meaningful error messages

**Status:** ✅ Pass / ❌ Fail

#### Test 8.4: Comments & Documentation
```bash
grep -c "^//" supabase/functions/agents/content-fetcher/index.ts
```

**Expected:**
- [ ] >20 lines of comments
- [ ] Clear section headers
- [ ] Function-level documentation

**Status:** ✅ Pass / ❌ Fail

---

## 📊 Scoring

| Category | Tests | Passed | Score |
|----------|-------|--------|-------|
| **File Structure** | 3 | ___ / 3 | ___ % |
| **Basic API** | 2 | ___ / 2 | ___ % |
| **Error Handling** | 4 | ___ / 4 | ___ % |
| **CORS & Headers** | 2 | ___ / 2 | ___ % |
| **Content Parsing** | 2 | ___ / 2 | ___ % |
| **Timeout & Retry** | 1 | ___ / 1 | ___ % |
| **Integration** | 1 | ___ / 1 | ___ % |
| **Code Quality** | 4 | ___ / 4 | ___ % |
| **TOTAL** | **19** | **___ / 19** | **___ %** |

---

## ✅ Acceptance Criteria

- [ ] All 19 tests PASS
- [ ] No `any` types in code
- [ ] All error cases handled
- [ ] CORS headers working
- [ ] Content parsing working for all types
- [ ] Type-safe interfaces
- [ ] Documentation complete

---

## 📝 Issues Found

```
Issue #1: [Describe issue]
- Severity: Critical / High / Medium / Low
- Steps: ...
- Fix: ...

Issue #2: ...
```

---

## ✨ Sign-off

**Tester:** ___________________
**Date:** 2025-12-13
**Status:** ✅ Ready for Next Phase / ⚠️ Minor Issues / ❌ Blocked

**Notes:**
```
[Your notes here]
```

---

## 🚀 Next Steps

If all tests pass:
1. ✅ Commit to GitHub
2. ✅ Update DEVELOPMENT_STATUS.md
3. ✅ Start Phase 4 - Part 3: Document Processor Agent

---

**Version:** 0.1.0
**Created:** 2025-12-13
**Last Updated:** 2025-12-13
