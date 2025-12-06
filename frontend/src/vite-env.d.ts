/// <reference types="vite/client" />

/**
 * TypeScript типизация для Vite Environment Variables
 * https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript
 */

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // OpenAI
  readonly VITE_OPENAI_API_KEY?: string;

  // Application
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production' | 'preview';
  readonly VITE_API_TIMEOUT?: string;

  // Feature Flags
  readonly VITE_ENABLE_ANALYTICS?: string;
  readonly VITE_ENABLE_SENTRY?: string;

  // Debug
  readonly VITE_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
