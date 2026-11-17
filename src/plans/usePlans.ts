import { useCallback, useEffect, useState } from 'react'
import type { Db } from '../data/db.ts'

export interface PlanSummary {
  id: string
  name: string
}

export type PlansResult =
  | { status: 'loading' }
  | { status: 'ready'; plans: PlanSummary[] }
  /** Couldn't reach the server: the caller falls back to cached plans. */
  | { status: 'offline' }

/** The plans the signed-in user belongs to, oldest first. */
export function usePlans(db: Db) {
  const [result, setResult] = useState<PlansResult>({ status: 'loading' })
  // Bumping this number re-runs the effect, which is how reload() works.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    // Ignore an answer that arrives after a newer request or an unmount.
    let current = true
    // Row-level security already limits this to the user's own plans.
    void db
      .from('plans')
      .select('id, name')
      .order('created_at')
      .then(({ data, error }) => {
        if (!current) return
        setResult(
          error ? { status: 'offline' } : { status: 'ready', plans: data },
        )
      })
    return () => {
      current = false
    }
  }, [db, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { result, reload }
}
