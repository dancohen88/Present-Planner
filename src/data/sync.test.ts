import { describe, expect, it } from 'vitest'
import type { Gift, PlannerState } from '../domain/planner.ts'
import { syncReducer } from './sync.ts'

const gift = (overrides: Partial<Gift> & Pick<Gift, 'id'>): Gift => ({
  personId: 'p1',
  title: 'Book',
  pricePence: 1000,
  status: 'idea',
  purchaserId: null,
  ...overrides,
})

const base: PlannerState = {
  people: [{ id: 'p1', name: 'Mum', budgetPence: null, memberUserId: null }],
  purchasers: [{ id: 'b1', name: 'Jo', slot: 1, userId: null }],
  gifts: [gift({ id: 'g1', purchaserId: 'b1' }), gift({ id: 'g2' })],
}

describe('syncReducer', () => {
  it('replaces a known row in place and appends a new one', () => {
    const updated = syncReducer(base, {
      type: 'remoteUpserted',
      table: 'gifts',
      row: gift({ id: 'g1', status: 'bought', purchaserId: 'b1' }),
    })
    const added = syncReducer(updated, {
      type: 'remoteUpserted',
      table: 'gifts',
      row: gift({ id: 'g3' }),
    })
    expect(added.gifts.map((g) => [g.id, g.status])).toEqual([
      ['g1', 'bought'],
      ['g2', 'idea'],
      ['g3', 'idea'],
    ])
  })

  it('treats an echo of our own change as a no-op', () => {
    const echoed = syncReducer(base, {
      type: 'remoteUpserted',
      table: 'gifts',
      row: gift({ id: 'g2' }),
    })
    // Same object back: React skips the re-render.
    expect(echoed.gifts).toBe(base.gifts)
  })

  it('removes a deleted person together with their gifts', () => {
    const next = syncReducer(base, {
      type: 'remoteDeleted',
      table: 'people',
      id: 'p1',
    })
    expect(next.people).toEqual([])
    expect(next.gifts).toEqual([])
  })

  it('unassigns gifts when their buyer is deleted remotely', () => {
    const next = syncReducer(base, {
      type: 'remoteDeleted',
      table: 'purchasers',
      id: 'b1',
    })
    expect(next.gifts.map((g) => g.purchaserId)).toEqual([null, null])
  })

  it('ignores deletes of rows from other plans', () => {
    const next = syncReducer(base, {
      type: 'remoteDeleted',
      table: 'gifts',
      id: 'not-ours',
    })
    expect(next.gifts).toEqual(base.gifts)
  })

  it('swaps in a freshly loaded plan', () => {
    const fresh: PlannerState = { people: [], purchasers: [], gifts: [] }
    expect(syncReducer(base, { type: 'replaced', state: fresh })).toBe(fresh)
  })

  it('still applies ordinary planner actions', () => {
    const next = syncReducer(base, { type: 'giftRemoved', giftId: 'g1' })
    expect(next.gifts.map((g) => g.id)).toEqual(['g2'])
  })
})
