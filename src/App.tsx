import { useEffect, useReducer, useState } from 'react'
import type { FormEvent } from 'react'
import { BudgetMeter } from './components/BudgetMeter.tsx'
import { PersonCard } from './components/PersonCard.tsx'
import {
  PurchaserBar,
  SHOW_ALL,
  UNASSIGNED,
} from './components/PurchaserBar.tsx'
import type { PurchaserFilter } from './components/PurchaserBar.tsx'
import { TotalsTable } from './components/TotalsTable.tsx'
import { formatPence, parsePounds } from './domain/money.ts'
import { giftsFor, plannerReducer, totalsFor } from './domain/planner.ts'
import type { Gift } from './domain/planner.ts'
import { loadState, saveState } from './storage.ts'

function matchesFilter(gift: Gift, filter: PurchaserFilter): boolean {
  if (filter === SHOW_ALL) return true
  if (filter === UNASSIGNED) return gift.purchaserId === null
  return gift.purchaserId === filter
}

function App() {
  // The third argument is a lazy initialiser: loadState runs once on mount
  // rather than on every render.
  const [state, dispatch] = useReducer(plannerReducer, undefined, loadState)
  // The filter is view state, not planner data, so it stays out of the reducer
  // and isn't saved: reopening the app always shows everything.
  const [filter, setFilter] = useState<PurchaserFilter>(SHOW_ALL)
  const [view, setView] = useState<'gifts' | 'totals'>('gifts')
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [budgetInvalid, setBudgetInvalid] = useState(false)

  useEffect(() => {
    saveState(state)
  }, [state])

  const totals = totalsFor(state.gifts)
  const sortedCount = totals.giftCount - totals.ideaCount
  const totalBudgetPence = state.people.reduce(
    (sum, person) => sum + (person.budgetPence ?? 0),
    0,
  )

  const filtering = filter !== SHOW_ALL
  const filterName =
    filter === UNASSIGNED
      ? 'nobody yet'
      : state.purchasers.find((p) => p.id === filter)?.name
  const cards = state.people
    .map((person) => {
      const gifts = giftsFor(state, person.id)
      return {
        person,
        gifts,
        visibleGifts: gifts.filter((gift) => matchesFilter(gift, filter)),
      }
    })
    // While filtering, people with nothing matching drop out of view.
    .filter((card) => !filtering || card.visibleGifts.length > 0)

  function addPerson(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const budgetPence = budget.trim() === '' ? null : parsePounds(budget)
    if (budget.trim() !== '' && budgetPence === null) {
      setBudgetInvalid(true)
      return
    }
    dispatch({
      type: 'personAdded',
      person: { id: crypto.randomUUID(), name: trimmed, budgetPence },
    })
    setName('')
    setBudget('')
    setBudgetInvalid(false)
  }

  return (
    <main>
      <header className="page-header">
        <h1>
          <span aria-hidden="true">🎁</span> Present Planner
        </h1>
      </header>

      {state.people.length > 0 && (
        <section className="summary" aria-label="Overall progress">
          <div className="tile">
            <p className="eyebrow">Spent</p>
            <p className="tile-value">
              {formatPence(totals.spentPence)}
              {totalBudgetPence > 0 && (
                <span className="tile-of">
                  {' '}
                  of {formatPence(totalBudgetPence)}
                </span>
              )}
            </p>
            {totalBudgetPence > 0 && (
              <BudgetMeter
                spentPence={totals.spentPence}
                plannedPence={totals.plannedPence}
                budgetPence={totalBudgetPence}
                label="Total budget"
              />
            )}
          </div>
          <div className="tile">
            <p className="eyebrow">Still to buy</p>
            <p className="tile-value">{totals.ideaCount}</p>
            <p className="tile-note">
              {totals.plannedPence > 0
                ? `about ${formatPence(totals.plannedPence)}`
                : totals.ideaCount === 0 && totals.giftCount > 0
                  ? 'nothing left'
                  : ' '}
            </p>
          </div>
          <div className="tile">
            <p className="eyebrow">Sorted</p>
            <p className="tile-value">
              {sortedCount}
              <span className="tile-of"> of {totals.giftCount}</span>
            </p>
            <p className="tile-note">bought, wrapped or given</p>
          </div>
        </section>
      )}

      {state.people.length > 0 && (
        <PurchaserBar
          state={state}
          filter={filter}
          onFilterChange={setFilter}
          dispatch={dispatch}
        />
      )}

      {state.people.length > 0 && (
        <div className="view-switch" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === 'gifts'}
            onClick={() => setView('gifts')}
          >
            Gifts
          </button>
          <button
            type="button"
            aria-pressed={view === 'totals'}
            onClick={() => setView('totals')}
          >
            Totals by buyer
          </button>
        </div>
      )}

      {view === 'totals' && state.people.length > 0 ? (
        <TotalsTable state={state} filter={filter} />
      ) : (
        <>
          <form className="row add-person" onSubmit={addPerson}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Who are you buying for?"
              aria-label="Person's name"
            />
            <input
              className="price"
              value={budget}
              onChange={(event) => {
                setBudget(event.target.value)
                setBudgetInvalid(false)
              }}
              placeholder="Budget £"
              inputMode="decimal"
              aria-label="Budget in pounds (optional)"
              aria-invalid={budgetInvalid}
            />
            <button type="submit">Add person</button>
          </form>
          {budgetInvalid && (
            <p className="error">
              Enter the budget as pounds, like 50 or 49.99.
            </p>
          )}

          {filtering && (
            <p className="filter-note">
              Showing gifts allocated to <strong>{filterName}</strong>.{' '}
              <button
                type="button"
                className="link"
                onClick={() => setFilter(SHOW_ALL)}
              >
                Show all
              </button>
            </p>
          )}

          {state.people.length === 0 ? (
            <div className="empty">
              <p className="empty-mark" aria-hidden="true">
                🎁
              </p>
              <p className="empty-title">No one on the list yet</p>
              <p className="muted">Add the first person you're buying for.</p>
            </div>
          ) : cards.length === 0 ? (
            <p className="muted empty-filter">Nothing matches this filter.</p>
          ) : (
            <div className="cards">
              {cards.map(({ person, gifts, visibleGifts }) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  gifts={gifts}
                  visibleGifts={visibleGifts}
                  purchasers={state.purchasers}
                  defaultPurchaserId={
                    filtering && filter !== UNASSIGNED ? filter : null
                  }
                  dispatch={dispatch}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}

export default App
