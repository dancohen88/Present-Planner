import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Db } from '../data/supabase.ts'

interface Props {
  db: Db
  /** Pre-fills "Your name", e.g. from the email address. */
  suggestedName: string
  onCreated: (planId: string) => void
}

export function CreatePlan({ db, suggestedName, onCreated }: Props) {
  // A function, so the date is read once on mount rather than every render.
  const [planName, setPlanName] = useState(
    () => `Christmas ${new Date().getFullYear()}`,
  )
  const [displayName, setDisplayName] = useState(suggestedName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    // One call does both steps (create the plan, make you its owner) in a
    // single transaction, so a plan can never exist without an owner.
    const { data, error: createError } = await db.rpc('create_plan', {
      p_name: planName.trim(),
      p_display_name: displayName.trim(),
    })
    setBusy(false)
    if (createError) {
      setError("Couldn't create the plan. Check your connection and try again.")
      return
    }
    onCreated(data)
  }

  return (
    <main className="gate">
      <form className="gate-card stack" onSubmit={create}>
        <p className="brand">
          <span aria-hidden="true">🎁</span> Present Planner
        </p>
        <h1>Start a plan</h1>
        <p className="muted">
          A plan is one occasion, like Christmas or a birthday. You can invite
          family to it once it's made.
        </p>
        <label className="field">
          <span>Plan name</span>
          <input
            id="plan-name"
            value={planName}
            maxLength={80}
            onChange={(e) => setPlanName(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Your name, as others in the plan will see it</span>
          <input
            id="display-name"
            value={displayName}
            maxLength={60}
            autoComplete="given-name"
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create plan'}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
