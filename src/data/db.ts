import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

/**
 * A Supabase client typed with this app's schema. Lives apart from
 * supabase.ts (which reads the browser build settings) so code that also
 * runs in Node, like fetchPlan in the database tests, can use the type.
 */
export type Db = SupabaseClient<Database>
