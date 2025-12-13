# 🧪 Test Plan - Phase 4 Day 1 (2025-12-13)

**Дата:** 2025-12-13
**Версия:** 0.6.0
**Статус:** Ready for Testing
**Scope:** Documents Library Improvements + Source Hunter Agent

---

## 📋 ТЕСТИРОВАНИЕ: Documents Library Improvements

### ✅ Test 1: Download Button Functionality

**Objective:** Проверить, что кнопка скачивания работает корректно

**Precondition:**
- [ ] Dev server запущен: `npm run dev`
- [ ] БД заполнена тестовыми документами
- [ ] Пользователь авторизован как admin

**Test Steps:**
1. [ ] Перейти на страницу Admin → Documents
2. [ ] Найти документ с file_url (не пустой)
3. [ ] Нажать на иконку Download (📥)
4. [ ] Проверить, что файл начинает скачиваться
5. [ ] Проверить, что кнопка Open (иконка документа) тоже работает
6. [ ] Нажать Open - должен открыть в новой вкладке

**Expected Results:**
- ✅ Download button видна рядом с иконкой документа
- ✅ Клик на Download начинает скачивание
- ✅ Клик на иконку открывает файл в новой вкладке
- ✅ Tooltip показывает "Скачать файл" и "Открыть файл"

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 2: File Size Display

**Objective:** Проверить, что размер файла корректно отображается

**Precondition:**
- [ ] Documents Library открыта
- [ ] Есть документы с разными file_size (100B, 1KB, 1MB)

**Test Steps:**
1. [ ] Найти документ с file_size ~1000 (1 KB)
2. [ ] Проверить, что отображается "1.0 KB"
3. [ ] Найти документ с file_size ~1000000 (1 MB)
4. [ ] Проверить, что отображается "1.0 MB"
5. [ ] Найти документ с file_size=null
6. [ ] Проверить, что отображается "—"

**Expected Results:**
- ✅ Колонка "Размер" видна в таблице
- ✅ Формат: "N.N KB", "N.N MB", "N.N GB"
- ✅ Null значения отображаются как "—"
- ✅ Сортировка работает (если включена)

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 3: Document Type Filter

**Objective:** Проверить фильтрацию по типу документа

**Precondition:**
- [ ] Documents Library открыта
- [ ] Есть документы разных типов (PDF, DOCX, PPTX, HTML, Webpage)

**Test Steps:**
1. [ ] Нажать на Select "Тип документа"
2. [ ] Выбрать "Все типы" - все документы видны
3. [ ] Выбрать "PDF" - видны только PDF
4. [ ] Проверить, что иконки соответствуют типам
5. [ ] Выбрать "Word" - видны только DOCX
6. [ ] Выбрать "PowerPoint" - видны только PPTX
7. [ ] Выбрать "HTML" - видны только HTML
8. [ ] Выбрать "Веб-страница" - видны только webpage
9. [ ] Очистить фильтр (x) - все документы видны снова

**Expected Results:**
- ✅ Фильтр присутствует в UI
- ✅ Каждый тип фильтруется корректно
- ✅ Иконки соответствуют типам (цвет + стиль)
- ✅ Очистка фильтра возвращает все документы
- ✅ Таблица обновляется автоматически

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 4: Semantic Search UI

**Objective:** Проверить, что UI семантического поиска работает

**Precondition:**
- [ ] Documents Library открыта
- [ ] В БД есть документы с embeddings
- [ ] OPENAI_API_KEY установлен

**Test Steps:**
1. [ ] Найти input "Семантический поиск (по смыслу)..."
2. [ ] Ввести запрос: "кондиционеры"
3. [ ] Нажать Enter или кнопку "Искать по смыслу"
4. [ ] Дождаться загрузки (loading spinner)
5. [ ] Проверить, что открылся Modal с результатами
6. [ ] Проверить, что результаты содержат:
   - Иконку типа
   - Название документа
   - Дату публикации
   - Источник (URL)
   - **Сходство (similarity)** в процентах

**Expected Results:**
- ✅ Input поля видны
- ✅ Button работает
- ✅ Loading показывается
- ✅ Modal открывается с результатами
- ✅ Similarity отображается как цветной Tag (зеленый > синий > оранжевый)
- ✅ Результаты отсортированы по similarity (desc)

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 5: Document Icons & Layout

**Objective:** Проверить, что иконки документов отображаются корректно

**Precondition:**
- [ ] Documents Library открыта

