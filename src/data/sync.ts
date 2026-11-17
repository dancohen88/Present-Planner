// State changes that come from the database rather than from this user's
// taps, layered on top of the domain reducer.
import { plannerReducer } from '../domain/planner.ts'
import type {
  Gift,
  Person,
  PlannerAction,
  PlannerState,
  Purchaser,
} from '../domain/planner.ts'

export type RemoteRow =
  | { table: 'people'; row: Person }
  | { table: 'purchasers'; row: Purchaser }
  | { table: 'gifts'; row: Gift }

export type SyncAction =
  | PlannerAction
  /** A fresh copy of the whole plan from the database. */
  | { type: 'replaced'; state: PlannerState }
  /** A row someone inserted or updated. */
  | ({ type: 'remoteUpserted' } & RemoteRow)
  /** A row someone deleted. */
  | {
      type: 'remoteDeleted'
      table: 'people' | 'purchasers' | 'gifts'
      id: string
    }

/**
 * Remote changes are idempotent: applying one twice gives the same state as
 * applying it once. That matters because this user's own writes come back
 * through the live channel too, after they've already been applied locally.
 */
export function syncReducer(
  state: PlannerState,
  action: SyncAction,
): PlannerState {
  switch (action.type) {
    case 'replaced':
      return action.state
    case 'remoteUpserted':
      switch (action.table) {
        case 'people':
          return { ...state, people: upsert(state.people, action.row) }
        case 'purchasers':
          return { ...state, purchasers: upsert(state.purchasers, action.row) }
        case 'gifts':
          return { ...state, gifts: upsert(state.gifts, action.row) }
      }
      break
    case 'remoteDeleted':
      // Reuse the domain's own removals so their side effects match: a
      // removed person takes their gifts, a removed buyer unassigns theirs.
      // An id this plan doesn't have (deletes from other plans arrive too)
      // changes nothing.
      switch (action.table) {
        case 'people':
          return plannerReducer(state, {
            type: 'personRemoved',
            personId: action.id,
          })
        case 'purchasers':
          return plannerReducer(state, {
            type: 'purchaserRemoved',
            purchaserId: action.id,
          })
        case 'gifts':
          return plannerReducer(state, {
            type: 'giftRemoved',
            giftId: action.id,
          })
      }
      break
    default:
      return plannerReducer(state, action)
  }
  return state
}

/** Replaces the item with the same id in place, or adds it at the end. */
function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id)
  if (index === -1) return [...items, item]
  if (shallowEqual(items[index], item)) return items
  return items.map((existing, i) => (i === index ? item : existing))
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[]
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  )
}
