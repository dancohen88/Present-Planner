// Builds the app and serves the production build for the browser tests.
// Production, not the dev server, because only the production build has the
// service worker that lets the app start offline.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

export const PORT = 4173

async function waitForServer(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Preview server didn't start at ${url}`)
}

export default async function setup() {
  if (!existsSync('.env.local')) {
    throw new Error(
      'No .env.local. Start the database (npm run db:start) and run npm run db:env first.',
    )
  }
  execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], {
    stdio: 'inherit',
  })
  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { stdio: 'ignore', detached: true },
  )
  await waitForServer(`http://localhost:${PORT}/`)
  return () => {
    // detached + negative pid kills npx and the vite process it started.
    if (server.pid) process.kill(-server.pid)
  }
}
