import { describe, expect, it } from 'vitest'
import { formatPence, parsePounds } from './money.ts'
import { normaliseState } from '../storage.ts'
import {
  breakdownByPurchaser,
  emptyState,
  giftsBoughtBy,
  giftsFor,
  nextPurchaserSlot,
  plannerReducer,
  totalsFor,
} from './planner.ts'
import type { Gift, PlannerAction, PlannerState } from './planner.ts'

function run(actions: PlannerAction[], from: PlannerState = emptyState) {
  return actions.reduce(plannerReducer, from)
}

const sam = { id: 'p1', name: 'Sam', budgetPence: 5000, memberUserId: null }
const alex = { id: 'p2', name: 'Alex', budgetPence: null, memberUserId: null }

function gift(overrides: Partial<Gift> & Pick<Gift, 'id'>): Gift {
  return {
    personId: sam.id,
    title: 'Book',
    pricePence: 1000,
    status: 'idea',
    purchaserId: null,
    ...overrides,
  }
}

describe('plannerReducer', () => {
  it('removes a person together with their gifts, leaving others alone', () => {
    const state = run([
      { type: 'personAdded', person: sam },
      { type: 'personAdded', person: alex },
      { type: 'giftAdded', gift: gift({ id: 'g1' }) },
      { type: 'giftAdded', gift: gift({ id: 'g2', personId: alex.id }) },
      { type: 'personRemoved', personId: sam.id },
    ])

    expect(state.people).toEqual([alex])
    expect(state.gifts.map((g) => g.id)).toEqual(['g2'])
  })

  it('changes the status of only the targeted gift', () => {
    const state = run([
      { type: 'giftAdded', gift: gift({ id: 'g1' }) },
      { type: 'giftAdded', gift: gift({ id: 'g2' }) },
      { type: 'giftStatusChanged', giftId: 'g2', status: 'wrapped' },
    ])

    expect(state.gifts.map((g) => g.status)).toEqual(['idea', 'wrapped'])
  })

  it('sets and clears a budget', () => {
    const withBudget = run([
      { type: 'personAdded', person: alex },
      { type: 'budgetSet', personId: alex.id, budgetPence: 2500 },
    ])
    expect(withBudget.people[0].budgetPence).toBe(2500)

    const cleared = run(
      [{ type: 'budgetSet', personId: alex.id, budgetPence: null }],
      withBudget,
    )
    expect(cleared.people[0].budgetPence).toBeNull()
  })

  it('does not mutate the state it is given', () => {
    const before = run([{ type: 'personAdded', person: sam }])
    const snapshot = structuredClone(before)
    run([{ type: 'giftAdded', gift: gift({ id: 'g1' }) }], before)
    expect(before).toEqual(snapshot)
  })
})

describe('purchasers', () => {
  const dan = { id: 'b1', name: 'Dan', slot: 0, userId: null }
  const jo = { id: 'b2', name: 'Jo', slot: 1, userId: null }

  it('allocates a gift to a purchaser and can unassign it again', () => {
    const allocated = run([
      { type: 'purchaserAdded', purchaser: dan },
      { type: 'giftAdded', gift: gift({ id: 'g1' }) },
      { type: 'giftAdded', gift: gift({ id: 'g2' }) },
      { type: 'giftPurchaserSet', giftId: 'g1', purchaserId: dan.id },
    ])
    expect(giftsBoughtBy(allocated, dan.id).map((g) => g.id)).toEqual(['g1'])
    expect(giftsBoughtBy(allocated, null).map((g) => g.id)).toEqual(['g2'])

    const unassigned = run(
      [{ type: 'giftPurchaserSet', giftId: 'g1', purchaserId: null }],
      allocated,
    )
    expect(giftsBoughtBy(unassigned, dan.id)).toEqual([])
  })

  it('keeps a removed purchaser’s gifts but unassigns them', () => {
    const state = run([
      { type: 'purchaserAdded', purchaser: dan },
      { type: 'purchaserAdded', purchaser: jo },
      { type: 'giftAdded', gift: gift({ id: 'g1', purchaserId: dan.id }) },
      { type: 'giftAdded', gift: gift({ id: 'g2', purchaserId: jo.id }) },
      { type: 'purchaserRemoved', purchaserId: dan.id },
    ])

    expect(state.purchasers).toEqual([jo])
    expect(state.gifts.map((g) => g.purchaserId)).toEqual([null, jo.id])
  })

  it('gives each new purchaser the lowest free colour slot', () => {
    expect(nextPurchaserSlot([])).toBe(0)
    expect(nextPurchaserSlot([dan, jo])).toBe(2)
    // Dan (slot 0) was removed: the gap is reused and Jo keeps slot 1.
    expect(nextPurchaserSlot([jo])).toBe(0)
  })

  it('falls back to the overflow slot once every colour is taken', () => {
    const eight = Array.from({ length: 8 }, (_, slot) => ({
      id: `b${slot}`,
      name: `Buyer ${slot}`,
      userId: null,
      slot,
    }))
    expect(nextPurchaserSlot(eight)).toBe(8)
  })
})

