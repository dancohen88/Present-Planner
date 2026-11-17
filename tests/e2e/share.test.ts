// Dan and Jo share a plan, and Jo never sees what's planned for Jo.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser } from 'playwright-core'
import {
  APP,
  addGift,
  addPerson,
  createPlan,
  launch,
  newDevice,
  signIn,
  uniqueEmail,
  waitLive,
} from './helpers.ts'
import type { Device } from './helpers.ts'

// The list Dan's device saved before accounts existed.
function seedLegacyList() {
  if (localStorage.getItem('test-seeded')) return
  localStorage.setItem('test-seeded', '1')
  localStorage.setItem(
    'present-planner/v1',
    JSON.stringify({
      people: [{ id: 'old-p1', name: 'Mum', budgetPence: 6000 }],
      purchasers: [
        { id: 'old-b1', name: 'Dan', slot: 0 },
        { id: 'old-b2', name: 'Grandma', slot: 1 },
      ],
      gifts: [
        {
          id: 'old-g1',
          personId: 'old-p1',
          title: 'Gardening gloves',
          pricePence: 1499,
          status: 'bought',
          purchaserId: 'old-b1',
        },
        {
          id: 'old-g2',
          personId: 'old-p1',
          title: 'Cookbook',
          pricePence: 2200,
          status: 'idea',
          purchaserId: 'old-b2',
        },
      ],
    }),
  )
}

describe('sharing a plan', () => {
  let browser: Browser
  let dan: Device
  let jo: Device
  let inviteLink: string

  beforeAll(async () => {
    browser = await launch()
    dan = await newDevice(browser, { init: seedLegacyList })
    jo = await newDevice(browser, { width: 390 })
  })

  afterAll(async () => {
    expect([...dan.problems, ...jo.problems]).toEqual([])
    await browser.close()
  })

  it('imports the list saved on the device before accounts', async () => {
    await dan.page.goto(APP)
    await signIn(dan.page, uniqueEmail('dan'))
    await createPlan(dan.page, 'Dan')
    await dan.page.getByText('1 person and 2 gifts').waitFor()
    await dan.page.getByRole('button', { name: 'Import' }).click()
    await dan.page.getByText('Cookbook').waitFor({ timeout: 8000 })
    await dan.page.locator('.banner-import').waitFor({ state: 'detached' })
    // "Dan" merged into Dan's own buyer; Grandma added.
    expect(await dan.page.locator('.chip-name').allTextContents()).toEqual([
      'Dan (you)',
      'Grandma',
    ])
    expect(
      await dan.page.evaluate(() => localStorage.getItem('present-planner/v1')),
    ).toBeNull()
  })

  it('creates an invite link', async () => {
    await dan.page.getByRole('button', { name: /^Members/ }).click()
    await dan.page.getByRole('button', { name: 'Create invite link' }).click()
    inviteLink = await dan.page.getByLabel('Invite link').inputValue()
    expect(inviteLink).toMatch(/#\/join\/[0-9a-f-]{36}$/)
    await dan.page.getByRole('button', { name: 'Close' }).click()
  })

  it('lets Jo sign in from the link and join', async () => {
    await jo.page.goto(inviteLink)
    await jo.page.getByText("You've been invited").waitFor()
    await signIn(jo.page, uniqueEmail('jo'))
    await jo.page.getByText('Dan invited you').waitFor({ timeout: 8000 })
    await jo.page
      .getByLabel('Your name, as others in the plan will see it')
      .fill('Jo')
    await jo.page.getByRole('button', { name: /^Join / }).click()
    await waitLive(jo.page)
    expect(await jo.page.getByText('Cookbook').isVisible()).toBe(true)
    expect(
      await jo.page.locator('.chip-name', { hasText: 'Jo' }).textContent(),
    ).toBe('Jo (you)')
  })

  it('shows Dan that Jo joined, as a member and a buyer, live', async () => {
    await dan.page
      .getByRole('button', { name: 'Members · 2' })
      .waitFor({ timeout: 8000 })
    await dan.page
      .locator('.chip-name', { hasText: 'Jo' })
      .waitFor({ timeout: 8000 })
  })

  it('keeps gifts for Jo away from Jo', async () => {
    await addPerson(dan.page, 'Jo')
    await dan.page
      .locator('.card', { has: dan.page.locator('h2', { hasText: 'Jo' }) })
      .getByLabel('Uses the app as')
      .selectOption({ label: 'Jo (hide their gifts from them)' })
    await dan.page.getByText('🔒 Hidden from Jo').waitFor()
    await addGift(dan.page, 'Jo', 'Concert tickets', '80')
    // A later change Jo can see proves the live channel has caught up.
    await addGift(dan.page, 'Mum', 'Slippers')
    await jo.page.getByText('Slippers').waitFor({ timeout: 8000 })
    expect(await jo.page.getByText('Concert tickets').count()).toBe(0)

    await jo.page.reload()
    await waitLive(jo.page)
    expect(await jo.page.locator('.card h2').allTextContents()).toEqual(['Mum'])
  })

  it('switches between plans', async () => {
    await dan.page
      .locator('.plan-switch select')
      .selectOption({ label: '+ New plan…' })
    await createPlan(dan.page, 'Dan', 'Mum’s 60th')
    await dan.page.getByText('No one on the list yet').waitFor()
    const christmas = (
      await dan.page.locator('.plan-switch option').allTextContents()
    ).find((name) => name.startsWith('Christmas'))!
    await dan.page
      .locator('.plan-switch select')
      .selectOption({ label: christmas })
    await dan.page.getByText('Concert tickets').waitFor({ timeout: 8000 })
    expect(dan.page.url()).toMatch(/#\/plan\/[0-9a-f-]{36}$/)
  })

  it('removes Jo, after which Jo has no access', async () => {
    await dan.page.getByRole('button', { name: /^Members/ }).click()
    await dan.page
      .locator('.members li', { hasText: 'Jo' })
      .getByRole('button', { name: 'Remove' })
      .click()
    await dan.page
      .getByRole('button', { name: 'Members · 1' })
      .waitFor({ timeout: 8000 })
    await dan.page.getByRole('button', { name: 'Close' }).click()
    expect(await dan.page.getByText('🔒 Hidden from Jo').count()).toBe(0)

    await jo.page.reload()
    await jo.page
      .getByRole('heading', { name: 'Start a plan' })
      .waitFor({ timeout: 8000 })
  })
})
