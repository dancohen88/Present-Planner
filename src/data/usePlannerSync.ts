import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { emptyState, nextPurchaserSlot } from '../domain/planner.ts'
import type { PlannerAction } from '../domain/planner.ts'
import { loadSnapshot, saveSnapshot } from '../storage.ts'
import { fetchPlan } from './fetchPlan.ts'
import { MutationError, runMutation, toMutation } from './mutations.ts'
import { giftFromRow, personFromRow, purchaserFromRow } from './rows.ts'
import type { GiftRow, PersonRow, PurchaserRow } from './rows.ts'
import type { Db } from './db.ts'
import { syncReducer } from './sync.ts'
import type { RemoteRow } from './sync.ts'

export type SyncStatus =
  /** Loading or catching up; the cached copy is on screen meanwhile. */
  | 'syncing'
  /** Connected: edits save and other people's changes stream in. */
  | 'live'
  /** No connection: read-only, showing the copy from `syncedAt`. */
  | 'offline'
  /** The plan was deleted or this user was removed from it. */
  | 'gone'

const TABLES = ['people', 'purchasers', 'gifts'] as const
type Table = (typeof TABLES)[number]

function remoteRow(table: Table, row: Record<string, unknown>): RemoteRow {
  switch (table) {
    case 'people':
      return { table, row: personFromRow(row as PersonRow) }
    case 'purchasers':
      return { table, row: purchaserFromRow(row as PurchaserRow) }
    case 'gifts':
      return { table, row: giftFromRow(row as GiftRow) }
  }
}

function describeError(error: unknown): string {
  if (error instanceof MutationError && error.code === '42501') {
    return "You don't have permission to change that any more. Your change was undone."
  }
  if (error instanceof TypeError) {
    return "Couldn't reach the server, so your change was undone. Check your connection."
  }
  return "Couldn't save that change, so it was undone. Try again."
}

/**
 * Keeps one plan in sync with the database. The parent renders this behind
 * `key={planId}`, so switching plans starts a fresh hook rather than
 * carrying state across.
 *
 * Changes are optimistic: dispatch updates the screen at once, then writes
 * to the database; if the write fails, the plan is reloaded, which undoes it.
 */
