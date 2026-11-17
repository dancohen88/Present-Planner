import { useState } from 'react'
import { PlannerView } from '../components/PlannerView.tsx'
import type { Db } from '../data/db.ts'
import { importLegacy } from '../data/importLegacy.ts'
import { usePlannerSync } from '../data/usePlannerSync.ts'
import type { SyncStatus } from '../data/usePlannerSync.ts'
import { clearLegacyState, loadLegacyState } from '../storage.ts'
import { MembersDialog } from './MembersDialog.tsx'
import type { PlanSummary } from './usePlans.ts'
import { usePlanMembers } from './usePlanMembers.ts'

interface Props {
  db: Db
  planId: string
  plans: PlanSummary[]
  myUserId: string
  email: string | undefined
  onSwitchPlan: (planId: string) => void
  onNewPlan: () => void
  /** After leaving or deleting this plan. */
  onLeftPlan: () => void
  onSignOut: () => void
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  syncing: 'Syncing',
  live: 'Live',
  offline: 'Offline',
  gone: 'Unavailable',
}

const NEW_PLAN = '__new__'

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
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
  plans,
  myUserId,
  email,
  onSwitchPlan,
  onNewPlan,
  onLeftPlan,
  onSignOut,
}: Props) {
  const sync = usePlannerSync(db, planId)
  const { state, dispatch, status, syncedAt, error, dismissError } = sync
  const { members } = usePlanMembers(db, planId)
  const [membersOpen, setMembersOpen] = useState(false)
  // The pre-accounts list saved on this device, offered for import once.
  const [legacy, setLegacy] = useState(loadLegacyState)
  const [importing, setImporting] = useState(false)

  const planName =
    sync.planName ?? plans.find((p) => p.id === planId)?.name ?? 'Your plan'

  async function importOldList() {
    if (!legacy) return
    setImporting(true)
    const actions = importLegacy(legacy, state, () => crypto.randomUUID())
    const ok = await sync.dispatchAll(actions)
    setImporting(false)
    if (ok) {
      clearLegacyState()
      setLegacy(null)
    }
  }

  function discardOldList() {
    if (
      !confirm("Discard the list saved on this device? This can't be undone.")
    )
      return
    clearLegacyState()
    setLegacy(null)
  }

  return (
    <main>
      <header className="top-bar">
        <div className="top-bar-title">
          <p className="brand">
            <span aria-hidden="true">🎁</span> Present Planner
          </p>
          {/* The plan name doubles as the plan switcher. It stays inside
              the page's h1, so screen readers still find a main heading. */}
          <h1>
            <label className="plan-switch">
              <span className="visually-hidden">Plan</span>
              <select
                value={planId}
                onChange={(e) =>
                  e.target.value === NEW_PLAN
                    ? onNewPlan()
                    : onSwitchPlan(e.target.value)
                }
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.id === planId ? planName : plan.name}
                  </option>
                ))}
                <option value={NEW_PLAN}>+ New plan…</option>
              </select>
            </label>
          </h1>
        </div>
        <div className="top-bar-actions">
          <span className={`sync-pill sync-${status}`} role="status">
            <span className="sync-dot" aria-hidden="true" />
            {STATUS_LABEL[status]}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setMembersOpen(true)}
          >
            Members{members.length > 0 ? ` · ${members.length}` : ''}
          </button>
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
        <div className="banner banner-error" role="alert">
          <span>
            This plan is no longer available to you. It may have been deleted,
            or you were removed from it.
          </span>
          <button type="button" className="ghost" onClick={onLeftPlan}>
            Go to my plans
          </button>
        </div>
      )}
      {error && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="ghost" onClick={dismissError}>
            Dismiss
          </button>
        </div>
      )}
      {legacy && status === 'live' && (
        <div className="banner banner-import" role="status">
          <span>
            This device has a list from before accounts:{' '}
            {count(legacy.people.length, 'person', 'people')} and{' '}
            {count(legacy.gifts.length, 'gift', 'gifts')}. Import it into{' '}
            {planName}?
          </span>
          <span className="row">
            <button
              type="button"
              disabled={importing}
              onClick={() => void importOldList()}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={importing}
              onClick={discardOldList}
            >
              Discard
            </button>
          </span>
        </div>
      )}

      <PlannerView
        state={state}
        dispatch={dispatch}
        readOnly={status === 'offline' || status === 'gone'}
        members={members}
        myUserId={myUserId}
      />

      <MembersDialog
        db={db}
        planId={planId}
        planName={planName}
        members={members}
        myUserId={myUserId}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        onLeft={() => {
          setMembersOpen(false)
          onLeftPlan()
        }}
      />
    </main>
  )
}
