// Checks the row-level security rules against a real Postgres. Each test
// signs in as real users through the app's public key, so a passing test
// means the rule holds for anyone holding that key, not just for our UI.
import { beforeAll, describe, expect, it } from 'vitest'
import { admin, newUser, signedOut } from './local.ts'
import type { TestUser } from './local.ts'

// Postgres error codes worth naming.
const RLS_DENIED = '42501' // insufficient_privilege: RLS check or column grant
const FOREIGN_KEY = '23503'
const UNIQUE = '23505'

/** Creates a plan as `owner` and returns its id. */
async function createPlan(owner: TestUser, name = 'Christmas 2026') {
  const { data, error } = await owner.db.rpc('create_plan', {
    p_name: name,
    p_display_name: owner.name,
  })
  if (error) throw error
  return data
}

/** Invites `member` into `planId` the way the app will: invite, then join. */
async function invite(owner: TestUser, member: TestUser, planId: string) {
  const created = await owner.db
    .from('plan_invites')
    .insert({ plan_id: planId })
    .select('token')
    .single()
  if (created.error) throw created.error
  const joined = await member.db.rpc('join_plan', {
    p_token: created.data.token,
    p_display_name: member.name,
  })
  if (joined.error) throw joined.error
}

async function addPerson(
  user: TestUser,
  planId: string,
  name: string,
  memberUserId: string | null = null,
) {
  const { data, error } = await user.db
    .from('people')
    .insert({ plan_id: planId, name, member_user_id: memberUserId })
    .select()
    .single()
  if (error) throw error
  return data
}

async function addGift(
  user: TestUser,
  planId: string,
  personId: string,
  title: string,
) {
  const { data, error } = await user.db
    .from('gifts')
    .insert({ plan_id: planId, person_id: personId, title, price_pence: 3500 })
    .select()
    .single()
  if (error) throw error
  return data
}

describe('plans and membership', () => {
  let dan: TestUser
  let outsider: TestUser
  let planId: string

  beforeAll(async () => {
    dan = await newUser('Dan')
    outsider = await newUser('Outsider')
    planId = await createPlan(dan)
    await addPerson(dan, planId, 'Mum')
  })

  it('makes the creator the owner', async () => {
    const { data } = await dan.db
      .from('plan_members')
      .select('user_id, role')
      .eq('plan_id', planId)
    expect(data).toEqual([{ user_id: dan.id, role: 'owner' }])
  })

  it('shows a non-member nothing from the plan', async () => {
    const plans = await outsider.db.from('plans').select().eq('id', planId)
    const people = await outsider.db
      .from('people')
      .select()
      .eq('plan_id', planId)
    expect(plans.data).toEqual([])
    expect(people.data).toEqual([])
  })

  it('refuses a non-member who writes into the plan', async () => {
    const { error } = await outsider.db
      .from('people')
      .insert({ plan_id: planId, name: 'Intruder' })
    expect(error?.code).toBe(RLS_DENIED)
  })

  it('shows a signed-out visitor nothing at all', async () => {
    const visitor = signedOut()
    const { data, error } = await visitor.from('people').select()
    // anon has no table privileges, so this is refused outright.
    expect(data ?? []).toEqual([])
    expect(error?.code).toBe(RLS_DENIED)
  })

  it('stops a member promoting themselves to owner', async () => {
    const jo = await newUser('Jo')
    await invite(dan, jo, planId)
    const { error } = await jo.db
      .from('plan_members')
      .update({ role: 'owner' })
      .eq('user_id', jo.id)
    expect(error?.code).toBe(RLS_DENIED)
  })
})