**Test Steps:**
1. [ ] Проверить иконки в колонке "Тип":
   - PDF: 🔴 красный (FilePdfOutlined)
   - DOCX: 🔵 синий (FileWordOutlined)
   - PPTX: 🟠 оранжевый (FilePptOutlined)
   - HTML: 🟢 зеленый (FileTextOutlined)
   - Webpage: 🟣 фиолетовый (GlobalOutlined)
2. [ ] Проверить tooltip при наведении на иконку
3. [ ] Проверить иконки в колонке "Файл"
4. [ ] Проверить Space между Open и Download кнопками

**Expected Results:**
- ✅ Все иконки видны и имеют правильные цвета
- ✅ Tooltips показывают название типа
- ✅ В колонке "Файл" есть две иконки (Open + Download)
- ✅ Кнопки расположены близко друг к другу

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

## 📋 ТЕСТИРОВАНИЕ: Source Hunter Agent

### ✅ Test 6: Folder Structure & Files

**Objective:** Проверить, что все файлы Edge Function созданы корректно

**Precondition:**
- [ ] Git pull latest changes

**Test Steps:**
1. [ ] Проверить существование папки:
   ```
   supabase/functions/agents/source-hunter/
   ```
2. [ ] Проверить наличие файлов:
   - [ ] index.ts (500+ lines)
   - [ ] types.ts (type definitions)
   - [ ] README.md (documentation)
   - [ ] POSTMAN_COLLECTION.json (tests)
3. [ ] Проверить import statements в index.ts
4. [ ] Проверить CORS headers в коде

**Expected Results:**
- ✅ Все файлы присутствуют
- ✅ index.ts имеет правильную структуру
- ✅ types.ts импортируется в index.ts
- ✅ CORS headers сконфигурированы

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 7: Source Hunter Type Safety

**Objective:** Проверить, что TypeScript типы корректны

**Precondition:**
- [ ] Terminal откран в проекте

**Test Steps:**
1. [ ] Запустить type-check:
   ```bash
   npx tsc --noEmit supabase/functions/agents/source-hunter/index.ts
   ```
2. [ ] Проверить, что ошибок нет
3. [ ] Проверить interfaces в types.ts:
   - SourceHunterRequest (имеет все поля)
   - SourceHunterResponse (имеет все поля)
   - SearchSource (для БД)
   - SearchResult (для результатов)

**Expected Results:**
- ✅ Type-check проходит без ошибок
- ✅ Все interfaces экспортированы
- ✅ Нет `any` типов
- ✅ Request/Response типизированы

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 8: API Request Structure (Manual)

**Objective:** Проверить, что request структура корректна

**Precondition:**
- [ ] Postman установлен или используется альтернатива (curl, REST Client)

**Test Steps:**
1. [ ] Создать POST запрос на:
   ```
   http://localhost:54321/functions/v1/agents/source-hunter
   ```
2. [ ] Установить header:
   ```
   Content-Type: application/json
   ```
3. [ ] Отправить body (Test 1 - Basic):
   ```json
   {
     "prompt": "новые кондиционеры на рынке России 2025",
     "date_range_days": 7
   }
   ```
4. [ ] Проверить response structure
5. [ ] Повторить с другой структурой body (Test 2 - с segment_ids)

**Expected Response:**
```json
{
  "status": "success",
  "documents_created": 0,
  "urls": [],
  "message": "Found and saved 0 documents"
}
```
*(0 documents потому что это mock implementation)*

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 9: Error Handling

**Objective:** Проверить, что ошибки обрабатываются корректно

**Precondition:**
- [ ] Postman запрос готов

**Test Steps:**

**Test 9a: Empty Prompt**
1. [ ] Отправить request с пустым prompt:
   ```json
   {
     "prompt": ""
   }
   ```
2. [ ] Проверить response:
   - Status: 400
   - Status field: "error"
   - Error message: "Missing required parameter: prompt"

**Test 9b: No Sources Found**
1. [ ] Отправить request с несуществующим segment_id:
   ```json
   {
     "prompt": "test",
     "segment_ids": ["non-existent-id"]
   }
   ```
2. [ ] Проверить response:
   - Status: 400 или 200 (в зависимости от реализации)
   - Status field: "error" или "success"
   - Message: о том, что нет источников

**Test 9c: Invalid JSON**
1. [ ] Отправить malformed JSON body
2. [ ] Проверить response:
   - Status: 400
   - Error message: понятное описание ошибки

