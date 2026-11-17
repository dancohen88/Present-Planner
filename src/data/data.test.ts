import { describe, expect, it } from 'vitest'
import type { Gift, PlannerAction } from '../domain/planner.ts'
import { toMutation } from './mutations.ts'
import {
  giftFromRow,
  giftToRow,
  parseStatus,
  personFromRow,
  personToRow,
  purchaserFromRow,
  purchaserToRow,
  stateFromRows,
} from './rows.ts'
import type { GiftRow, PersonRow, PurchaserRow } from './rows.ts'

const PLAN = 'plan-1'
const created = '2026-11-17T12:00:00Z'

const person = { id: 'p1', name: 'Mum', budgetPence: 6000, memberUserId: null }
const purchaser = { id: 'b1', name: 'Dan', slot: 0, userId: 'u1' }
const gift: Gift = {
  id: 'g1',
  personId: 'p1',
  title: 'Cookbook',
  pricePence: 2200,
  status: 'bought',
  purchaserId: 'b1',
}

function personRow(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    ...personToRow(person, PLAN),
    created_at: created,
    ...overrides,
  } as PersonRow
}
function purchaserRow(overrides: Partial<PurchaserRow> = {}): PurchaserRow {
  return {
    ...purchaserToRow(purchaser, PLAN),
    created_at: created,
    ...overrides,
  } as PurchaserRow
}
function giftRow(overrides: Partial<GiftRow> = {}): GiftRow {
  return {
    ...giftToRow(gift, PLAN),
    created_at: created,
    updated_at: created,
    updated_by: null,
    ...overrides,
  } as GiftRow
}

describe('rows', () => {
  it('round-trips each type through its database row', () => {
    expect(personFromRow(personRow())).toEqual(person)
    expect(purchaserFromRow(purchaserRow())).toEqual(purchaser)
    expect(giftFromRow(giftRow())).toEqual(gift)
  })

  it('puts every row in the plan it is written to', () => {
    expect(personToRow(person, PLAN).plan_id).toBe(PLAN)
    expect(purchaserToRow(purchaser, PLAN).plan_id).toBe(PLAN)
    expect(giftToRow(gift, PLAN).plan_id).toBe(PLAN)
  })

  it('rejects a status the app does not know', () => {
    expect(parseStatus('wrapped')).toBe('wrapped')
    expect(() => parseStatus('lost')).toThrow(/Unknown gift status/)
  })

  it('orders rows by creation time, then id, so every member sees the same order', () => {
    const state = stateFromRows({
      people: [
        personRow({ id: 'late', created_at: '2026-11-17T13:00:00Z' }),
        personRow({ id: 'b-tie' }),
        personRow({ id: 'a-tie' }),
      ],
      purchasers: [],
      gifts: [],
    })
    expect(state.people.map((p) => p.id)).toEqual(['a-tie', 'b-tie', 'late'])
  })
})

describe('toMutation', () => {
  const cases: [PlannerAction, ReturnType<typeof toMutation>][] = [
    [
      { type: 'personAdded', person },
      { table: 'people', op: 'insert', values: personToRow(person, PLAN) },
    ],
    [
      { type: 'personRemoved', personId: 'p1' },
      { table: 'people', op: 'delete', id: 'p1' },
    ],
    [
      { type: 'budgetSet', personId: 'p1', budgetPence: null },
      {
        table: 'people',
        op: 'update',
        id: 'p1',
        values: { budget_pence: null },
      },
    ],
    [
      { type: 'personMemberLinked', personId: 'p1', memberUserId: 'u2' },
      {
        table: 'people',
        op: 'update',
        id: 'p1',
        values: { member_user_id: 'u2' },
      },
    ],
    [
      { type: 'purchaserAdded', purchaser },
      {
        table: 'purchasers',
        op: 'insert',
        values: purchaserToRow(purchaser, PLAN),
      },
    ],
    [
      { type: 'purchaserRemoved', purchaserId: 'b1' },
      { table: 'purchasers', op: 'delete', id: 'b1' },
    ],
    [
      { type: 'giftAdded', gift },
      { table: 'gifts', op: 'insert', values: giftToRow(gift, PLAN) },
    ],
    [
      { type: 'giftStatusChanged', giftId: 'g1', status: 'wrapped' },
      { table: 'gifts', op: 'update', id: 'g1', values: { status: 'wrapped' } },
    ],
    [
      { type: 'giftPurchaserSet', giftId: 'g1', purchaserId: null },
      {
        table: 'gifts',
        op: 'update',
        id: 'g1',
        values: { purchaser_id: null },
      },
    ],
    [
      { type: 'giftRemoved', giftId: 'g1' },
      { table: 'gifts', op: 'delete', id: 'g1' },
    ],
  ]

  it.each(cases)('maps %o', (action, expected) => {
    expect(toMutation(action, PLAN)).toEqual(expected)
  })

  it('sends only the changed column on updates', () => {
    const mutation = toMutation(
      { type: 'giftStatusChanged', giftId: 'g1', status: 'given' },
      PLAN,
    )
    expect(mutation.op === 'update' && Object.keys(mutation.values)).toEqual([
      'status',
    ])
  })
})
