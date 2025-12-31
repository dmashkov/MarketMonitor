# Async Job Queue - 401 Authorization Problem

## Проблема
Edge Functions требуют JWT authorization на уровне Gateway.
PostgreSQL HTTP вызовы (pg_net, http extension) получают 401 "Invalid JWT".

## Попытки (все не сработали)
1. ❌ pg_cron → job-processor Edge Function (401)
2. ❌ Добавили apikey header (401)
3. ❌ Использовали http extension синхронный (401)
4. ❌ SQL функция → Source Hunter напрямую (401)

## Root Cause
Supabase Edge Gateway не принимает вызовы от PostgreSQL extensions.
Service role key работает из frontend но не из PostgreSQL.

## Возможные решения

### ❌ Не работают:
- pg_cron + Edge Functions
- PostgreSQL HTTP → Edge Functions

### ✅ Могут сработать:
1. **Database Webhooks** (через Supabase Dashboard)
2. **Simplify:** Убрать async queue, вызывать напрямую из frontend
3. **External scheduler:** GitHub Actions, AWS EventBridge

## Рекомендация для MVP
**Вернуться к работающей версии:**
- Frontend → Orchestrator → Source Hunter
- Работает, создало 27 документов
- Ограничение: 1 сегмент за раз (timeout protection)

**Для production:**
- GitHub Actions cron (раз в час/день)
- Или Database Webhooks если Supabase поддерживает

## Время потрачено
~2 часа на отладку async queue
