// Types for the build-time settings Vite reads from .env files. Only
// variables prefixed VITE_ reach the browser, so nothing secret goes here.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
