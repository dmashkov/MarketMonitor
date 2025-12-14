# 📚 Документация MarketMonitor - Полный индекс

> Навигация по всей документации проекта

---

## 🚀 Начни с этого

### Первый день разработки?
1. **[DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)** - Текущее состояние проекта (15 мин)
2. **[QUICK_DEBUGGING_CHECKLIST.md](QUICK_DEBUGGING_CHECKLIST.md)** - Базовый чек-лист (5 мин)
3. **[docs/architecture.md](architecture.md)** - Архитектура системы (10 мин)

### Нужно что-то исправить?
1. **[QUICK_DEBUGGING_CHECKLIST.md](QUICK_DEBUGGING_CHECKLIST.md)** (5 мин) ← НАЧНИ ОТСЮДА
2. **[ERROR_DIAGNOSIS_METHODOLOGY.md](ERROR_DIAGNOSIS_METHODOLOGY.md)** (15+ мин, если не помогло)
3. **[DEBUGGING_LESSONS_LEARNED.md](DEBUGGING_LESSONS_LEARNED.md)** (для глубокого понимания)

---

## 📋 Все документы по категориям

### 🎯 Статус и Планирование

| Документ | Цель | Частота |
|----------|------|---------|
| [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) | Текущий прогресс фаз | Обновлять на каждой фазе |
| [TODO.md](TODO.md) | Список задач на сегодня | Ежедневно |
| [ROADMAP.md](ROADMAP.md) | План на весь проект | На начало каждой фазы |

### 🤖 Архитектура и Дизайн

| Документ | Цель | Кому нужно |
|----------|------|-----------|
| [docs/architecture.md](architecture.md) | Полная архитектура системы | Backend разработчикам |
| [AI_AGENTS_ARCHITECTURE.md](../AI_AGENTS_ARCHITECTURE.md) | Архитектура multi-agent системы | Для Phase 4 |
| [docs/PHASE_4_ARCHITECTURE.md](PHASE_4_ARCHITECTURE.md) | Детали Phase 4 | При разработке агентов |

### 🔍 Отладка и Диагностика (НОВОЕ!)

| Документ | Размер | Когда использовать |
|----------|--------|-------------------|
| **[QUICK_DEBUGGING_CHECKLIST.md](QUICK_DEBUGGING_CHECKLIST.md)** | 1 страница | 🚨 СЕЙЧАС! (5 мин) |
| **[ERROR_DIAGNOSIS_METHODOLOGY.md](ERROR_DIAGNOSIS_METHODOLOGY.md)** | 4 страницы | Если чек-лист не помог (15 мин) |
| **[DEBUGGING_LESSONS_LEARNED.md](DEBUGGING_LESSONS_LEARNED.md)** | 8 страниц | Обучение и глубокий анализ (1-2 часа) |

### 📖 Полная Документация

| Документ | Описание | Размер |
|----------|---------|--------|
| [README.md](../README.md) | Главный README проекта | - |
| [docs/progress.md](progress.md) | История итераций и прогресс | - |

---

## 🎯 Быстрый выбор по ситуации

### "Pipeline сломалась!"
→ [QUICK_DEBUGGING_CHECKLIST.md](QUICK_DEBUGGING_CHECKLIST.md) (5 мин)

### "Нужно понять где ошибка"
→ [ERROR_DIAGNOSIS_METHODOLOGY.md](ERROR_DIAGNOSIS_METHODOLOGY.md) (15+ мин)

### "Хочу понять как это должно было быть с самого начала"
→ [DEBUGGING_LESSONS_LEARNED.md](DEBUGGING_LESSONS_LEARNED.md) (1-2 часа)

### "Какая статус фазы?"
→ [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)

### "Как устроена вся система?"
→ [docs/architecture.md](architecture.md)

### "Как работают агенты?"
→ [AI_AGENTS_ARCHITECTURE.md](../AI_AGENTS_ARCHITECTURE.md)

### "Что нужно сделать сегодня?"
→ [TODO.md](../TODO.md)

---

## 📚 Документы по фазам

### Phase 1-3 (Завершены ✅)
- [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) - История фаз 1-3

### Phase 4 (Текущая 🚀)
- [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) - Текущий прогресс
- [docs/PHASE_4_ARCHITECTURE.md](PHASE_4_ARCHITECTURE.md) - Детали архитектуры
- [AI_AGENTS_ARCHITECTURE.md](../AI_AGENTS_ARCHITECTURE.md) - Multi-agent система

### Phase 5 (Планируется 📋)
- [ROADMAP.md](../ROADMAP.md) - План на Phase 5

---

## 🔧 Техническая Справка

