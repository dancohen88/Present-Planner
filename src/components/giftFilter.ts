import type { Gift, GiftStatus, PlannerState } from '../domain/planner.ts'

// Filters are view state, not planner data: they live in the view, are never
// saved, and reopening the app always shows everything. They are kept as plain
// functions here (no React) so the rules can be tested on their own.

/** 'all', 'unassigned', or a purchaser id. */
export type PurchaserFilter = string
export const SHOW_ALL = 'all'
export const UNASSIGNED = 'unassigned'

export type StatusFilter = GiftStatus | typeof SHOW_ALL

/** Every filter at once. A gift is shown only if it passes all of them. */
export interface GiftFilter {
  purchaser: PurchaserFilter
  status: StatusFilter
}

export const NO_FILTER: GiftFilter = { purchaser: SHOW_ALL, status: SHOW_ALL }

export function isFiltering(filter: GiftFilter): boolean {
  return filter.purchaser !== SHOW_ALL || filter.status !== SHOW_ALL
}

export function matchesPurchaser(gift: Gift, purchaser: PurchaserFilter) {
  if (purchaser === SHOW_ALL) return true
  if (purchaser === UNASSIGNED) return gift.purchaserId === null
  return gift.purchaserId === purchaser
}

export function matchesFilter(gift: Gift, filter: GiftFilter): boolean {
  return (
    matchesPurchaser(gift, filter.purchaser) &&
    (filter.status === SHOW_ALL || gift.status === filter.status)
  )
}

/**
 * The plan as the filter sees it: only matching gifts, and, while filtering,
 * only the people who still have something to show.
 */
export function filterPlan(
  state: PlannerState,
  filter: GiftFilter,
): PlannerState {
  if (!isFiltering(filter)) return state
  const gifts = state.gifts.filter((gift) => matchesFilter(gift, filter))
  const shownPeople = new Set(gifts.map((gift) => gift.personId))
  return {
    ...state,
    people: state.people.filter((person) => shownPeople.has(person.id)),
    gifts,
  }
}
