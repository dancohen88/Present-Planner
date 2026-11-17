import { defineConfig } from 'vitest/config'

// Runs against the local Supabase stack (`npx supabase start`). Kept apart
// from the unit tests because it needs Docker and takes seconds, not
// milliseconds.
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // One file at a time: tests create real users and rows.
    fileParallelism: false,
  },
})
