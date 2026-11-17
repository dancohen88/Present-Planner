import { useState } from 'react'
import type { Dispatch, FormEvent } from 'react'
import {
  giftsBoughtBy,
  nextPurchaserSlot,
  totalsFor,
} from '../domain/planner.ts'
import type { PlannerAction, PlannerState } from '../domain/planner.ts'

/** 'all', 'unassigned', or a purchaser id. */
export type PurchaserFilter = string
export const SHOW_ALL = 'all'
export const UNASSIGNED = 'unassigned'

interface Props {
  state: PlannerState
  filter: PurchaserFilter
  onFilterChange: (filter: PurchaserFilter) => void
  dispatch: Dispatch<PlannerAction>
  /** Offline: filtering still works, adding and removing buyers doesn't. */
  readOnly: boolean
}

function workload(ideaCount: number, giftCount: number): string {
  if (giftCount === 0) return 'nothing yet'
  if (ideaCount === 0) return 'all bought'
  return `${ideaCount} to buy`
}

export function PurchaserBar({
  state,
  filter,
  onFilterChange,
  dispatch,
  readOnly,
}: Props) {
  const [name, setName] = useState('')

  function addPurchaser(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    dispatch({
      type: 'purchaserAdded',
      purchaser: {
        id: crypto.randomUUID(),
        name: trimmed,
        slot: nextPurchaserSlot(state.purchasers),
        userId: null,
      },
    })
    setName('')
  }

  function removePurchaser(id: string, purchaserName: string, count: number) {
    const warning =
      count > 0
        ? `Remove ${purchaserName}? Their ${count} gift(s) will become unassigned.`
        : `Remove ${purchaserName}?`
    if (!confirm(warning)) return
    if (filter === id) onFilterChange(SHOW_ALL)
    dispatch({ type: 'purchaserRemoved', purchaserId: id })
  }

  // Clicking the active chip again turns the filter off.
  function toggle(target: PurchaserFilter) {
    onFilterChange(filter === target ? SHOW_ALL : target)
  }

  const unassigned = totalsFor(giftsBoughtBy(state, null))

  return (
    <section className="purchasers" aria-label="Who's buying">
      <h2 className="eyebrow">Who's buying</h2>
      <div className="chips">
        {state.purchasers.map((purchaser) => {
          const totals = totalsFor(giftsBoughtBy(state, purchaser.id))
          return (
            <span
              key={purchaser.id}
              className={filter === purchaser.id ? 'chip active' : 'chip'}
            >
              <button
                type="button"
                className="chip-main"
                aria-pressed={filter === purchaser.id}
                onClick={() => toggle(purchaser.id)}
              >
                <span className={`dot slot-${purchaser.slot}`} />
                <span className="chip-name">{purchaser.name}</span>
                <span className="chip-count">
                  {workload(totals.ideaCount, totals.giftCount)}
                </span>
              </button>
              <button
                type="button"
                className="chip-remove"
                disabled={readOnly}
                aria-label={`Remove ${purchaser.name}`}
                onClick={() =>
                  removePurchaser(
                    purchaser.id,
                    purchaser.name,
                    totals.giftCount,
                  )
                }
              >
                ×
              </button>
            </span>
          )
        })}

        {state.purchasers.length > 0 && unassigned.ideaCount > 0 && (
          <span className={filter === UNASSIGNED ? 'chip active' : 'chip'}>
            <button
              type="button"
              className="chip-main"
              aria-pressed={filter === UNASSIGNED}
              onClick={() => toggle(UNASSIGNED)}
            >
              <span className="dot dot-empty" />
              <span className="chip-name">Unassigned</span>
              <span className="chip-count">{unassigned.ideaCount} to buy</span>
            </button>
          </span>
        )}

        <form className="chip-add" onSubmit={addPurchaser}>
          <fieldset className="edit-area chip-add-fields" disabled={readOnly}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                state.purchasers.length === 0
                  ? 'Add a buyer, e.g. you'
                  : 'Add a buyer'
              }
              aria-label="Name of someone doing the buying"
            />
            <button type="submit" className="secondary">
              Add
            </button>
          </fieldset>
        </form>
      </div>
    </section>
  )
}
