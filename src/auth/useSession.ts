import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Db } from '../data/supabase.ts'

/**
 * The signed-in session: undefined while it's being read, null when signed
 * out. supabase-js keeps the session in localStorage and refreshes it, so
 * this also works when the app is opened offline.
 */
export function useSession(db: Db): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    void db.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    // Only set state in here: calling other Supabase methods inside this
    // callback can deadlock the client.
    const { data } = db.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [db])

  return session
}
