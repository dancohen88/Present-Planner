import type { Session } from '@supabase/supabase-js'
import { SignIn } from './auth/SignIn.tsx'
import { useSession } from './auth/useSession.ts'
import type { Db } from './data/db.ts'
import { supabase } from './data/supabase.ts'
import { CreatePlan } from './plans/CreatePlan.tsx'
import { JoinPlan } from './plans/JoinPlan.tsx'
import { PlanScreen } from './plans/PlanScreen.tsx'
import { usePlans } from './plans/usePlans.ts'
import { paths, useRoute } from './routing/route.ts'
import { forgetPlans, loadLastPlanId, saveLastPlanId } from './storage.ts'

function App() {
  if (!supabase) return <NotConfigured />
  return <SignedInGate db={supabase} />
}

function SignedInGate({ db }: { db: Db }) {
  const session = useSession(db)
  const [route] = useRoute()
  if (session === undefined) return <Loading />
  if (session === null) {
    // The invite token stays in the address bar while they sign in, so the
    // join screen picks it up afterwards.
    return <SignIn db={db} invited={route.name === 'join'} />
  }
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
  const [route, navigate] = useRoute()
  const suggestedName = nameFromEmail(session.user.email)

  async function signOut() {
    forgetPlans()
    // 'local' ends the session on this device only, and works offline.
    await db.auth.signOut({ scope: 'local' })
    navigate(paths.home)
  }

  function openPlan(planId: string) {
    saveLastPlanId(planId)
    navigate(paths.plan(planId))
  }

  if (route.name === 'join') {
    return (
      <JoinPlan
        db={db}
        token={route.token}
        suggestedName={suggestedName}
        onJoined={(planId) => {
          reload()
          openPlan(planId)
        }}
        onCancel={() => navigate(paths.home)}
      />
    )
  }

  if (result.status === 'loading') return <Loading />

  // Offline at start-up: open the last plan from its cached copy.
  const lastPlanId = loadLastPlanId()
  const plans =
    result.status === 'ready'
      ? result.plans
      : lastPlanId
        ? [{ id: lastPlanId, name: 'Your plan' }]
        : []

  if (plans.length === 0 && result.status === 'offline') {
    return <OfflineNoCache onRetry={reload} />
  }

  if (plans.length === 0 || route.name === 'new-plan') {
    return (
      <CreatePlan
        db={db}
        suggestedName={suggestedName}
        onCreated={(planId) => {
          reload()
          openPlan(planId)
        }}
        onCancel={plans.length > 0 ? () => navigate(paths.home) : undefined}
      />
    )
  }

  // The plan in the address, else the last one opened, else the first.
  const wanted = route.name === 'plan' ? route.planId : lastPlanId
  const plan = plans.find((p) => p.id === wanted) ?? plans[0]
  if (plan.id !== lastPlanId) saveLastPlanId(plan.id)

  return (
    <PlanScreen
      // A new key throws away the old plan's state and live channel.
      key={plan.id}
      db={db}
      planId={plan.id}
      plans={plans}
      myUserId={session.user.id}
      email={session.user.email}
      onSwitchPlan={openPlan}
      onNewPlan={() => navigate(paths.newPlan)}
      onLeftPlan={() => {
        reload()
        navigate(paths.home)
      }}
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
