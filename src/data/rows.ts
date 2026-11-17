// Translates between database rows (snake_case, one table each) and the
// domain types the rest of the app uses. Rows come from outside the app, so
// this is the boundary where they get checked: "parse, don't validate".
import { GIFT_STATUSES } from '../domain/planner.ts'
import type {
  Gift,
  GiftStatus,
  Person,
  PlannerState,
  Purchaser,
} from '../domain/planner.ts'
import type { Tables, TablesInsert } from './database.types.ts'

export type PersonRow = Tables<'people'>
export type PurchaserRow = Tables<'purchasers'>
export type GiftRow = Tables<'gifts'>

export function parseStatus(value: string): GiftStatus {
  const status = GIFT_STATUSES.find((s) => s === value)
  if (!status) throw new Error(`Unknown gift status from database: ${value}`)
  return status
}

export function personFromRow(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    budgetPence: row.budget_pence,
    memberUserId: row.member_user_id,
  }
}

export function personToRow(
  person: Person,
  planId: string,
): TablesInsert<'people'> {
  return {
    id: person.id,
    plan_id: planId,
    name: person.name,
    budget_pence: person.budgetPence,
    member_user_id: person.memberUserId,
  }
}

export function purchaserFromRow(row: PurchaserRow): Purchaser {
  return {
    id: row.id,
    name: row.name,
    slot: row.slot,
    userId: row.user_id,
  }
}

export function purchaserToRow(
  purchaser: Purchaser,
  planId: string,
): TablesInsert<'purchasers'> {
  return {
    id: purchaser.id,
    plan_id: planId,
    name: purchaser.name,
    slot: purchaser.slot,
    user_id: purchaser.userId,
  }
}

export function giftFromRow(row: GiftRow): Gift {
  return {
    id: row.id,
    personId: row.person_id,
    title: row.title,
    pricePence: row.price_pence,
    status: parseStatus(row.status),
    purchaserId: row.purchaser_id,
  }
}

export function giftToRow(gift: Gift, planId: string): TablesInsert<'gifts'> {
  return {
    id: gift.id,
    plan_id: planId,
    person_id: gift.personId,
    title: gift.title,
    price_pence: gift.pricePence,
    status: gift.status,
    purchaser_id: gift.purchaserId,
  }
}

/**
 * Builds planner state from the three tables. Rows are sorted by creation
 * time so every member sees cards and gifts in the same order.
 */
export function stateFromRows(rows: {
  people: PersonRow[]
  purchasers: PurchaserRow[]
  gifts: GiftRow[]
}): PlannerState {
  return {
    people: byCreation(rows.people).map(personFromRow),
    purchasers: byCreation(rows.purchasers).map(purchaserFromRow),
    gifts: byCreation(rows.gifts).map(giftFromRow),
  }
}

function byCreation<T extends { created_at: string; id: string }>(
  rows: T[],
): T[] {
  // The id breaks ties, so rows created in the same instant still come out
  // in the same order for everyone.
  return [...rows].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )
}
