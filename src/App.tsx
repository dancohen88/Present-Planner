import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { SignIn } from './auth/SignIn.tsx'
import { useSession } from './auth/useSession.ts'
import { supabase } from './data/supabase.ts'
import type { Db } from './data/supabase.ts'
import { CreatePlan } from './plans/CreatePlan.tsx'
import { PlanScreen } from './plans/PlanScreen.tsx'
import { usePlans } from './plans/usePlans.ts'
import { forgetPlans, loadLastPlanId, saveLastPlanId } from './storage.ts'

function App() {
  if (!supabase) return <NotConfigured />
  return <SignedInGate db={supabase} />
}

function SignedInGate({ db }: { db: Db }) {
  const session = useSession(db)
  if (session === undefined) return <Loading />
  if (session === null) return <SignIn db={db} />
  // Keyed by user, so signing in as someone else starts from scratch.
  return <PlanGate key={session.user.id} db={db} session={session} />
}

/** "dan.cohen@…" → "Dan" */
function nameFromEmail(email: string | undefined): string {
  const first = (email ?? '').split('@')[0].split(/[._+-]/)[0]
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : ''
}

function PlanGate({ db, session }: { db: Db; session: Session }) {
  const { result, reload } = usePlans(db)
  const [chosenId, setChosenId] = useState<string | null>(loadLastPlanId)

  async function signOut() {
    forgetPlans()
    // 'local' ends the session on this device only, and works offline.
    await db.auth.signOut({ scope: 'local' })
  }

  if (result.status === 'loading') return <Loading />

  // Offline at start-up: open the last plan from its cached copy.
  const plans =
    result.status === 'ready'
      ? result.plans
      : chosenId
        ? [{ id: chosenId, name: 'Your plan' }]
        : []

  if (plans.length === 0) {
    if (result.status === 'offline') return <OfflineNoCache onRetry={reload} />
    return (
      <CreatePlan
        db={db}
        suggestedName={nameFromEmail(session.user.email)}
        onCreated={(id) => {
          saveLastPlanId(id)
          setChosenId(id)
          void reload()
        }}
      />
    )
  }

  const plan = plans.find((p) => p.id === chosenId) ?? plans[0]
  if (plan.id !== chosenId) saveLastPlanId(plan.id)

  return (
    <PlanScreen
      // A new key throws away the old plan's state and live channel.
      key={plan.id}
      db={db}
      planId={plan.id}
      fallbackName={plan.name}
      email={session.user.email}
      onSignOut={() => void signOut()}
    />
  )
}

function Loading() {
  return (
    <main className="gate">
      <p className="muted" role="status">
        Loading…
      </p>
    </main>
  )
}

function OfflineNoCache({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="gate">
      <div className="gate-card stack">
        <h1>You're offline</h1>
        <p className="muted">
          Your plans haven't been saved on this device yet. Connect once and
          they'll be available offline after that.
        </p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    </main>
  )
}

function NotConfigured() {
  return (
    <main className="gate">
      <div className="gate-card stack">
        <h1>Not connected to a database</h1>
        <p className="muted">
          This build has no Supabase settings. For local development, start the
          database with <code>npm run db:start</code>, then run{' '}
          <code>npm run db:env</code> and restart the dev server.
        </p>
      </div>
    </main>
  )
}

export default App
