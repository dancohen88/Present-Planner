import { emptyState } from './domain/planner.ts'
import type { PlannerState } from './domain/planner.ts'

// The key is versioned so a change that old data can't be read into can use a
// new key and migrate, instead of crashing on old data.
const STORAGE_KEY = 'present-planner/v1'

export function loadState(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    return normaliseState(JSON.parse(raw)) ?? emptyState
  } catch {
    // Storage can be unavailable (private windows, blocked site data) or hold
    // corrupt JSON. Either way, starting empty beats failing to render.
    return emptyState
  }
}

export function saveState(state: PlannerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Nothing useful to do if the browser refuses the write.
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