export function usePlannerSync(db: Db, planId: string) {
  // Start from the offline snapshot so something useful shows instantly,
  // then replace it with the fresh copy ("stale-while-revalidate").
  const [snapshot] = useState(() => loadSnapshot(planId))
  const [state, dispatchLocal] = useReducer(
    syncReducer,
    snapshot?.state ?? emptyState,
  )
  const [status, setStatus] = useState<SyncStatus>(() =>
    navigator.onLine ? 'syncing' : 'offline',
  )
  const [syncedAt, setSyncedAt] = useState<string | null>(
    snapshot?.syncedAt ?? null,
  )
  const [planName, setPlanName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs hold values that callbacks need to read at the moment they run,
  // without re-creating the callbacks (and the live channel) on every change.
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  const channelReady = useRef(false)
  const pendingWrites = useRef(0)
  const refetchAfterWrites = useRef(false)

  const markSynced = useCallback(
    () => setSyncedAt(new Date().toISOString()),
    [],
  )

  /** Reloads the whole plan. Resolves true if it succeeded. */
  const refetch = useCallback(async (): Promise<boolean> => {
    try {
      const fresh = await fetchPlan(db, planId)
      if (!fresh) {
        setStatus('gone')
        return false
      }
      if (pendingWrites.current > 0) {
        // A write is still in flight. Replacing state now would briefly hide
        // it, so wait and reload once the writes finish.
        refetchAfterWrites.current = true
      } else {
        dispatchLocal({ type: 'replaced', state: fresh.state })
      }
      setPlanName(fresh.name)
      markSynced()
      setStatus(channelReady.current && navigator.onLine ? 'live' : 'syncing')
      return true
    } catch {
      setStatus('offline')
      return false
    }
  }, [db, planId, markSynced])

  // The live channel: other members' changes arrive here.
  useEffect(() => {
    let active = true
    // A unique topic per effect run: React's development mode mounts
    // effects twice, and two channels must not share a name.
    const channel = db.channel(`plan:${planId}:${crypto.randomUUID()}`)

    for (const table of TABLES) {
      const onRow = (row: Record<string, unknown>) => {
        try {
          dispatchLocal({ type: 'remoteUpserted', ...remoteRow(table, row) })
          markSynced()
        } catch {
          // A row the app can't read (e.g. from a newer version): reload.
          void refetch()
        }
      }
      const filter = `plan_id=eq.${planId}`
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table, filter },
          (payload) => onRow(payload.new),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table, filter },
          (payload) => onRow(payload.new),
        )
        // Delete events can't be filtered by column, so every delete the
        // database lets us know about arrives; unknown ids are ignored.
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table },
          (payload) => {
            const id = (payload.old as { id?: string }).id
            if (id) dispatchLocal({ type: 'remoteDeleted', table, id })
          },
        )
    }

    channel.subscribe((channelStatus) => {
      if (!active) return
      if (channelStatus === 'SUBSCRIBED') {
        channelReady.current = true
        // Changes made while we weren't subscribed are never replayed, so
        // reload everything each time the channel (re)connects.
        void refetch()
      } else {
        channelReady.current = false
        if (statusRef.current !== 'gone') setStatus('offline')
      }
    })

    return () => {
      active = false
      channelReady.current = false
      void db.removeChannel(channel)
    }
  }, [db, planId, refetch, markSynced])

  // Phones drop connections when locked or in a tunnel. Catch up when the
  // app comes back to the foreground or the connection returns.
  useEffect(() => {
    const catchUp = () => {
      if (statusRef.current === 'gone') return
      setStatus('syncing')
      void refetch()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') catchUp()
    }
    const onOffline = () => setStatus('offline')
    window.addEventListener('online', catchUp)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', catchUp)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refetch])

  // Keep the offline copy current.
  useEffect(() => {
    if (syncedAt) saveSnapshot(planId, { state, syncedAt })
  }, [planId, state, syncedAt])

  const send = useCallback(
    async (action: PlannerAction): Promise<boolean> => {
      pendingWrites.current += 1
      try {
        // At most two attempts; see the colour clash below.
        let current = action
        for (let attempt = 1; ; attempt++) {
          dispatchLocal(current)
          try {
            await runMutation(db, toMutation(current, planId))
            markSynced()
            return true
          } catch (err) {
            // Two people added a buyer at the same moment and got the same
            // colour. Reload, then try once more with the next free colour.
            const colourClash =
              current.type === 'purchaserAdded' &&
              err instanceof MutationError &&
              err.code === '23505'
            const fresh =
              colourClash && attempt === 1
                ? await fetchPlan(db, planId).catch(() => null)
                : null
            if (fresh && current.type === 'purchaserAdded') {
              dispatchLocal({ type: 'replaced', state: fresh.state })
              const slot = nextPurchaserSlot(fresh.state.purchasers)
              current = {
                ...current,
                purchaser: { ...current.purchaser, slot },
              }
              continue
            }
            setError(describeError(err))
            refetchAfterWrites.current = true
            return false
          }
        }
      } finally {
        pendingWrites.current -= 1
        if (pendingWrites.current === 0 && refetchAfterWrites.current) {
          refetchAfterWrites.current = false
          void refetch()
        }
      }
    },
    [db, planId, markSynced, refetch],
  )

  /**
   * Applies several actions one after another, each waiting for the
   * previous write, for changes that depend on each other (a gift needs its
   * person to exist first). Stops at the first failure.
   */
  const dispatchAll = useCallback(
    async (actions: PlannerAction[]): Promise<boolean> => {
      if (statusRef.current !== 'live') {
        setError('Wait until the plan shows Live, then try again.')
        return false
      }
      for (const action of actions) {
        if (!(await send(action))) return false
      }
      return true
    },
    [send],
  )

  const dispatch = useCallback(
    (action: PlannerAction) => {
      if (statusRef.current === 'offline' || statusRef.current === 'gone') {
        setError("You're offline. Changes need a connection.")
        return
      }
      void send(action)
    },
    [send],
  )

  const dismissError = useCallback(() => setError(null), [])

  return {
    state,
    dispatch,
    dispatchAll,
    status,
    syncedAt,
    planName,
    error,
    dismissError,
  }
}
