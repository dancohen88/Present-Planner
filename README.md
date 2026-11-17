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
npm run db:env     # point the app at it (writes .env.local), then npm run dev
npm run test:db    # check the access rules against the local database
npm run db:reset   # wipe the local database and re-apply the migrations
npm run db:types   # regenerate src/data/database.types.ts after a schema change
npm run db:stop
```

The schema and access rules are in `supabase/migrations/`. The local
dashboard is at http://127.0.0.1:54323. Sign-in emails, with their 6-digit
codes, are caught at http://127.0.0.1:54324 rather than sent.

## How it's put together

- `src/domain/` holds the rules as plain data and pure functions, with no React
  and no storage. `planner.ts` defines people, purchasers, gifts and the
  reducer that applies every change; `money.ts` parses and formats amounts.
- `src/data/` connects the domain to the database: `rows.ts` converts rows
  to domain types and back, `mutations.ts` turns each reducer action into
  one database write, and `usePlannerSync.ts` keeps an open plan in sync:
  changes show at once, are written to the database, and other members'
  changes stream in live.
- `src/auth/` is sign-in by emailed code. `src/plans/` lists, creates and
  switches plans, and handles members, invite links and joining.
- `src/routing/` reads the screen from the part of the address after `#`
  (`#/plan/<id>`, `#/join/<token>`), which works on any static host.
- `supabase/migrations/` defines the tables and the row-level security rules
  that decide who can see what, including hiding gifts from the person
  they're for.
- `src/storage.ts` keeps a copy of each plan in the browser, so the last
  synced list can be read offline.
- `src/App.tsx` and `src/components/` are the UI.

Amounts are stored as whole pence, not pounds, so sums stay exact.

## Current limits

Editing needs a connection; offline, the last synced copy is read-only. If a
card is linked to someone while they have the plan open, they keep seeing
what was already on it until their app next reloads the plan; nothing added
afterwards reaches them. The app isn't installable or hosted yet.