### Структура функций Edge
```
supabase/functions/
├─ agents/
│  ├─ search-orchestrator/
│  │  ├─ index.ts          (основной код)
│  │  ├─ types.ts          (TypeScript интерфейсы)
│  │  └─ deno.json         (конфиг)
│  ├─ source-hunter/
│  ├─ content-fetcher/
│  └─ document-processor/
```

### Структура БД
**Основные таблицы:**
- `monitoring_profiles` - конфиги для поиска
- `sources` - источники для мониторинга
- `documents` - найденные и обработанные документы
- `search_runs` - история каждого запуска pipeline
- `search_runs_stages` - прогресс каждого агента

**RLS политики:**
- Reference таблицы: `USING (true)` для SELECT
- User таблицы: `auth.uid()` для SELECT
- System таблицы: зависит от назначения

Смотри миграции в `supabase/migrations/` для точных определений.

### Логирование

**Стандартные эмодзи для навигации:**
```
🚀  Start/Begin операции
📌  Configuration/Debug инфо
📥  Input received
📤  Output/Response sent
🔍  Calling external function
📡  Received response
✅  Success milestone
❌  Error occurred
⚠️  Warning/Issue
💾  Database operation
```

---

## 📝 Как использовать эту документацию

### Для новичка
```
1. Прочитай DEVELOPMENT_STATUS.md (что происходит?)
2. Посмотри docs/architecture.md (как устроено?)
3. Смотри конкретный код (как это работает?)
4. Когда нужна помощь → QUICK_DEBUGGING_CHECKLIST.md
```

### Для экспертного поиска проблем
```
1. QUICK_DEBUGGING_CHECKLIST.md (быстрая проверка)
2. ERROR_DIAGNOSIS_METHODOLOGY.md (систематический поиск)
3. DEBUGGING_LESSONS_LEARNED.md (понимание что произошло)
```

### Для разработки нового функционала
```
1. DEVELOPMENT_STATUS.md (текущая фаза)
2. TODO.md (что конкретно делать)
3. ROADMAP.md (как это вписывается в общий план)
4. docs/PHASE_4_ARCHITECTURE.md (дизайн решения)
5. Код в supabase/functions/agents/
```

---

## 🔄 Документооборот

### Обновляется после каждого...

| События | Документ |
|---------|----------|
| Завершена фаза | DEVELOPMENT_STATUS.md |
| Найдена ошибка | DEBUGGING_LESSONS_LEARNED.md |
| Новая задача | TODO.md |
| Архитектурное решение | docs/PHASE_N_ARCHITECTURE.md |

---

## 🎓 Учебные материалы

### Для понимания Supabase
- Edge Functions: `supabase/functions/agents/*/index.ts`
- RLS Policies: `supabase/migrations/004_rls_policies.sql`
- REST API: `supabase/migrations/` + `docs/architecture.md`

### Для понимания Multi-Agent Pattern
- [AI_AGENTS_ARCHITECTURE.md](../AI_AGENTS_ARCHITECTURE.md)
- `supabase/functions/agents/*/index.ts` (каждый агент)
- `docs/PHASE_4_ARCHITECTURE.md`

### Для понимания RLS
- `supabase/migrations/004_rls_policies.sql` (основное)
- `supabase/migrations/022-025_fix_rls_*.sql` (примеры исправлений)
- [ERROR_DIAGNOSIS_METHODOLOGY.md](ERROR_DIAGNOSIS_METHODOLOGY.md) раздел 4.4

---

## 📊 Документация по объему

```
Малые (5-10 мин):
  • QUICK_DEBUGGING_CHECKLIST.md
  • TODO.md
  • ROADMAP.md (быстрый обзор)

Средние (15-30 мин):
  • DEVELOPMENT_STATUS.md
  • ERROR_DIAGNOSIS_METHODOLOGY.md
  • docs/PHASE_4_ARCHITECTURE.md

Большие (45-120 мин):
  • DEBUGGING_LESSONS_LEARNED.md
  • docs/architecture.md
  • AI_AGENTS_ARCHITECTURE.md
```

---

## 🆘 Когда обратиться к документации

| Вопрос | Документ |
|--------|----------|
| "Что делать когда pipeline не работает?" | QUICK_DEBUGGING_CHECKLIST.md |
| "Где ошибка в какой-то функции?" | ERROR_DIAGNOSIS_METHODOLOGY.md |
| "Как я должен был это делать с самого начала?" | DEBUGGING_LESSONS_LEARNED.md |
| "Какая текущая версия проекта?" | DEVELOPMENT_STATUS.md |
| "Как устроена архитектура?" | docs/architecture.md |
| "Что нужно сделать сегодня?" | TODO.md |
| "Куда мы идем?" | ROADMAP.md |
| "Как работают агенты?" | AI_AGENTS_ARCHITECTURE.md |

---

**Индекс документации**
Версия: 1.0.0
Дата: 2025-12-14

*Обновляй этот индекс когда добавляешь новые документы!*
