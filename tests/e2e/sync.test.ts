// One account on two devices: changes on either appear on the other, and a
// device that goes offline stays readable and catches up afterwards.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser } from 'playwright-core'
import {
  APP,
  addGift,
  addPerson,
  createPlan,
  launch,
  newDevice,
  pause,
  planName,
  signIn,
  uniqueEmail,
  waitLive,
} from './helpers.ts'
import type { Device } from './helpers.ts'

describe('one account, two devices', () => {
  let browser: Browser
  let a: Device
  let b: Device
  const email = uniqueEmail('dan')

  beforeAll(async () => {
    browser = await launch()
    a = await newDevice(browser)
    b = await newDevice(browser)
  })

  afterAll(async () => {
    expect([...a.problems, ...b.problems]).toEqual([])
    await browser.close()
  })

  it('asks a new user to start a plan, then goes live', async () => {
    await a.page.goto(APP)
    await signIn(a.page, email)
    await a.page.getByRole('heading', { name: 'Start a plan' }).waitFor()
    await createPlan(a.page, 'Dan')
  })

  it('opens the same plan on a second device', async () => {
    await pause(1500) // the server sends one code per second per address
    await b.page.goto(APP)
    await signIn(b.page, email)
    await waitLive(b.page)
    expect(await planName(b.page)).toBe(await planName(a.page))
  })

  it('shows a gift added on one device on the other, without reloading', async () => {
    await addPerson(a.page, 'Mum', '60')
    await a.page.getByLabel('Name of someone doing the buying').fill('Grandma')
    await a.page
      .locator('.chip-add')
      .getByRole('button', { name: 'Add' })
      .click()
    await addGift(a.page, 'Mum', 'Scarf', '35')
    await b.page.getByText('Scarf').waitFor({ timeout: 8000 })
    await b.page.locator('.chip-name', { hasText: 'Grandma' }).waitFor()
  })

  it('shows status and buyer changes made on the other device', async () => {
    await b.page.getByLabel('Status of Scarf').selectOption('bought')
    await b.page
      .getByLabel('Who is buying Scarf')
      .selectOption({ label: 'Grandma' })
    await a.page.waitForFunction(
      () =>
        (
          document.querySelector(
            '[aria-label="Status of Scarf"]',
          ) as HTMLSelectElement
        )?.value === 'bought' &&
        document.querySelector(
          '[aria-label="Who is buying Scarf"] option:checked',
        )?.textContent === 'Grandma',
      null,
      { timeout: 8000 },
    )
  })

  it('goes read-only offline, still showing the gifts', async () => {
    await b.ctx.setOffline(true)
    await b.page.locator('.banner-offline').waitFor({ timeout: 8000 })
    expect(
      await b.page.getByRole('button', { name: 'Add person' }).isDisabled(),
    ).toBe(true)
    expect(await b.page.getByText('Scarf').isVisible()).toBe(true)
  })

  it('catches up on changes made while it was offline', async () => {
    await addGift(a.page, 'Mum', 'Mug')
    await b.ctx.setOffline(false)
    await b.page.getByText('Mug').waitFor({ timeout: 15_000 })
    await waitLive(b.page)
  })

  it('removes a deleted gift on the other device', async () => {
    await a.page.getByLabel('Remove Mug').click()
    await b.page.getByText('Mug').waitFor({ state: 'detached', timeout: 8000 })
  })

  it('keeps everything after a reload, because it lives in the database', async () => {
    await b.page.reload()
    await b.page.getByText('Scarf').waitFor({ timeout: 8000 })
  })

  it('forgets cached plans on sign-out', async () => {
    await b.page.getByRole('button', { name: 'Sign out' }).click()
    await b.page.getByRole('heading', { name: 'Sign in' }).waitFor()
    const cached = await b.page.evaluate(() =>
      Object.keys(localStorage).filter((k) =>
        k.startsWith('present-planner/v2'),
      ),
    )
    expect(cached).toEqual([])
  })
})
