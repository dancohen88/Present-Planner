import { formatPence } from '../domain/money.ts'
import { breakdownByPurchaser, giftsFor, totalsFor } from '../domain/planner.ts'
import type { Person, PlannerState, Totals } from '../domain/planner.ts'
import { UNASSIGNED, filterPlan, isFiltering } from './giftFilter.ts'
import type { GiftFilter } from './giftFilter.ts'

interface Props {
  state: PlannerState
  /** The table counts only the gifts that pass these filters. */
  filter: GiftFilter
}

function Amount({ totals, over = false }: { totals: Totals; over?: boolean }) {
  if (totals.giftCount === 0) return <span className="muted">—</span>
  const unpriced = totals.plannedPence === 0 && totals.ideaCount > 0
  return (
    <>
      <span className={over ? 'amount over-amount' : 'amount'}>
        {over && '⚠ '}
        {formatPence(totals.spentPence)}
      </span>
      {totals.plannedPence > 0 && (
        <span className="ideas">+{formatPence(totals.plannedPence)} ideas</span>
      )}
      {unpriced && (
        <span className="ideas">
          +{totals.ideaCount} idea{totals.ideaCount === 1 ? '' : 's'}
        </span>
      )}
    </>
  )
}

/**
 * "budget £50 · £12 left". Always worked out from all of the person's gifts,
 * never the filtered ones, because a budget belongs to the person.
 */
function BudgetLine({ state, person }: { state: PlannerState; person: Person }) {
  const budget = person.budgetPence
  if (budget === null) return null
  const { spentPence } = totalsFor(giftsFor(state, person.id))
  const left = budget - spentPence
  return (
    <span className="row-budget">
      budget {formatPence(budget)} ·{' '}
      {left >= 0 ? (
        `${formatPence(left)} left`
      ) : (
        <span className="over-amount">⚠ {formatPence(-left)} over</span>
      )}
    </span>
  )
}

function names(list: string[]): string {
  return list.length === 1
    ? list[0]
    : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

export function TotalsTable({ state, filter }: Props) {
  const filtering = isFiltering(filter)
  // The same filtering rule as the gift cards, so both views always agree.
  const shown = filterPlan(state, filter)
  const { columns, rows, columnTotals, grandTotal } =
    breakdownByPurchaser(shown)
  const columnKeys = columns.map((column) => column?.id ?? UNASSIGNED)
  // With a single buyer column the Total column would just repeat it.
  const showTotal = columns.length !== 1
  const idle = filtering
    ? []
    : state.purchasers.filter((p) => !columns.includes(p)).map((p) => p.name)

  if (filtering && rows.length === 0) {
    return <p className="muted empty-filter">Nothing matches this filter.</p>
  }

  return (
    <>
      {state.purchasers.length === 0 && (
        <p className="muted hint">
          Add buyers under “Who's buying” to split these totals by who's paying.
        </p>
      )}
      <div className="table-wrap">
        {/* A <caption> is as wide as its table, so on a phone it would scroll
            off-screen with the columns. A paragraph outside the scroller stays
            put, and aria-describedby still ties it to the table. */}
        <p id="breakdown-note" className="table-note">
          Spent so far by each buyer, per person. Ideas not yet bought are
          listed underneath.
          {idle.length > 0 && (
            <>
              {' '}
              {names(idle)} {idle.length === 1 ? 'has' : 'have'} nothing
              allocated yet, so {idle.length === 1 ? "isn't" : "aren't"} shown.
            </>
          )}
        </p>
        {/* The table scrolls sideways inside this box when there are more
            buyers than fit, so the page itself never scrolls horizontally. */}
        <div className="table-scroll">
          <table className="breakdown" aria-describedby="breakdown-note">
            <thead>
              <tr>
                <th scope="col">For</th>
                {columns.map((column, c) => (
                  <th key={columnKeys[c]} scope="col">
                    <span className="col-head">
                      <span
                        className={
                          column ? `dot slot-${column.slot}` : 'dot dot-empty'
                        }
                      />
                      {column ? column.name : 'Unassigned'}
                    </span>
                  </th>
                ))}
                {showTotal && (
                  <th scope="col" className="total">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, cells, total }) => {
                const budget = person.budgetPence
                return (
                  <tr key={person.id}>
                    <th scope="row">
                      <span className="row-name">{person.name}</span>
                      <BudgetLine state={state} person={person} />
                    </th>
                    {cells.map((cell, c) => (
                      <td key={columnKeys[c]}>
                        <Amount totals={cell} />
                      </td>
                    ))}
                    {showTotal && (
                      <td className="total">
                        <Amount
                          totals={total}
                          // Only meaningful when the total is every gift.
                          over={
                            !filtering &&
                            budget !== null &&
                            total.spentPence > budget
                          }
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {columnTotals.map((cell, c) => (
                  <td key={columnKeys[c]}>
                    <Amount totals={cell} />
                  </td>
                ))}
                {showTotal && (
                  <td className="total">
                    <Amount totals={grandTotal} />
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}