describe('normaliseState', () => {
  it('fills in fields missing from data saved by earlier versions', () => {
    const saved = {
      // The shape version 1 saved: no account links, no purchasers.
      people: [{ id: sam.id, name: sam.name, budgetPence: sam.budgetPence }],
      gifts: [
        {
          id: 'g1',
          personId: sam.id,
          title: 'Book',
          pricePence: 1000,
          status: 'idea',
        },
      ],
    }

    const state = normaliseState(saved)

    expect(state?.purchasers).toEqual([])
    expect(state?.gifts[0].purchaserId).toBeNull()
    expect(state?.people).toEqual([sam])
  })

  it.each([null, 'text', 42, {}, { people: [] }])('rejects %j', (value) => {
    expect(normaliseState(value)).toBeNull()
  })
})

describe('breakdownByPurchaser', () => {
  const dan = { id: 'b1', name: 'Dan', slot: 0, userId: null }
  const jo = { id: 'b2', name: 'Jo', slot: 1, userId: null }

  it('totals each person’s gifts by who is buying them', () => {
    const state = run([
      { type: 'personAdded', person: sam },
      { type: 'personAdded', person: alex },
      { type: 'purchaserAdded', purchaser: dan },
      { type: 'purchaserAdded', purchaser: jo },
      {
        type: 'giftAdded',
        gift: gift({
          id: 'g1',
          pricePence: 1000,
          status: 'bought',
          purchaserId: dan.id,
        }),
      },
      {
        type: 'giftAdded',
        gift: gift({
          id: 'g2',
          pricePence: 500,
          status: 'given',
          purchaserId: dan.id,
        }),
      },
      {
        type: 'giftAdded',
        gift: gift({
          id: 'g3',
          pricePence: 2000,
          status: 'idea',
          purchaserId: jo.id,
        }),
      },
      {
        type: 'giftAdded',
        gift: gift({
          id: 'g4',
          personId: alex.id,
          pricePence: 700,
          status: 'bought',
          purchaserId: null,
        }),
      },
    ])

    const breakdown = breakdownByPurchaser(state)

    expect(breakdown.columns).toEqual([dan, jo, null])
    const spent = breakdown.rows.map((row) =>
      row.cells.map((c) => c.spentPence),
    )
    expect(spent).toEqual([
      [1500, 0, 0], // Sam: Dan bought two, Jo's is still an idea
      [0, 0, 700], // Alex: one unassigned
    ])
    expect(breakdown.rows[0].cells[1].plannedPence).toBe(2000)
    expect(breakdown.rows.map((row) => row.total.spentPence)).toEqual([
      1500, 700,
    ])
    expect(breakdown.columnTotals.map((c) => c.spentPence)).toEqual([
      1500, 0, 700,
    ])
    expect(breakdown.grandTotal.spentPence).toBe(2200)
  })

  it('leaves out the unassigned column when every gift has a buyer', () => {
    const state = run([
      { type: 'personAdded', person: sam },
      { type: 'purchaserAdded', purchaser: dan },
      { type: 'giftAdded', gift: gift({ id: 'g1', purchaserId: dan.id }) },
    ])
    expect(breakdownByPurchaser(state).columns).toEqual([dan])
  })

  it('leaves out buyers who have nothing allocated', () => {
    const state = run([
      { type: 'personAdded', person: sam },
      { type: 'purchaserAdded', purchaser: dan },
      { type: 'purchaserAdded', purchaser: jo },
      { type: 'giftAdded', gift: gift({ id: 'g1', purchaserId: jo.id }) },
    ])
    expect(breakdownByPurchaser(state).columns).toEqual([jo])
  })
})

describe('totalsFor', () => {
  it('counts ideas as planned and everything else as spent', () => {
    const totals = totalsFor([
      gift({ id: 'g1', pricePence: 1000, status: 'idea' }),
      gift({ id: 'g2', pricePence: 2050, status: 'bought' }),
      gift({ id: 'g3', pricePence: 300, status: 'given' }),
      gift({ id: 'g4', pricePence: null, status: 'idea' }),
    ])

    expect(totals).toEqual({
      spentPence: 2350,
      plannedPence: 1000,
      ideaCount: 2,
      giftCount: 4,
    })
  })
})

describe('giftsFor', () => {
  it('returns only that person’s gifts', () => {
    const state = run([
      { type: 'giftAdded', gift: gift({ id: 'g1' }) },
      { type: 'giftAdded', gift: gift({ id: 'g2', personId: alex.id }) },
    ])
    expect(giftsFor(state, alex.id).map((g) => g.id)).toEqual(['g2'])
  })
})

describe('money', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['£1,200.99', 120099],
    [' 0.07 ', 7],
    // 19.99 * 100 is 1998.9999999999998 in floating point; parsing the
    // digits separately avoids that.
    ['19.99', 1999],
  ])('parses %s as %i pence', (input, expected) => {
    expect(parsePounds(input)).toBe(expected)
  })

  it.each(['', 'abc', '12.345', '-5', '1.2.3'])('rejects %j', (input) => {
    expect(parsePounds(input)).toBeNull()
  })

  it('formats pence as pounds', () => {
    expect(formatPence(120099)).toBe('£1,200.99')
  })
})
