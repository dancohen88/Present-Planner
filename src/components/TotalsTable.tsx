import { formatPence } from '../domain/money.ts'
import { breakdownByPurchaser } from '../domain/planner.ts'
import type { PlannerState, Totals } from '../domain/planner.ts'
import { UNASSIGNED } from './PurchaserBar.tsx'
import type { PurchaserFilter } from './PurchaserBar.tsx'

interface Props {
  state: PlannerState
  /** The chip selected in "Who's buying"; its column is highlighted. */
  filter: PurchaserFilter
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

export function TotalsTable({ state, filter }: Props) {
  const { columns, rows, columnTotals, grandTotal } =
    breakdownByPurchaser(state)
  const columnKeys = columns.map((column) => column?.id ?? UNASSIGNED)
  const activeClass = (key: string) => (key === filter ? 'active' : undefined)

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
        </p>
        {/* The table scrolls sideways inside this box when there are more
            buyers than fit, so the page itself never scrolls horizontally. */}
        <div className="table-scroll">
          <table className="breakdown" aria-describedby="breakdown-note">
            <thead>
              <tr>
                <th scope="col">For</th>
                {columns.map((column, c) => (
                  <th
                    key={columnKeys[c]}
                    scope="col"
                    className={activeClass(columnKeys[c])}
                  >
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
                <th scope="col" className="total">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, cells, total }) => {
                const budget = person.budgetPence
                return (
                  <tr key={person.id}>
                    <th scope="row">
                      <span className="row-name">{person.name}</span>
                      {budget !== null && (
                        <span className="row-budget">
                          budget {formatPence(budget)}
                        </span>
                      )}
                    </th>
                    {cells.map((cell, c) => (
                      <td
                        key={columnKeys[c]}
                        className={activeClass(columnKeys[c])}
                      >
                        <Amount totals={cell} />
                      </td>
                    ))}
                    <td className="total">
                      <Amount
                        totals={total}
                        over={budget !== null && total.spentPence > budget}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {columnTotals.map((cell, c) => (
                  <td
                    key={columnKeys[c]}
                    className={activeClass(columnKeys[c])}
                  >
                    <Amount totals={cell} />
                  </td>
                ))}
                <td className="total">
                  <Amount totals={grandTotal} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}
