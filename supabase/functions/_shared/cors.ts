/**
 * Shared CORS Configuration для всех Edge Functions
 *
 * ВАЖНО (2024-2025):
 * - Supabase УБРАЛ настройки CORS из Dashboard
 * - CORS headers ОБЯЗАТЕЛЬНЫ в коде каждой функции
 * - OPTIONS запрос ВСЕГДА должен обрабатываться ПЕРВЫМ
 *
 * Документация: https://supabase.com/docs/guides/functions/cors
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
