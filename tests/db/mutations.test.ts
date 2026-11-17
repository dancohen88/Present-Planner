// The app shows the result of running an action through plannerReducer
// before the database confirms it. That's only safe if the database, given
// the same action, ends up in the same state. This test checks exactly that.
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { runMutation, toMutation } from '../../src/data/mutations.ts'
import { fetchPlan } from '../../src/data/fetchPlan.ts'
import { plannerReducer } from '../../src/domain/planner.ts'
import type { PlannerAction, PlannerState } from '../../src/domain/planner.ts'
import { newUser } from './local.ts'
import type { TestUser } from './local.ts'

async function loadPlan(user: TestUser, planId: string): Promise<PlannerState> {
  const plan = await fetchPlan(user.db, planId)
  if (!plan) throw new Error('Plan not visible')
  return plan.state
}

describe('reducer and database agree', () => {
  let dan: TestUser
  let jo: TestUser
  let planId: string
  // A new plan isn't empty: its creator is already one of the buyers.
  let initial: PlannerState

  beforeAll(async () => {
    dan = await newUser('Dan')
    const { data, error } = await dan.db.rpc('create_plan', {
      p_name: 'Christmas 2026',
      p_display_name: 'Dan',
    })
    if (error) throw error
    planId = data
    // Jo joins, so a card can be linked to Jo's account.
    jo = await newUser('Jo')
    const { data: link } = await dan.db
      .from('plan_invites')
      .insert({ plan_id: planId })
      .select('token')
      .single()
    await jo.db.rpc('join_plan', { p_token: link!.token, p_display_name: 'Jo' })
    initial = await loadPlan(dan, planId)
  })

  it('ends in the same state after every kind of action', async () => {
    const mum = randomUUID()
    const alex = randomUUID()
    const danBuyer = randomUUID()
    const joBuyer = randomUUID()
    const gloves = randomUUID()
    const cookbook = randomUUID()
    const headphones = randomUUID()

    const actions: PlannerAction[] = [
      {
        type: 'personAdded',
        person: { id: mum, name: 'Mum', budgetPence: 6000, memberUserId: null },
      },
      {
        type: 'personAdded',
        person: {
          id: alex,
          name: 'Alex',
          budgetPence: null,
          memberUserId: null,
        },
      },
      {
        type: 'purchaserAdded',
        purchaser: { id: danBuyer, name: 'Dad', slot: 2, userId: null },
      },
      {
        type: 'purchaserAdded',
        purchaser: { id: joBuyer, name: 'Grandma', slot: 3, userId: null },
      },
      {
        type: 'giftAdded',
        gift: {
          id: gloves,
          personId: mum,
          title: 'Gardening gloves',
          pricePence: 1499,
          status: 'idea',
          purchaserId: null,
        },
      },
      {
        type: 'giftAdded',
        gift: {
          id: cookbook,
          personId: mum,
          title: 'Cookbook',
          pricePence: null,
          status: 'idea',
          purchaserId: joBuyer,
        },
      },
      {
        type: 'giftAdded',
        gift: {
          id: headphones,
          personId: alex,
          title: 'Headphones',
          pricePence: 4500,
          status: 'idea',
          purchaserId: joBuyer,
        },
      },
      { type: 'giftStatusChanged', giftId: gloves, status: 'wrapped' },
      { type: 'giftPurchaserSet', giftId: gloves, purchaserId: danBuyer },
      { type: 'budgetSet', personId: alex, budgetPence: 4000 },
      { type: 'budgetSet', personId: mum, budgetPence: null },
      // Alex is Jo: hidden from Jo, still visible to Dan.
      { type: 'personMemberLinked', personId: alex, memberUserId: jo.id },
      { type: 'personMemberLinked', personId: alex, memberUserId: null },
      { type: 'personMemberLinked', personId: mum, memberUserId: jo.id },
      // Grandma's gifts become unassigned on both sides.
      { type: 'purchaserRemoved', purchaserId: joBuyer },
      // Alex's headphones go with Alex on both sides.
      { type: 'personRemoved', personId: alex },
      { type: 'giftRemoved', giftId: cookbook },
    ]

    expect(initial.purchasers).toEqual([
      expect.objectContaining({ name: 'Dan', slot: 0, userId: dan.id }),
      expect.objectContaining({ name: 'Jo', slot: 1, userId: jo.id }),
    ])
    let expected = initial
    for (const action of actions) {
      expected = plannerReducer(expected, action)
      await runMutation(dan.db, toMutation(action, planId))
    }

    expect(await loadPlan(dan, planId)).toEqual(expected)
    // Jo can't see Mum's card or gifts now it's linked to Jo.
    const joView = await loadPlan(jo, planId)
    expect(joView.people).toEqual([])
    expect(joView.gifts).toEqual([])
    // A sanity check that the sequence did something.
    expect(expected.gifts).toHaveLength(1)
    expect(expected.gifts[0]).toMatchObject({
      status: 'wrapped',
      purchaserId: danBuyer,
    })
  })

  it('surfaces a refused write as an error the app can act on', async () => {
    const outsider = await newUser('Outsider')
    const write = runMutation(
      outsider.db,
      toMutation(
        {
          type: 'personAdded',
          person: {
            id: randomUUID(),
            name: 'Intruder',
            budgetPence: null,
            memberUserId: null,
          },
        },
        planId,
      ),
    )
    await expect(write).rejects.toMatchObject({
      name: 'MutationError',
      code: '42501',
    })
  })
})
