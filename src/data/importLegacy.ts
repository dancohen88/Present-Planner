import { nextPurchaserSlot } from '../domain/planner.ts'
import type {
  PlannerAction,
  PlannerState,
  Purchaser,
} from '../domain/planner.ts'

/**
 * Turns the list saved on this device before accounts existed into actions
 * that add it to a shared plan. Pure, so it can be tested without a browser.
 *
 * - Everything gets a fresh id, so importing on two devices, or twice, can't
 *   collide with rows already in the database.
 * - A buyer whose name matches one already in the plan (often a member,
 *   added automatically) is merged into it rather than duplicated.
 * - New buyers get the next free colour in the plan.
 * - Actions come out in dependency order: people and buyers before the
 *   gifts that refer to them.
 */
export function importLegacy(
  legacy: PlannerState,
  plan: PlannerState,
  newId: () => string,
): PlannerAction[] {
  const actions: PlannerAction[] = []

  const personIds = new Map<string, string>()
  for (const person of legacy.people) {
    const id = newId()
    personIds.set(person.id, id)
    actions.push({
      type: 'personAdded',
      person: { ...person, id, memberUserId: null },
    })
  }

  const purchaserIds = new Map<string, string>()
  const purchasers: Purchaser[] = [...plan.purchasers]
  for (const purchaser of legacy.purchasers) {
    const match = purchasers.find(
      (p) =>
        p.name.trim().toLowerCase() === purchaser.name.trim().toLowerCase(),
    )
    if (match) {
      purchaserIds.set(purchaser.id, match.id)
      continue
    }
    const added: Purchaser = {
      id: newId(),
      name: purchaser.name,
      slot: nextPurchaserSlot(purchasers),
      userId: null,
    }
    purchasers.push(added)
    purchaserIds.set(purchaser.id, added.id)
    actions.push({ type: 'purchaserAdded', purchaser: added })
  }

  for (const gift of legacy.gifts) {
    const personId = personIds.get(gift.personId)
    if (!personId) continue // orphaned gift; nothing to attach it to
    actions.push({
      type: 'giftAdded',
      gift: {
        ...gift,
        id: newId(),
        personId,
        purchaserId: gift.purchaserId
          ? (purchaserIds.get(gift.purchaserId) ?? null)
          : null,
      },
    })
  }

  return actions
}
