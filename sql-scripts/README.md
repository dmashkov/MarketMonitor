# SQL Utility Scripts

⚠️ **SECURITY WARNING: This directory is in `.gitignore`!**

**NEVER commit files with:**
- Production secrets or API keys
- Hardcoded JWT tokens
- Service role keys
- Database passwords

Use Supabase Vault for secrets in SQL:
```sql
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
```

---

Полезные SQL скрипты для администрирования и диагностики MarketMonitor.

## 📋 Содержимое

### 👤 User Management

**`add_admin.sql`**
- Добавление администратора в систему
- Устанавливает роль 'admin' для пользователя
- Использование: обнови email в скрипте и выполни в Supabase SQL Editor

### 🔧 System Maintenance

**`fix_stuck_jobs.sql`**
- Очистка застрявших pipeline jobs
- Переводит зависшие jobs в статус 'failed'
- Используй когда: jobs висят в статусе 'pending' или 'processing' слишком долго

**`stop-running-pipelines.sql`**
- Останавливает все запущенные pipeline runs
- Устанавливает статус 'cancelled' для активных runs
- Используй когда: нужно срочно остановить все активные процессы

### 📊 Diagnostics

**`check_sources.sql`**
- Проверка активных источников (sources)
- Показывает: имя, тип, приоритет, активность
- Используй для: проверки настроенных источников перед запуском pipeline

**`verify_setup.sql`**
- Полная проверка настройки системы
- Проверяет:
  - pg_cron job configuration
  - Недавно созданные документы
  - Document-segment links
  - Summary statistics
- Используй после: применения миграций, настройки cron, deploy

## 🚀 Как использовать

1. Открой **Supabase Dashboard** → SQL Editor
2. Скопируй содержимое нужного скрипта
3. Выполни в SQL Editor
4. Проверь результаты

## ⚠️ Важно

- **НЕ** коммить в Git если скрипт содержит sensitive data (emails, IDs)
- Всегда проверяй скрипт перед выполнением на production
- Делай backup перед выполнением деструктивных операций

## 📚 См. также

- `supabase/migrations/` - официальные миграции базы данных
- `LESSONS_LEARNED.md` - типичные проблемы и решения
- `SESSION_CONTEXT.md` - текущий статус проекта
