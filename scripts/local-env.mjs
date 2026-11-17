// Writes .env.local with the running local Supabase stack's URL and public
// key, so `npm run dev` talks to it. Usage: npm run db:env
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const status = JSON.parse(
  execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
  }),
)
const lines = [
  '# Written by `npm run db:env` for the local Supabase stack. Not committed.',
  `VITE_SUPABASE_URL=${status.API_URL}`,
  `VITE_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
  '',
]
writeFileSync(new URL('../.env.local', import.meta.url), lines.join('\n'))
console.log('Wrote .env.local for', status.API_URL)
