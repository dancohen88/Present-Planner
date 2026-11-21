import { describe, expect, it } from 'vitest'
import type { Gift, PlannerState } from '../domain/planner.ts'
import {
  NO_FILTER,
  SHOW_ALL,
  UNASSIGNED,
  filterPlan,
  matchesFilter,
} from './giftFilter.ts'
import type { GiftFilter } from './giftFilter.ts'

const gift = (overrides: Partial<Gift>): Gift => ({
  id: 'g',
  personId: 'mum',
  title: 'Gift',
  pricePence: null,
  status: 'idea',
  purchaserId: null,
  ...overrides,
})

describe('matchesFilter', () => {
  const boughtByDan = gift({ status: 'bought', purchaserId: 'dan' })

  it('matches everything when no filter is on', () => {
    expect(matchesFilter(boughtByDan, NO_FILTER)).toBe(true)
  })

  it('needs every filter to match, not just one', () => {
    expect(matchesFilter(boughtByDan, { purchaser: 'dan', status: 'bought' }))
      .toBe(true)
    expect(matchesFilter(boughtByDan, { purchaser: 'dan', status: 'idea' }))
      .toBe(false)
    expect(matchesFilter(boughtByDan, { purchaser: 'jo', status: 'bought' }))
      .toBe(false)
  })

  it('treats "unassigned" as gifts with no buyer', () => {
    const filter: GiftFilter = { purchaser: UNASSIGNED, status: SHOW_ALL }
    expect(matchesFilter(gift({}), filter)).toBe(true)
    expect(matchesFilter(boughtByDan, filter)).toBe(false)
  })
})

describe('filterPlan', () => {
  const state: PlannerState = {
    people: [
      { id: 'mum', name: 'Mum', budgetPence: null, memberUserId: null },
      { id: 'gran', name: 'Gran', budgetPence: null, memberUserId: null },
    ],
    purchasers: [],
    gifts: [
      gift({ id: 'a', personId: 'mum', status: 'given' }),
      gift({ id: 'b', personId: 'gran', status: 'idea' }),
    ],
  }

  it('keeps only matching gifts and the people who still have some', () => {
    const shown = filterPlan(state, { purchaser: SHOW_ALL, status: 'given' })
    expect(shown.gifts.map((g) => g.id)).toEqual(['a'])
    expect(shown.people.map((p) => p.name)).toEqual(['Mum'])
  })

  it('keeps people with no gifts when nothing is filtered', () => {
    const withNewPerson = {
      ...state,
      people: [
        ...state.people,
        { id: 'tom', name: 'Tom', budgetPence: null, memberUserId: null },
      ],
    }
    expect(filterPlan(withNewPerson, NO_FILTER).people).toHaveLength(3)
  })
})
