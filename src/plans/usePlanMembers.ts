import { useCallback, useEffect, useState } from 'react'
import type { Db } from '../data/db.ts'

export interface Member {
  userId: string
  displayName: string
  role: 'owner' | 'member'
}

/**
 * The members of a plan, kept current as people join or leave.
 *
 * Two signals keep it fresh, because live updates are best-effort: its own
 * subscription to plan_members, and `linkedBuyers`, a key built from the
 * buyers linked to accounts. Joining adds a linked buyer and leaving unlinks
 * one, and buyers arrive over the plan's main channel, so either signal
 * alone is enough to trigger a reload.
 */
export function usePlanMembers(db: Db, planId: string, linkedBuyers: string) {
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
  }, [db, planId, version, linkedBuyers])

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
      // Reload once the change feed is actually running, to pick up anyone
      // who joined while it was starting (see usePlannerSync).
      .on('system', {}, (message: { extension?: string; status?: string }) => {
        if (
          message.extension === 'postgres_changes' &&
          message.status === 'ok'
        ) {
          reload()
        }
      })
      .subscribe()
    return () => {
      void db.removeChannel(channel)
    }
  }, [db, planId, reload])

  return { members, reload }
}
