import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import App from './App.tsx'

// A smoke test: it proves the component tree renders without throwing when
// there is no saved data, not that the UI behaves correctly.
it('renders the empty state', () => {
  const html = renderToString(<App />)
  expect(html).toContain('Present Planner')
  expect(html).toContain('No one on the list yet')
})
