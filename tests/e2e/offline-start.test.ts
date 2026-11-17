// The installed app must open with no signal at all, e.g. in a shop
// basement: the service worker serves the app, and the plan comes from the
// copy saved on the device.
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
} from './helpers.ts'
import type { Device } from './helpers.ts'

describe('starting with no connection', () => {
  let browser: Browser
  let phone: Device

  beforeAll(async () => {
    browser = await launch()
    phone = await newDevice(browser, { width: 390 })
  })

  afterAll(async () => {
    expect(phone.problems).toEqual([])
    await browser.close()
  })

  it('installs a service worker on first visit', async () => {
    await phone.page.goto(APP)
    await signIn(phone.page, uniqueEmail('dan'))
    await createPlan(phone.page, 'Dan')
    await addPerson(phone.page, 'Mum')
    await addGift(phone.page, 'Mum', 'Scarf', '35')
    const active = await phone.page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active?.state
    })
    expect(active).toBe('activated')
  })

  it('opens the app and the last plan with the network off', async () => {
    await phone.ctx.setOffline(true)
    await phone.page.reload()
    await phone.page.locator('.banner-offline').waitFor({ timeout: 10_000 })
    expect(await phone.page.getByText('Scarf').isVisible()).toBe(true)
    expect(
      await phone.page.getByRole('button', { name: 'Add person' }).isDisabled(),
    ).toBe(true)
  })

  it('opens in a brand-new tab with the network off', async () => {
    const tab = await phone.ctx.newPage()
    await tab.goto(APP)
    await tab.getByText('Scarf').waitFor({ timeout: 10_000 })
    await tab.close()
    await phone.ctx.setOffline(false)
  })
})