describe('invites', () => {
  it('lets someone preview and join with a valid invite', async () => {
    const dan = await newUser('Dan')
    const jo = await newUser('Jo')
    const planId = await createPlan(dan, 'Mum’s 60th')
    const { data: invite } = await dan.db
      .from('plan_invites')
      .insert({ plan_id: planId })
      .select('token')
      .single()

    const preview = await jo.db.rpc('invite_details', {
      p_token: invite!.token,
    })
    expect(preview.data).toEqual([
      expect.objectContaining({ plan_name: 'Mum’s 60th', invited_by: 'Dan' }),
    ])

    const joined = await jo.db.rpc('join_plan', {
      p_token: invite!.token,
      p_display_name: 'Jo',
    })
    expect(joined.data).toBe(planId)
    const plans = await jo.db.from('plans').select('name')
    expect(plans.data).toEqual([{ name: 'Mum’s 60th' }])
  })

  it('refuses an expired invite', async () => {
    const dan = await newUser('Dan')
    const jo = await newUser('Jo')
    const planId = await createPlan(dan)
    const { data: invite } = await admin
      .from('plan_invites')
      .insert({
        plan_id: planId,
        created_by: dan.id,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .select('token')
      .single()

    const preview = await jo.db.rpc('invite_details', {
      p_token: invite!.token,
    })
    expect(preview.data).toEqual([])
    const joined = await jo.db.rpc('join_plan', {
      p_token: invite!.token,
      p_display_name: 'Jo',
    })
    expect(joined.error?.message).toMatch(/expired or been revoked/)
    const plans = await jo.db.from('plans').select()
    expect(plans.data).toEqual([])
  })
})

describe('the surprise rule', () => {
  let dan: TestUser
  let jo: TestUser
  let planId: string
  let joCard: { id: string }
  let joGift: { id: string }
  let mumGift: { id: string }

  beforeAll(async () => {
    dan = await newUser('Dan')
    jo = await newUser('Jo')
    planId = await createPlan(dan)
    await invite(dan, jo, planId)
    // Dan makes a card for Jo and links it to Jo's account.
    joCard = await addPerson(dan, planId, 'Jo', jo.id)
    joGift = await addGift(dan, planId, joCard.id, 'Concert tickets')
    const mum = await addPerson(dan, planId, 'Mum')
    mumGift = await addGift(dan, planId, mum.id, 'Cookbook')
  })

  it('lets everyone else see the recipient and their gifts', async () => {
    const people = await dan.db
      .from('people')
      .select('name')
      .eq('plan_id', planId)
    const gifts = await dan.db
      .from('gifts')
      .select('title')
      .eq('plan_id', planId)
    expect(people.data?.map((p) => p.name).sort()).toEqual(['Jo', 'Mum'])
    expect(gifts.data?.map((g) => g.title).sort()).toEqual([
      'Concert tickets',
      'Cookbook',
    ])
  })

  it('hides the recipient’s own card and gifts from them', async () => {
    const people = await jo.db
      .from('people')
      .select('name')
      .eq('plan_id', planId)
    const gifts = await jo.db
      .from('gifts')
      .select('title')
      .eq('plan_id', planId)
    expect(people.data).toEqual([{ name: 'Mum' }])
    expect(gifts.data).toEqual([{ title: 'Cookbook' }])
  })

  it('returns nothing even when the recipient asks for the gift by id', async () => {
    const { data } = await jo.db.from('gifts').select().eq('id', joGift.id)
    expect(data).toEqual([])
  })

  it('stops the recipient changing, unlinking or deleting their card', async () => {
    const updated = await jo.db
      .from('people')
      .update({ member_user_id: null })
      .eq('id', joCard.id)
      .select()
    const deleted = await jo.db
      .from('gifts')
      .delete()
      .eq('id', joGift.id)
      .select()
    // RLS filters these rows out, so nothing matches and nothing changes.
    expect(updated.data).toEqual([])
    expect(deleted.data).toEqual([])
    const stillThere = await dan.db
      .from('gifts')
      .select('id')
      .eq('id', joGift.id)
    expect(stillThere.data).toHaveLength(1)
  })

  it('stops the recipient adding a gift to their own card', async () => {
    const { error } = await jo.db
      .from('gifts')
      .insert({ plan_id: planId, person_id: joCard.id, title: 'Sneaky' })
    expect(error?.code).toBe(RLS_DENIED)
  })

  it('stops a member moving a visible gift onto their own card', async () => {
    const { error } = await jo.db
      .from('gifts')
      .update({ person_id: joCard.id })
      .eq('id', mumGift.id)
    expect(error?.code).toBe(RLS_DENIED)
  })

  it('stops a member linking a card to themselves', async () => {
    const { error } = await jo.db
      .from('people')
      .insert({ plan_id: planId, name: 'Me', member_user_id: jo.id })
    expect(error?.code).toBe(RLS_DENIED)
  })

  it('clears the link when the recipient leaves the plan', async () => {
    const left = await jo.db
      .from('plan_members')
      .delete()
      .eq('plan_id', planId)
      .eq('user_id', jo.id)
    expect(left.error).toBeNull()
    const card = await dan.db
      .from('people')
      .select('member_user_id')
      .eq('id', joCard.id)
      .single()
    expect(card.data?.member_user_id).toBeNull()
  })
})

describe('members are buyers', () => {
  it('adds each member as a buyer linked to their account, in the next free colour', async () => {
    const dan = await newUser('Dan')
    const jo = await newUser('Jo')
    const planId = await createPlan(dan)
    // A hand-added buyer takes colour 1, so Jo should get colour 2.
    await dan.db
      .from('purchasers')
      .insert({ plan_id: planId, name: 'Grandma', slot: 1 })
    await invite(dan, jo, planId)

    const { data } = await dan.db
      .from('purchasers')
      .select('name, slot, user_id')
      .eq('plan_id', planId)
      .order('slot')
    expect(data).toEqual([
      { name: 'Dan', slot: 0, user_id: dan.id },
      { name: 'Grandma', slot: 1, user_id: null },
      { name: 'Jo', slot: 2, user_id: jo.id },
    ])
  })

  it('does not add a second buyer when someone opens the invite twice', async () => {
    const dan = await newUser('Dan')
    const jo = await newUser('Jo')
    const planId = await createPlan(dan)
    const { data: link } = await dan.db
      .from('plan_invites')
      .insert({ plan_id: planId })
      .select('token')
      .single()
    for (let i = 0; i < 2; i++) {
      const { error } = await jo.db.rpc('join_plan', {
        p_token: link!.token,
        p_display_name: 'Jo',
      })
      expect(error).toBeNull()
    }
    const { data } = await dan.db
      .from('purchasers')
      .select('name')
      .eq('plan_id', planId)
    expect(data?.map((p) => p.name).sort()).toEqual(['Dan', 'Jo'])
  })

  it('keeps a departed member as a buyer, no longer linked to them', async () => {
    const dan = await newUser('Dan')
    const jo = await newUser('Jo')
    const planId = await createPlan(dan)
    await invite(dan, jo, planId)
    await dan.db
      .from('plan_members')
      .delete()
      .eq('plan_id', planId)
      .eq('user_id', jo.id)

    const { data } = await dan.db
      .from('purchasers')
      .select('name, user_id')
      .eq('plan_id', planId)
      .eq('name', 'Jo')
      .single()
    expect(data).toEqual({ name: 'Jo', user_id: null })
  })
})

describe('data integrity', () => {
  let dan: TestUser
  let planId: string

  beforeAll(async () => {
    dan = await newUser('Dan')
    planId = await createPlan(dan)
  })

  it('refuses a gift whose person belongs to another plan', async () => {
    const otherPlan = await createPlan(dan, 'Other')
    const stranger = await addPerson(dan, otherPlan, 'Stranger')
    const { error } = await dan.db
      .from('gifts')
      .insert({ plan_id: planId, person_id: stranger.id, title: 'Mixed up' })
    expect(error?.code).toBe(FOREIGN_KEY)
  })

  it('refuses two buyers with the same colour but allows shared overflow', async () => {
    const first = await dan.db
      .from('purchasers')
      .insert({ plan_id: planId, name: 'A', slot: 3 })
    const clash = await dan.db
      .from('purchasers')
      .insert({ plan_id: planId, name: 'B', slot: 3 })
    const overflow = await dan.db.from('purchasers').insert([
      { plan_id: planId, name: 'C', slot: 8 },
      { plan_id: planId, name: 'D', slot: 8 },
    ])
    expect(first.error).toBeNull()
    expect(clash.error?.code).toBe(UNIQUE)
    expect(overflow.error).toBeNull()
  })

  it('unassigns gifts when their buyer is removed, as the app does', async () => {
    const person = await addPerson(dan, planId, 'Alex')
    const { data: buyer } = await dan.db
      .from('purchasers')
      .insert({ plan_id: planId, name: 'Jo', slot: 1 })
      .select()
      .single()
    const gift = await addGift(dan, planId, person.id, 'Headphones')
    await dan.db
      .from('gifts')
      .update({ purchaser_id: buyer!.id })
      .eq('id', gift.id)

    await dan.db.from('purchasers').delete().eq('id', buyer!.id)

    const after = await dan.db
      .from('gifts')
      .select('purchaser_id')
      .eq('id', gift.id)
      .single()
    expect(after.data?.purchaser_id).toBeNull()
  })

  it('deletes a person’s gifts with them, as the app does', async () => {
    const person = await addPerson(dan, planId, 'Grandad')
    const gift = await addGift(dan, planId, person.id, 'Whisky')
    await dan.db.from('people').delete().eq('id', person.id)
    const after = await dan.db.from('gifts').select().eq('id', gift.id)
    expect(after.data).toEqual([])
  })

  it('records who last changed a gift, ignoring what the client claims', async () => {
    const jo = await newUser('Jo')
    await invite(dan, jo, planId)
    const person = await addPerson(dan, planId, 'Sam')
    const gift = await addGift(dan, planId, person.id, 'Scarf')

    await jo.db.from('gifts').update({ status: 'bought' }).eq('id', gift.id)

    const after = await dan.db
      .from('gifts')
      .select('status, updated_by')
      .eq('id', gift.id)
      .single()
    expect(after.data).toEqual({ status: 'bought', updated_by: jo.id })
  })
})
