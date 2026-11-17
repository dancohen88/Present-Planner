import type { PlannerState } from '../domain/planner.ts'
import { stateFromRows } from './rows.ts'
import type { Db } from './db.ts'

export interface FetchedPlan {
  name: string
  state: PlannerState
}

/**
 * Loads one plan in full. Returns null when the plan doesn't exist or this
 * user can no longer see it (row-level security makes those look the same).
 * Throws on network or server errors.
 */
export async function fetchPlan(
  db: Db,
  planId: string,
): Promise<FetchedPlan | null> {
  const [plan, people, purchasers, gifts] = await Promise.all([
    db.from('plans').select('name').eq('id', planId).maybeSingle(),
    db.from('people').select().eq('plan_id', planId),
    db.from('purchasers').select().eq('plan_id', planId),
    db.from('gifts').select().eq('plan_id', planId),
  ])
  for (const result of [plan, people, purchasers, gifts]) {
    if (result.error) throw result.error
  }
  if (!plan.data) return null
  return {
    name: plan.data.name,
    state: stateFromRows({
      people: people.data ?? [],
      purchasers: purchasers.data ?? [],
      gifts: gifts.data ?? [],
    }),
  }
}
