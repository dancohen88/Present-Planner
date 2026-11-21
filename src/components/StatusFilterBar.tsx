import { GIFT_STATUSES } from '../domain/planner.ts'
import type { GiftStatus, PlannerState } from '../domain/planner.ts'
import { SHOW_ALL, matchesPurchaser } from './giftFilter.ts'
import type { PurchaserFilter, StatusFilter } from './giftFilter.ts'

const STATUS_FILTER_LABELS: Record<GiftStatus, string> = {
  idea: 'To buy',
  bought: 'Bought',
  wrapped: 'Wrapped',
  given: 'Given',
}

interface Props {
  state: PlannerState
  /** The buyer filter, so each count says what clicking that chip would show. */
  purchaser: PurchaserFilter
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
}

export function StatusFilterBar({
  state,
  purchaser,
  status,
  onStatusChange,
}: Props) {
  // "Faceted" counts: each chip counts gifts that pass the *other* filters, so
  // the number is exactly what you'll see after clicking it.
  const counts = new Map<GiftStatus, number>()
  for (const gift of state.gifts) {
    if (matchesPurchaser(gift, purchaser)) {
      counts.set(gift.status, (counts.get(gift.status) ?? 0) + 1)
    }
  }

  return (
    <section className="status-filter" aria-label="Filter by status">
      <h2 className="eyebrow">Status</h2>
      <div className="chips">
        {GIFT_STATUSES.map((value) => {
          const active = status === value
          const count = counts.get(value) ?? 0
          return (
            <span key={value} className={active ? 'chip active' : 'chip'}>
              <button
                type="button"
                className="chip-main"
                aria-pressed={active}
                // Clicking the active chip again turns the filter off.
                onClick={() => onStatusChange(active ? SHOW_ALL : value)}
              >
                <span className={`dot status-dot-${value}`} />
                <span className="chip-name">{STATUS_FILTER_LABELS[value]}</span>
                <span className="chip-count">{count}</span>
              </button>
            </span>
          )
        })}
      </div>
    </section>
  )
}
