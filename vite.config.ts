/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Makes the app installable (a web manifest) and able to open without a
    // connection (a service worker that caches the app's own files). Plan
    // data isn't cached here: the app keeps its own copy of each plan.
    VitePWA({
      // A new version installs in the background and takes over on the next
      // launch, so nobody has to clear a cache by hand.
      registerType: 'autoUpdate',
      manifest: {
        name: 'Present Planner',
        short_name: 'Presents',
        description:
          'Plan gifts with your family: ideas, budgets and who is buying what.',
        theme_color: '#a3293d',
        background_color: '#f7f2ea',
        display: 'standalone',
        // Relative, so the app works wherever it's hosted (e.g. under
        // /Present-Planner/ on GitHub Pages).
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Every screen is index.html plus a #route, so serve it for any
        // navigation while offline.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    // Fast tests only: no network, no Docker. The database tests live in
    // tests/db and the browser tests in tests/e2e; they run separately.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
