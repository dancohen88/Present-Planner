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

### The database

Shared data lives in [Supabase](https://supabase.com) (hosted Postgres). For
development it runs locally in Docker, so Docker must be running.

```sh
npm run db:start   # start the local stack (first run downloads images)
npm run test:db    # check the access rules against the local database
npm run db:reset   # wipe the local database and re-apply the migrations
npm run db:types   # regenerate src/data/database.types.ts after a schema change
npm run db:stop
```

The schema and access rules are in `supabase/migrations/`. The local
dashboard is at http://127.0.0.1:54323 and sign-in emails are caught at
http://127.0.0.1:54324.

## How it's put together

- `src/domain/` holds the rules as plain data and pure functions, with no React
  and no storage. `planner.ts` defines people, purchasers, gifts and the
  reducer that applies every change; `money.ts` parses and formats amounts.
- `src/data/` connects the domain to the database: `rows.ts` converts rows
  to domain types and back, and `mutations.ts` turns each reducer action into
  one database write.
- `supabase/migrations/` defines the tables and the row-level security rules
  that decide who can see what, including hiding gifts from the person
  they're for.
- `src/storage.ts` saves the whole state to the browser's `localStorage`, and
  fills in fields that older saved data doesn't have.
- `src/App.tsx` and `src/components/` are the UI.

Amounts are stored as whole pence, not pounds, so sums stay exact.

## Current limits

The database layer is built and tested, but the app doesn't use it yet: data
still lives only in the browser it was entered in. Sign-in, live sync and
sharing come next.
