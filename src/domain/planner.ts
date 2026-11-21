// The whole domain lives here as plain data and pure functions: no React, no
// storage. That keeps the rules testable on their own, and it means the list of
// actions below is the complete set of things a future sync backend must handle.

export const GIFT_STATUSES = ['idea', 'bought', 'wrapped', 'given'] as const
export type GiftStatus = (typeof GIFT_STATUSES)[number]

/** Someone a gift is for. */
export interface Person {
  id: string
  name: string
  /** null means no budget has been set. */
  budgetPence: number | null
  /**
   * The account of a plan member this person is, if any. The database hides
   * this person and their gifts from that member, to keep gifts a surprise.
   */
  memberUserId: string | null
}

/** Someone doing the buying. */
export interface Purchaser {
  id: string
  name: string
  /** The account of a plan member this purchaser is, if any. */
  userId: string | null
  /**
   * Which colour this purchaser wears (0 to PURCHASER_SLOTS - 1), or
   * PURCHASER_SLOTS for the neutral overflow colour. It is stored rather than
   * derived from list position so removing one purchaser never repaints the
   * others.
   */
  slot: number
}

export const PURCHASER_SLOTS = 8

export interface Gift {
  id: string
  personId: string
  title: string
  /** null means the price isn't known yet. */
  pricePence: number | null
  status: GiftStatus
  /** null means nobody has been allocated to buy it. */
  purchaserId: string | null
}

export interface PlannerState {
  people: Person[]
  purchasers: Purchaser[]
  gifts: Gift[]
}

export const emptyState: PlannerState = {
  people: [],
  purchasers: [],
  gifts: [],
}

// Actions carry fully formed objects (ids included). Generating an id inside
// the reducer would make it impure, and React calls reducers twice in dev
// (StrictMode) precisely to expose that kind of mistake.
export type PlannerAction =
  | { type: 'personAdded'; person: Person }
  | { type: 'personRemoved'; personId: string }
  | { type: 'budgetSet'; personId: string; budgetPence: number | null }
  /** Says which member's account a person is; null unlinks them. */
  | {
      type: 'personMemberLinked'
      personId: string
      memberUserId: string | null
    }
  | { type: 'purchaserAdded'; purchaser: Purchaser }
  | { type: 'purchaserRemoved'; purchaserId: string }
  | { type: 'giftAdded'; gift: Gift }
  | { type: 'giftStatusChanged'; giftId: string; status: GiftStatus }
  | { type: 'giftPurchaserSet'; giftId: string; purchaserId: string | null }
  | { type: 'giftRemoved'; giftId: string }

export function plannerReducer(
  state: PlannerState,
  action: PlannerAction,
): PlannerState {
  switch (action.type) {
    case 'personAdded':
      return { ...state, people: [...state.people, action.person] }
    case 'personRemoved':
      // Removing a person takes their gifts with them, so no gift is ever
      // left pointing at someone who doesn't exist.
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.personId),
        gifts: state.gifts.filter((g) => g.personId !== action.personId),
      }
    case 'budgetSet':
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.personId
            ? { ...p, budgetPence: action.budgetPence }
            : p,
        ),
      }
    case 'personMemberLinked':
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.personId
            ? { ...p, memberUserId: action.memberUserId }
            : p,
        ),
      }
    case 'purchaserAdded':
      return { ...state, purchasers: [...state.purchasers, action.purchaser] }
    case 'purchaserRemoved':
      // Unlike removing a person, the gifts survive: they go back to
      // unassigned so someone else can pick them up.
      return {
        ...state,
        purchasers: state.purchasers.filter((p) => p.id !== action.purchaserId),
        gifts: state.gifts.map((g) =>
          g.purchaserId === action.purchaserId
            ? { ...g, purchaserId: null }
            : g,
        ),
      }
    case 'giftAdded':
      return { ...state, gifts: [...state.gifts, action.gift] }
    case 'giftStatusChanged':
      return {
        ...state,
        gifts: state.gifts.map((g) =>
          g.id === action.giftId ? { ...g, status: action.status } : g,
        ),
      }
    case 'giftPurchaserSet':
      return {
        ...state,
        gifts: state.gifts.map((g) =>
          g.id === action.giftId
            ? { ...g, purchaserId: action.purchaserId }
            : g,
        ),
      }
    case 'giftRemoved':
      return {
        ...state,
        gifts: state.gifts.filter((g) => g.id !== action.giftId),
      }
  }
}

/**
 * The lowest colour slot nobody is using. Once all are taken, everyone extra
 * shares the neutral overflow slot rather than reusing a colour, because two
 * purchasers in the same colour would be indistinguishable.
 */
export function nextPurchaserSlot(purchasers: Purchaser[]): number {
  const taken = new Set(purchasers.map((p) => p.slot))
  for (let slot = 0; slot < PURCHASER_SLOTS; slot++) {
    if (!taken.has(slot)) return slot
  }
  return PURCHASER_SLOTS
}

export interface Totals {
  /** Money already committed: everything past the idea stage. */
  spentPence: number
  /** Price of ideas not yet bought. */
  plannedPence: number
  ideaCount: number
  giftCount: number
}

export function totalsFor(gifts: Gift[]): Totals {
  const totals: Totals = {
    spentPence: 0,
    plannedPence: 0,
    ideaCount: 0,
    giftCount: gifts.length,
  }
  for (const gift of gifts) {
    const price = gift.pricePence ?? 0
    if (gift.status === 'idea') {
      totals.plannedPence += price
      totals.ideaCount += 1
    } else {
      totals.spentPence += price
    }
  }
  return totals
}

export function giftsFor(state: PlannerState, personId: string): Gift[] {
  return state.gifts.filter((g) => g.personId === personId)
}

/** Gifts allocated to a purchaser; pass null for the unassigned ones. */
export function giftsBoughtBy(
  state: PlannerState,
  purchaserId: string | null,
): Gift[] {
  return state.gifts.filter((g) => g.purchaserId === purchaserId)
}

/**
 * Totals cross-tabulated by person (rows) and purchaser (columns): a
 * "pivot table". cells[r][c] covers the gifts for rows[r].person that
 * columns[c] is buying.
 */
export interface Breakdown {
  /**
   * Every purchaser with at least one gift, in order, then null for unassigned
   * gifts if there are any. Purchasers with nothing would be a column of
   * blanks, which only widens the table.
   */
  columns: (Purchaser | null)[]
  rows: { person: Person; cells: Totals[]; total: Totals }[]
  columnTotals: Totals[]
  grandTotal: Totals
}

export function breakdownByPurchaser(state: PlannerState): Breakdown {
  const buying = new Set(state.gifts.map((g) => g.purchaserId))
  const columns: (Purchaser | null)[] = state.purchasers.filter((p) =>
    buying.has(p.id),
  )
  if (buying.has(null)) columns.push(null)
  const columnIds = columns.map((column) => column?.id ?? null)

  const rows = state.people.map((person) => {
    const gifts = giftsFor(state, person.id)
    return {
      person,
      cells: columnIds.map((id) =>
        totalsFor(gifts.filter((g) => g.purchaserId === id)),
      ),
      total: totalsFor(gifts),
    }
  })

  return {
    columns,
    rows,
    columnTotals: columnIds.map((id) => totalsFor(giftsBoughtBy(state, id))),
    grandTotal: totalsFor(state.gifts),
  }
}
