import { PlannerView } from '../components/PlannerView.tsx'
import { usePlannerSync } from '../data/usePlannerSync.ts'
import type { SyncStatus } from '../data/usePlannerSync.ts'
import type { Db } from '../data/supabase.ts'

interface Props {
  db: Db
  planId: string
  /** Shown until the plan's own name has loaded. */
  fallbackName: string
  email: string | undefined
  onSignOut: () => void
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  syncing: 'Syncing',
  live: 'Live',
  offline: 'Offline',
  gone: 'Unavailable',
}

function timeOf(iso: string): string {
  const date = new Date(iso)
  const sameDay = date.toDateString() === new Date().toDateString()
  return date.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(sameDay ? {} : { day: 'numeric', month: 'short' }),
  })
}

export function PlanScreen({
  db,
  planId,
  fallbackName,
  email,
  onSignOut,
}: Props) {
  const { state, dispatch, status, syncedAt, planName, error, dismissError } =
    usePlannerSync(db, planId)

  return (
    <main>
      <header className="top-bar">
        <div className="top-bar-title">
          <p className="brand">
            <span aria-hidden="true">🎁</span> Present Planner
          </p>
          <h1>{planName ?? fallbackName}</h1>
        </div>
        <div className="top-bar-actions">
          <span className={`sync-pill sync-${status}`} role="status">
            <span className="sync-dot" aria-hidden="true" />
            {STATUS_LABEL[status]}
          </span>
          <button
            type="button"
            className="ghost"
            onClick={onSignOut}
            title={email ? `Signed in as ${email}` : undefined}
          >
            Sign out
          </button>
        </div>
      </header>

      {status === 'offline' && (
        <p className="banner banner-offline" role="status">
          You're offline.{' '}
          {syncedAt
            ? `Showing the list as of ${timeOf(syncedAt)}.`
            : 'Nothing has been saved on this device yet.'}{' '}
          Editing comes back when you reconnect.
        </p>
      )}
      {status === 'gone' && (
        <p className="banner banner-error" role="alert">
          This plan is no longer available to you. It may have been deleted, or
          you were removed from it.
        </p>
      )}
      {error && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="ghost" onClick={dismissError}>
            Dismiss
          </button>
        </div>
      )}

      <PlannerView
        state={state}
        dispatch={dispatch}
        readOnly={status === 'offline' || status === 'gone'}
      />
    </main>
  )
}
