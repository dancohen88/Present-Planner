import { describe, expect, it } from 'vitest'
import { plannerReducer } from '../domain/planner.ts'
import type { PlannerState } from '../domain/planner.ts'
import { importLegacy } from './importLegacy.ts'

// Saved before accounts: one person, two buyers, two gifts.
const legacy: PlannerState = {
  people: [
    { id: 'old-p1', name: 'Mum', budgetPence: 6000, memberUserId: null },
  ],
  purchasers: [
    { id: 'old-b1', name: 'dan', slot: 0, userId: null },
    { id: 'old-b2', name: 'Grandma', slot: 1, userId: null },
  ],
  gifts: [
    {
      id: 'old-g1',
      personId: 'old-p1',
      title: 'Scarf',
      pricePence: 3500,
      status: 'bought',
      purchaserId: 'old-b1',
    },
    {
      id: 'old-g2',
      personId: 'old-p1',
      title: 'Mug',
      pricePence: null,
      status: 'idea',
      purchaserId: 'old-b2',
    },
  ],
}

// The shared plan already has Dan (a member) in colour 0 and Jo in colour 1.
const plan: PlannerState = {
  people: [],
  purchasers: [
    { id: 'dan', name: 'Dan', slot: 0, userId: 'u-dan' },
    { id: 'jo', name: 'Jo', slot: 1, userId: 'u-jo' },
  ],
  gifts: [],
}

function counter() {
  let n = 0
  return () => `new-${++n}`
}

describe('importLegacy', () => {
  const actions = importLegacy(legacy, plan, counter())
  const result = actions.reduce(plannerReducer, plan)

  it('gives everything fresh ids', () => {
    const ids = [...result.people, ...result.gifts].map((x) => x.id)
    expect(ids.every((id) => id.startsWith('new-'))).toBe(true)
  })

  it('merges a buyer with the same name into the existing one', () => {
    const scarf = result.gifts.find((g) => g.title === 'Scarf')
    expect(scarf?.purchaserId).toBe('dan')
    expect(
      result.purchasers.filter((p) => p.name.toLowerCase() === 'dan'),
    ).toHaveLength(1)
  })

  it('adds other buyers in the next free colour', () => {
    const grandma = result.purchasers.find((p) => p.name === 'Grandma')
    expect(grandma).toMatchObject({ slot: 2, userId: null })
    const mug = result.gifts.find((g) => g.title === 'Mug')
    expect(mug?.purchaserId).toBe(grandma?.id)
  })

  it('keeps gifts attached to their person, with status and price', () => {
    const mum = result.people.find((p) => p.name === 'Mum')
    expect(result.gifts).toEqual([
      expect.objectContaining({
        title: 'Scarf',
        personId: mum?.id,
        status: 'bought',
        pricePence: 3500,
      }),
      expect.objectContaining({
        title: 'Mug',
        personId: mum?.id,
        status: 'idea',
        pricePence: null,
      }),
    ])
  })

  it('writes people and buyers before the gifts that refer to them', () => {
    const firstGift = actions.findIndex((a) => a.type === 'giftAdded')
    const lastOther = actions.findLastIndex((a) => a.type !== 'giftAdded')
    expect(lastOther).toBeLessThan(firstGift)
  })
})
