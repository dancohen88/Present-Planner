import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import { formatPence, parsePounds } from '../domain/money.ts'
import { GIFT_STATUSES, totalsFor } from '../domain/planner.ts'
import type {
  Gift,
  GiftStatus,
  Person,
  PlannerAction,
  Purchaser,
} from '../domain/planner.ts'
import type { Member } from '../plans/usePlanMembers.ts'
import { BudgetMeter } from './BudgetMeter.tsx'

interface Props {
  person: Person
  /** Every gift for this person; totals are always worked out from these. */
  gifts: Gift[]
  /** The gifts to list, which is fewer than `gifts` when a filter is on. */
  visibleGifts: Gift[]
  purchasers: Purchaser[]
  /** Who a newly added gift is allocated to. */
  defaultPurchaserId: string | null
  /** Plan members, offered when saying whose account this person is. */
  members: Member[]
  myUserId: string
  dispatch: Dispatch<PlannerAction>
}

const STATUS_LABELS: Record<GiftStatus, string> = {
  idea: 'Idea',
  bought: 'Bought',
  wrapped: 'Wrapped',
  given: 'Given ✓',
}

function poundsText(pence: number | null): string {
  return pence === null ? '' : (pence / 100).toFixed(2)
}

export function PersonCard({
  person,
  gifts,
  visibleGifts,
  purchasers,
  defaultPurchaserId,
  members,
  myUserId,
  dispatch,
}: Props) {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [priceInvalid, setPriceInvalid] = useState(false)

  const { spentPence, plannedPence, ideaCount } = totalsFor(gifts)
  const budget = person.budgetPence
  const overBy = budget !== null ? spentPence - budget : 0
  const allSorted = gifts.length > 0 && ideaCount === 0
  const hiddenCount = gifts.length - visibleGifts.length
  // You can't link a card to yourself: you'd lose sight of it, and the
  // database refuses it anyway.
  const linkable = members.filter((m) => m.userId !== myUserId)
  const linkedMember = members.find((m) => m.userId === person.memberUserId)

  function addGift(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    const pricePence = price.trim() === '' ? null : parsePounds(price)
    if (price.trim() !== '' && pricePence === null) {
      setPriceInvalid(true)
      return
    }
    dispatch({
      type: 'giftAdded',
      gift: {
        id: crypto.randomUUID(),
        personId: person.id,
        title: trimmed,
        pricePence,
        status: 'idea',
        purchaserId: defaultPurchaserId,
      },
    })
    setTitle('')
    setPrice('')
    setPriceInvalid(false)
  }

  function removePerson() {
    const warning =
      gifts.length > 0
        ? `Remove ${person.name} and their ${gifts.length} gift(s)?`
        : `Remove ${person.name}?`
    if (confirm(warning)) {
      dispatch({ type: 'personRemoved', personId: person.id })
    }
  }

  return (
    <article className={allSorted ? 'card sorted' : 'card'}>
      <header className="card-header">
        <span className="avatar" aria-hidden="true">
          {person.name.charAt(0).toUpperCase()}
        </span>
        <div className="card-title">
          <h2>{person.name}</h2>
          <div className="badges">
            {allSorted && <span className="badge">✓ All sorted</span>}
            {linkedMember && (
              <span
                className="badge badge-hidden"
                title={`${linkedMember.displayName} can't see this card or its gifts`}
              >
                🔒 Hidden from {linkedMember.displayName}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="ghost"
          onClick={removePerson}
          aria-label={`Remove ${person.name}`}
        >
          Remove
        </button>
      </header>

      {linkable.length > 0 && (
        <label className="link-field">
          <span>Uses the app as</span>
          <select
            className="pill"
            value={person.memberUserId ?? ''}
            onChange={(event) =>
              dispatch({
                type: 'personMemberLinked',
                personId: person.id,
                memberUserId: event.target.value || null,
              })
            }
          >
            <option value="">Not in this plan</option>
            {linkable.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName} (hide their gifts from them)
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="budget">
        <p className="spend">
          <strong>{formatPence(spentPence)}</strong> spent
          {plannedPence > 0 && <> · {formatPence(plannedPence)} in ideas</>}
        </p>
        <label className="budget-field">
          <span>Budget</span>
          {/* Uncontrolled input: the DOM holds the draft text and we only read
              it on blur, so a half-typed amount never reaches the reducer. */}
          <input
            className="price"
            defaultValue={poundsText(budget)}
            placeholder="£"
            inputMode="decimal"
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            onBlur={(event) => {
              const input = event.currentTarget
              const text = input.value.trim()
              const budgetPence = text === '' ? null : parsePounds(text)
              if (text !== '' && budgetPence === null) {
                // Not a valid amount: put the last saved budget back.
                input.value = poundsText(budget)
                return
              }
              if (budgetPence !== budget) {
                dispatch({
                  type: 'budgetSet',
                  personId: person.id,
                  budgetPence,
                })
              }
            }}
          />
        </label>
        {budget !== null && budget > 0 && (
          <BudgetMeter
            spentPence={spentPence}
            plannedPence={plannedPence}
            budgetPence={budget}
            label={`${person.name}'s budget`}
          />
        )}
        {overBy > 0 && (
          <p className="over-note">⚠ {formatPence(overBy)} over budget</p>
        )}
      </div>

      {gifts.length === 0 ? (
        <p className="muted">No gift ideas yet.</p>
      ) : (
        <ul className="gifts">
          {visibleGifts.map((gift) => {
            const purchaser = purchasers.find((p) => p.id === gift.purchaserId)
            return (
              <li key={gift.id} className={`gift status-${gift.status}`}>
                <div className="gift-main">
                  <span className="gift-title">{gift.title}</span>
                  <span className="gift-price">
                    {gift.pricePence === null
                      ? '—'
                      : formatPence(gift.pricePence)}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    aria-label={`Remove ${gift.title}`}
                    onClick={() =>
                      dispatch({ type: 'giftRemoved', giftId: gift.id })
                    }
                  >
                    ×
                  </button>
                </div>
                <div className="gift-meta">
                  <select
                    className="pill status-pill"
                    value={gift.status}
                    aria-label={`Status of ${gift.title}`}
                    onChange={(event) =>
                      dispatch({
                        type: 'giftStatusChanged',
                        giftId: gift.id,
                        status: event.target.value as GiftStatus,
                      })
                    }
                  >
                    {GIFT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  {purchasers.length > 0 && (
                    <span className="buyer">
                      <span
                        className={
                          purchaser
                            ? `dot slot-${purchaser.slot}`
                            : 'dot dot-empty'
                        }
                      />
                      <select
                        className="pill"
                        value={gift.purchaserId ?? ''}
                        aria-label={`Who is buying ${gift.title}`}
                        onChange={(event) =>
                          dispatch({
                            type: 'giftPurchaserSet',
                            giftId: gift.id,
                            purchaserId: event.target.value || null,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {purchasers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {hiddenCount > 0 && (
        <p className="muted small">
          {hiddenCount} more gift{hiddenCount === 1 ? '' : 's'} hidden by the
          filter.
        </p>
      )}

      <form className="row" onSubmit={addGift}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Gift idea"
          aria-label={`Gift idea for ${person.name}`}
        />
        <input
          className="price"
          value={price}
          onChange={(event) => {
            setPrice(event.target.value)
            setPriceInvalid(false)
          }}
          placeholder="£"
          inputMode="decimal"
          aria-label="Price in pounds"
          aria-invalid={priceInvalid}
        />
        <button type="submit">Add</button>
      </form>
      {priceInvalid && (
        <p className="error">Enter the price as pounds, like 12.50.</p>
      )}
    </article>
  )
}
