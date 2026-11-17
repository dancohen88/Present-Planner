import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Db } from '../data/db.ts'
import { isUuid } from '../routing/route.ts'

interface Props {
  db: Db
  token: string
  suggestedName: string
  onJoined: (planId: string) => void
  onCancel: () => void
}

type Invite =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'ready'; planName: string; invitedBy: string }

export function JoinPlan({
  db,
  token,
  suggestedName,
  onJoined,
  onCancel,
}: Props) {
  const [invite, setInvite] = useState<Invite>(() =>
    isUuid(token) ? { status: 'loading' } : { status: 'invalid' },
  )
  const [displayName, setDisplayName] = useState(suggestedName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isUuid(token)) return
    let current = true
    // invite_details only answers for a valid, unexpired token, so this
    // reveals nothing about plans to someone guessing.
    void db.rpc('invite_details', { p_token: token }).then(({ data }) => {
      if (!current) return
      const row = data?.[0]
      setInvite(
        row
          ? {
              status: 'ready',
              planName: row.plan_name,
              invitedBy: row.invited_by,
            }
          : { status: 'invalid' },
      )
    })
    return () => {
      current = false
    }
  }, [db, token])

  async function join(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: joinError } = await db.rpc('join_plan', {
      p_token: token,
      p_display_name: displayName.trim(),
    })
    setBusy(false)
    if (joinError) {
      setError(
        joinError.code === 'P0002'
          ? 'This invite has expired. Ask for a new link.'
          : "Couldn't join. Check your connection and try again.",
      )
      return
    }
    onJoined(data)
  }

  return (
    <main className="gate">
      <div className="gate-card stack">
        <p className="brand">
          <span aria-hidden="true">🎁</span> Present Planner
        </p>
        {invite.status === 'loading' && (
          <p className="muted" role="status">
            Checking the invite…
          </p>
        )}
        {invite.status === 'invalid' && (
          <>
            <h1>Invite not found</h1>
            <p className="muted">
              This invite link has expired, been revoked, or was copied
              incompletely. Ask whoever sent it for a new one.
            </p>
            <button type="button" onClick={onCancel}>
              Go to my plans
            </button>
          </>
        )}
        {invite.status === 'ready' && (
          <form className="stack" onSubmit={join}>
            <h1>Join {invite.planName}</h1>
            <p className="muted">
              {invite.invitedBy} invited you to plan gifts together. You'll see
              each other's ideas and who's buying what, but never the gifts
              planned for you.
            </p>
            <label className="field">
              <span>Your name, as others in the plan will see it</span>
              <input
                id="join-display-name"
                value={displayName}
                maxLength={60}
                autoComplete="given-name"
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Joining…' : `Join ${invite.planName}`}
            </button>
            <button type="button" className="link" onClick={onCancel}>
              Not now
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
