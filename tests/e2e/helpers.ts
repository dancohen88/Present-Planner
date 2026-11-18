import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext, Page } from 'playwright-core'

export const APP = 'http://localhost:4173/'
// Mailpit, which catches the local stack's emails.
const MAIL = 'http://127.0.0.1:54324/api/v1'

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function uniqueEmail(name: string): string {
  return `${name}-${randomUUID().slice(0, 8)}@example.test`
}

export async function launch(): Promise<Browser> {
  try {
    return await chromium.launch()
  } catch (error) {
    throw new Error(
      'Headless Chromium is missing. Install it once with: npx playwright-core install chromium-headless-shell',
      { cause: error },
    )
  }
}

export interface Device {
  ctx: BrowserContext
  page: Page
  /** Console errors and failed requests seen so far. */
  problems: string[]
}

export async function newDevice(
  browser: Browser,
  options: { width?: number; init?: () => void } = {},
): Promise<Device> {
  const ctx = await browser.newContext({
    viewport: { width: options.width ?? 1100, height: 900 },
  })
  if (options.init) await ctx.addInitScript(options.init)
  const page = await ctx.newPage()
  const problems: string[] = []
  page.on('dialog', (dialog) => void dialog.accept()) // yes to confirm()
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('console', (m) => {
    // Requests that fail because the test switched the network off are
    // expected, not bugs.
    if (
      m.type() === 'error' &&
      !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(m.text())
    ) {
      problems.push(m.text())
    }
  })
  return { ctx, page, problems }
}

/** The newest sign-in code emailed to `email` after `after`. */
async function codeFor(email: string, after: Date): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const search = await fetch(
      `${MAIL}/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    ).then(
      (r) =>
        r.json() as Promise<{ messages: { ID: string; Created: string }[] }>,
    )
    const fresh = search.messages.filter((m) => new Date(m.Created) > after)
    if (fresh.length > 0) {
      const message = await fetch(`${MAIL}/message/${fresh[0].ID}`).then(
        (r) => r.json() as Promise<{ Text: string; HTML: string }>,
      )
      const code = /\b(\d{6,10})\b/.exec(message.Text || message.HTML)
      if (code) return code[1]
    }
    await pause(250)
  }
  throw new Error(`No sign-in code arrived for ${email}`)
}

/** Signs in from the sign-in screen, which must already be showing. */
export async function signIn(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  const sentAt = new Date(Date.now() - 1000)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page
    .getByLabel('Code from the email')
    .fill(await codeFor(email, sentAt))
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Creates a plan from the "Start a plan" screen. */
export async function createPlan(
  page: Page,
  displayName: string,
  planName?: string,
) {
  if (planName) await page.getByLabel('Plan name').fill(planName)
  await page
    .getByLabel('Your name, as others in the plan will see it')
    .fill(displayName)
  await page.getByRole('button', { name: 'Create plan' }).click()
  await waitLive(page)
}

export async function waitLive(page: Page) {
  await page
    .locator('.sync-pill', { hasText: 'Live' })
    .waitFor({ timeout: 15_000 })
}

export function planName(page: Page) {
  return page.locator('.plan-switch option:checked').textContent()
}

export async function addPerson(page: Page, name: string, budget?: string) {
  await page.getByLabel("Person's name").fill(name)
  if (budget) await page.getByLabel('Budget in pounds (optional)').fill(budget)
  await page.getByRole('button', { name: 'Add person' }).click()
  await page.locator('.card h2', { hasText: name }).waitFor()
}

export async function addGift(
  page: Page,
  person: string,
  title: string,
  price?: string,
) {
  const card = page.locator('.card', {
    has: page.locator('h2', { hasText: person }),
  })
  await card.getByLabel(`Gift idea for ${person}`).fill(title)
  if (price) await card.getByLabel('Price in pounds').fill(price)
  await card.getByLabel(`Gift idea for ${person}`).press('Enter')
  await page.getByText(title, { exact: true }).waitFor()
}
