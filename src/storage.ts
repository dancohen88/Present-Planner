import { emptyState } from './domain/planner.ts'
import type { PlannerState } from './domain/planner.ts'

// Browser storage holds two things:
//   * a snapshot of each plan as last synced, so it can be read offline;
//   * the single-device list saved by versions before accounts existed
//     ("legacy"), kept only so it can be imported into a shared plan.
// Every access is wrapped in try/catch: storage can be unavailable (private
// windows, blocked site data) or hold corrupt JSON, and the app must still run.

const LEGACY_KEY = 'present-planner/v1'
const SNAPSHOT_PREFIX = 'present-planner/v2/plan/'
const LAST_PLAN_KEY = 'present-planner/v2/last-plan'

export interface PlanSnapshot {
  state: PlannerState
  /** ISO time of the last moment this copy matched the database. */
  syncedAt: string
}

export function loadSnapshot(planId: string): PlanSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_PREFIX + planId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PlanSnapshot>
    const state = normaliseState(parsed.state)
    if (!state || typeof parsed.syncedAt !== 'string') return null
    return { state, syncedAt: parsed.syncedAt }
  } catch {
    return null
  }
}

export function saveSnapshot(planId: string, snapshot: PlanSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_PREFIX + planId, JSON.stringify(snapshot))
  } catch {
    // Nothing useful to do if the browser refuses the write.
  }
}

export function loadLastPlanId(): string | null {
  try {
    return localStorage.getItem(LAST_PLAN_KEY)
  } catch {
    return null
  }
}

export function saveLastPlanId(planId: string): void {
  try {
    localStorage.setItem(LAST_PLAN_KEY, planId)
  } catch {
    // Ignore: the app falls back to the first plan.
  }
}

/** On sign-out, so the next person on this device can't read the lists. */
export function forgetPlans(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(SNAPSHOT_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
    localStorage.removeItem(LAST_PLAN_KEY)
  } catch {
    // Ignore.
  }
}

/** The pre-accounts list on this device, or null if there isn't one. */
export function loadLegacyState(): PlannerState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const state = normaliseState(JSON.parse(raw))
    return state && state.people.length > 0 ? state : null
  } catch {
    return null
  }
}

export function clearLegacyState(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Ignore.
  }
}

/**
 * Turns whatever was saved into the current shape, filling in fields that
 * didn't exist when it was written (a "tolerant reader"). Data saved before
 * purchasers existed has no purchasers list and no purchaserId on its gifts;
 * data saved before accounts existed has no memberUserId or userId.
 * Returns null if the value isn't planner data at all.
 */
export function normaliseState(value: unknown): PlannerState | null {
  if (typeof value !== 'object' || value === null) return null
  const saved = value as Partial<PlannerState>
  if (!Array.isArray(saved.people) || !Array.isArray(saved.gifts)) return null
  return {
    ...emptyState,
    people: saved.people.map((person) => ({
      ...person,
      memberUserId: person.memberUserId ?? null,
    })),
    purchasers: (Array.isArray(saved.purchasers) ? saved.purchasers : []).map(
      (purchaser) => ({ ...purchaser, userId: purchaser.userId ?? null }),
    ),
    gifts: saved.gifts.map((gift) => ({
      ...gift,
      purchaserId: gift.purchaserId ?? null,
    })),
  }
}
