/// <reference types="vite/client" />

declare module 'virtual:mednow-theme.css';

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEMO_CITY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
