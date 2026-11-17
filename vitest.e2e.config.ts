import { defineConfig } from 'vitest/config'

// Browser tests: drive the production build in headless Chromium against the
// local Supabase stack. Slow, so kept apart from the unit and database tests.
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    globalSetup: ['tests/e2e/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Each file is one story told in order, and they share one server.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
