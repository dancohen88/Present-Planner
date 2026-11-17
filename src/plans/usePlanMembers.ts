import { useCallback, useEffect, useState } from 'react'
import type { Db } from '../data/db.ts'

export interface Member {
  userId: string
  displayName: string
  role: 'owner' | 'member'
}

/** The members of a plan, kept current as people join or leave. */
export function usePlanMembers(db: Db, planId: string) {
  const [members, setMembers] = useState<Member[]>([])
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let current = true
    void db
      .from('plan_members')
      .select('user_id, display_name, role')
      .eq('plan_id', planId)
      .order('joined_at')
      .then(({ data }) => {
        if (!current || !data) return
        setMembers(
          data.map((row) => ({
            userId: row.user_id,
            displayName: row.display_name,
            role: row.role === 'owner' ? 'owner' : 'member',
          })),
        )
      })
    return () => {
      current = false
    }
  }, [db, planId, version])

  // Someone joining or leaving shows up without a reload.
  useEffect(() => {
    const channel = db
      .channel(`members:${planId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'plan_members',
          filter: `plan_id=eq.${planId}`,
        },
        reload,
      )
      // Deletes can't be filtered by plan, so any departure triggers a
      // (cheap) reload.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'plan_members' },
        reload,
      )
      .subscribe()
    return () => {
      void db.removeChannel(channel)
    }
  }, [db, planId, reload])

  return { members, reload }
}
