import { formatPence } from '../domain/money.ts'

interface Props {
  spentPence: number
  plannedPence: number
  budgetPence: number
  /** Who or what the budget belongs to, for screen readers. */
  label: string
}

/**
 * A thin bar showing money spent (solid) and money earmarked for ideas
 * (lighter) against a budget. The numbers are always printed next to it by the
 * caller, so the bar is a glanceable extra and never the only source.
 */
export function BudgetMeter({
  spentPence,
  plannedPence,
  budgetPence,
  label,
}: Props) {
  const over = spentPence > budgetPence
  const spentShare = Math.min(spentPence, budgetPence) / budgetPence
  // Ideas only get whatever room is left; they never push the bar past full.
  const plannedShare =
    Math.min(plannedPence, budgetPence - Math.min(spentPence, budgetPence)) /
    budgetPence

  const description =
    `${label}: ${formatPence(spentPence)} spent` +
    (plannedPence > 0 ? `, ${formatPence(plannedPence)} in ideas` : '') +
    ` of ${formatPence(budgetPence)}`

  return (
    <div
      className={over ? 'meter over' : 'meter'}
      role="img"
      aria-label={description}
      title={description}
    >
      {spentShare > 0 && (
        <span className="meter-spent" style={{ flexGrow: spentShare }} />
      )}
      {plannedShare > 0 && (
        <span className="meter-planned" style={{ flexGrow: plannedShare }} />
      )}
      <span
        className="meter-rest"
        style={{ flexGrow: Math.max(0, 1 - spentShare - plannedShare) }}
      />
    </div>
  )
}
