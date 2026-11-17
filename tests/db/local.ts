// Connects tests to the local Supabase stack started by `npx supabase start`.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/data/database.types.ts'

interface LocalStatus {
  API_URL: string
  PUBLISHABLE_KEY: string
  SECRET_KEY: string
}

function readStatus(): LocalStatus {
  try {
    const json = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(json) as LocalStatus
  } catch {
    throw new Error(
      'The local Supabase stack is not running. Start it with `npx supabase start`.',
    )
  }
}

const status = readStatus()

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

/**
 * Admin client: uses the secret key, which bypasses row-level security.
 * Tests use it only to set up users and situations, never to check access.
 */
export const admin = createClient<Database>(
  status.API_URL,
  status.SECRET_KEY,
  noSession,
)

/** A client with no one signed in, as a visitor to the app would be. */
export function signedOut(): SupabaseClient<Database> {
  return createClient<Database>(
    status.API_URL,
    status.PUBLISHABLE_KEY,
    noSession,
  )
}

export interface TestUser {
  id: string
  name: string
  db: SupabaseClient<Database>
}

/**
 * Creates a real account and returns a client signed in as it, with the same
 * public key the app uses, so every request goes through RLS.
 */
export async function newUser(name: string): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${randomUUID()}@example.test`
  const password = randomUUID()
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (created.error) throw created.error

  const db = createClient<Database>(
    status.API_URL,
    status.PUBLISHABLE_KEY,
    noSession,
  )
  const signedIn = await db.auth.signInWithPassword({ email, password })
  if (signedIn.error) throw signedIn.error

  return { id: created.data.user.id, name, db }
}
