import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { emptyState } from '../domain/planner.ts'
import type { PlannerState } from '../domain/planner.ts'
import { PlannerView } from './PlannerView.tsx'

// Smoke tests: they prove the view renders without throwing, not that the UI
// behaves correctly.
const noop = () => {}

it('renders the empty state', () => {
  const html = renderToString(
    <PlannerView
      state={emptyState}
      dispatch={noop}
      readOnly={false}
      members={[]}
      myUserId="u1"
    />,
  )
  expect(html).toContain('No one on the list yet')
})

it('disables editing while read-only, but still shows the gifts', () => {
  const state: PlannerState = {
    people: [{ id: 'p1', name: 'Mum', budgetPence: null, memberUserId: null }],
    purchasers: [],
    gifts: [
      {
        id: 'g1',
        personId: 'p1',
        title: 'Cookbook',
        pricePence: 2200,
        status: 'idea',
        purchaserId: null,
      },
    ],
  }
  const html = renderToString(
    <PlannerView
      state={state}
      dispatch={noop}
      readOnly={true}
      members={[]}
      myUserId="u1"
    />,
  )
  expect(html).toContain('Cookbook')
  expect(html).toMatch(/<fieldset class="edit-area[^"]*" disabled=""/)
})
