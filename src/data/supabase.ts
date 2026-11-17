import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'
import type { Db } from './db.ts'

export type { Db }

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * The one shared client, or null when the app was built without Supabase
 * settings. The publishable key is meant to be public: what protects the data
 * is the row-level security in supabase/migrations.
 */
export const supabase: Db | null =
  url && key ? createClient<Database>(url, key) : null
