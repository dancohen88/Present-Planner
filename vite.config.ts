/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Fast tests only: no network, no Docker. The database tests live in
    // tests/db and run separately with `npm run test:db`.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
