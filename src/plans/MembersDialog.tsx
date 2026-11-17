import { useEffect, useRef, useState } from 'react'
import type { Db } from '../data/db.ts'
import { paths, shareableUrl } from '../routing/route.ts'
import type { Member } from './usePlanMembers.ts'

interface Props {
  db: Db
  planId: string
  planName: string
  members: Member[]
  myUserId: string
  open: boolean
  onClose: () => void
  /** After leaving or deleting the plan. */
  onLeft: () => void
}

/**
 * Members, invites and leaving. Built on the native <dialog> element:
 * showModal() gives focus trapping, Escape to close and a backdrop for free.
 */
export function MembersDialog({
  db,
  planId,
  planName,
  members,
  myUserId,
  open,
  onClose,
  onLeft,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const me = members.find((m) => m.userId === myUserId)
  const iAmOwner = me?.role === 'owner'
  const otherOwners = members.filter(
    (m) => m.role === 'owner' && m.userId !== myUserId,
  )

  async function createInvite() {
    setBusy(true)
    setError(null)
    const { data, error: inviteError } = await db
      .from('plan_invites')
      .insert({ plan_id: planId })
      .select('token')
      .single()
    setBusy(false)
    if (inviteError) {
      setError("Couldn't create an invite link. Check your connection.")
      return
    }
    setLink(shareableUrl(paths.join(data.token)))
    setCopied(false)
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError('Copying was blocked. Select the link and copy it yourself.')
    }
  }

  async function shareLink() {
    if (!link) return
    try {
      await navigator.share({
        title: `Join ${planName} on Present Planner`,
        url: link,
      })
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  async function removeMember(member: Member) {
    const leaving = member.userId === myUserId
    const question = leaving
      ? `Leave ${planName}? You'll need a new invite to come back.`
      : `Remove ${member.displayName} from ${planName}?`
    if (!confirm(question)) return
    setBusy(true)
    const { error: removeError } = await db
      .from('plan_members')
      .delete()
      .eq('plan_id', planId)
      .eq('user_id', member.userId)
    setBusy(false)
    if (removeError) {
      setError("Couldn't make that change. Check your connection.")
      return
    }
    if (leaving) onLeft()
  }

  async function deletePlan() {
    if (
      !confirm(
        `Delete ${planName} for everyone? All its people and gifts are removed. This can't be undone.`,
      )
    )
      return
    setBusy(true)
    const { error: deleteError } = await db
      .from('plans')
      .delete()
      .eq('id', planId)
    setBusy(false)
    if (deleteError) {
      setError("Couldn't delete the plan. Check your connection.")
      return
    }
    onLeft()
  }

  return (
    <dialog ref={dialog} className="sheet" onClose={onClose}>
      <div className="sheet-head">
        <h2>Members of {planName}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <ul className="members">
        {members.map((member) => (
          <li key={member.userId}>
            <span className="member-name">
              {member.displayName}
              {member.userId === myUserId && (
                <span className="muted"> (you)</span>
              )}
            </span>
            {member.role === 'owner' && <span className="badge">Owner</span>}
            {iAmOwner && member.userId !== myUserId && (
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => void removeMember(member)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <section className="stack invite">
        <h3>Invite someone</h3>
        <p className="muted small">
          Anyone with the link can join this plan for the next 14 days. Send it
          only to people you'd share your gift list with.
        </p>
        {link ? (
          <>
            <input
              id="invite-link"
              className="invite-link"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Invite link"
            />
            <div className="row">
              <button type="button" onClick={() => void copyLink()}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {'share' in navigator && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void shareLink()}
                >
                  Share…
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void createInvite()}
          >
            Create invite link
          </button>
        )}
      </section>

      <section className="stack danger-zone">
        {me && (!iAmOwner || otherOwners.length > 0) && (
          <button
            type="button"
            className="ghost danger"
            disabled={busy}
            onClick={() => void removeMember(me)}
          >
            Leave this plan
          </button>
        )}
        {iAmOwner && (
          <button
            type="button"
            className="ghost danger"
            disabled={busy}
            onClick={() => void deletePlan()}
          >
            Delete this plan for everyone
          </button>
        )}
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  )
}