**Expected Results:**
- ✅ Все ошибки обработаны
- ✅ HTTP статусы корректные
- ✅ Error messages понятны
- ✅ No unhandled exceptions

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 10: CORS Headers

**Objective:** Проверить, что CORS headers присутствуют в response

**Precondition:**
- [ ] Browser DevTools открыт (F12)
- [ ] Source Hunter endpoint готов

**Test Steps:**
1. [ ] Отправить request через Postman/curl с origin header
2. [ ] Проверить response headers:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
3. [ ] Отправить OPTIONS request (CORS preflight)
4. [ ] Проверить response на OPTIONS

**Expected Results:**
- ✅ CORS headers присутствуют
- ✅ OPTIONS запрос возвращает 200 OK
- ✅ Access-Control headers корректные

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

### ✅ Test 11: Code Documentation

**Objective:** Проверить, что документация полная и точная

**Precondition:**
- [ ] README.md открыт
- [ ] POSTMAN_COLLECTION.json открыт

**Test Steps:**
1. [ ] Проверить README.md содержит:
   - [ ] Overview
   - [ ] Architecture diagram
   - [ ] API Request/Response examples
   - [ ] Environment variables required
   - [ ] Testing instructions
   - [ ] Performance metrics
   - [ ] Integration points
   - [ ] Next steps

2. [ ] Проверить POSTMAN_COLLECTION.json:
   - [ ] 4 test cases
   - [ ] Правильные URLs
   - [ ] Корректные bodies
   - [ ] Descriptive names

**Expected Results:**
- ✅ README полный и понятный
- ✅ Примеры в документации работают
- ✅ Postman коллекция может быть импортирована
- ✅ Все тесты имеют описания

**Actual Results:**
- [ ] Pass / [ ] Fail / [ ] N/A

**Notes:**
```
[место для заметок]
```

---

## 📊 SUMMARY TEST RESULTS

### Documents Library Tests

| # | Test Name | Status | Notes |
|---|-----------|--------|-------|
| 1 | Download Button | [ ] ✅ / [ ] ❌ | |
| 2 | File Size Display | [ ] ✅ / [ ] ❌ | |
| 3 | Document Type Filter | [ ] ✅ / [ ] ❌ | |
| 4 | Semantic Search UI | [ ] ✅ / [ ] ❌ | |
| 5 | Document Icons | [ ] ✅ / [ ] ❌ | |

**Documents Library Score:** __ / 5 (__ %)

---

### Source Hunter Agent Tests

| # | Test Name | Status | Notes |
|---|-----------|--------|-------|
| 6 | Folder Structure | [ ] ✅ / [ ] ❌ | |
| 7 | Type Safety | [ ] ✅ / [ ] ❌ | |
| 8 | API Request Structure | [ ] ✅ / [ ] ❌ | |
| 9 | Error Handling | [ ] ✅ / [ ] ❌ | |
| 10 | CORS Headers | [ ] ✅ / [ ] ❌ | |
| 11 | Code Documentation | [ ] ✅ / [ ] ❌ | |

**Source Hunter Score:** __ / 6 (__ %)

---

## 🎯 OVERALL RESULTS

**Total:** __ / 11 tests passed

**Status:**
- [ ] ✅ ALL PASS (100%)
- [ ] 🟡 MOSTLY PASS (>80%)
- [ ] ⚠️ SOME FAILURES (<80%)
- [ ] ❌ CRITICAL FAILURES

---

## 📝 ISSUES & BLOCKERS

*(Заполнить если есть проблемы)*

### Issue 1: [Title]
- **Severity:** 🔴 Critical / 🟡 High / 🟠 Medium / 🟢 Low
- **Description:** ...
- **Steps to Reproduce:** ...
- **Workaround:** ...
- **Resolution:** ...

---

## ✅ SIGN-OFF

- [ ] All tests executed
- [ ] All issues documented
- [ ] Ready for next phase
- [ ] Ready for production

**Tester:** _________________
**Date:** 2025-12-13
**Time:** ________

---

## 📚 REFERENCE

- Source Hunter Agent: `supabase/functions/agents/source-hunter/README.md`
- Postman Collection: `supabase/functions/agents/source-hunter/POSTMAN_COLLECTION.json`
- Documents Library: `frontend/src/modules/admin/documents/components/DocumentsLibrary.tsx`
- Type Definitions: `frontend/src/shared/types/index.ts`

---

**Version:** 1.0.0
**Created:** 2025-12-13
**Status:** Ready for Execution
