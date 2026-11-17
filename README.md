# Present Planner

A gift planner: who you're buying for, what you might get them, what it costs
against each person's budget, how far along each gift is (idea, bought,
wrapped, given), and which purchaser is responsible for buying it. A totals
view breaks spending down by purchaser for each person.

## Running it

```sh
npm install
npm run dev      # start the dev server and open the printed URL
npm test         # run the tests once
npm run build    # type-check and build for production
npm run lint
```

## How it's put together

- `src/domain/` holds the rules as plain data and pure functions, with no React
  and no storage. `planner.ts` defines people, purchasers, gifts and the
  reducer that applies every change; `money.ts` parses and formats amounts.
- `src/storage.ts` saves the whole state to the browser's `localStorage`, and
  fills in fields that older saved data doesn't have.
- `src/App.tsx` and `src/components/` are the UI.

Amounts are stored as whole pence, not pounds, so sums stay exact.

## Current limits

Data lives only in the browser it was entered in. There are no accounts and
nothing is shared between devices or people yet.
