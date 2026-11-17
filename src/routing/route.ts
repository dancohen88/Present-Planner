import { useCallback, useSyncExternalStore } from 'react'

// Screens are addressed by the part of the URL after "#", e.g.
// "#/plan/<id>". Static hosts like GitHub Pages never see that part, so a
// shared link always loads index.html and the app picks the screen.

export type Route =
  | { name: 'home' }
  | { name: 'plan'; planId: string }
  | { name: 'join'; token: string }
  | { name: 'new-plan' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseRoute(hash: string): Route {
  const [kind, id] = hash.replace(/^#\/?/, '').split('/')
  if (kind === 'plan' && id && UUID.test(id))
    return { name: 'plan', planId: id }
  if (kind === 'join' && id) return { name: 'join', token: id }
  if (kind === 'new') return { name: 'new-plan' }
  return { name: 'home' }
}

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

export const paths = {
  home: '#/',
  plan: (planId: string) => `#/plan/${planId}`,
  join: (token: string) => `#/join/${token}`,
  newPlan: '#/new',
}

/** A full link someone else can open, e.g. for an invite. */
export function shareableUrl(path: string): string {
  return `${location.origin}${location.pathname}${path}`
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/**
 * The current route, re-rendering when the hash changes.
 * useSyncExternalStore is React's way to read a value that lives outside
 * React (here, the browser's address bar) without tearing.
 */
export function useRoute(): [Route, (path: string) => void] {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  const navigate = useCallback((path: string) => {
    location.hash = path
  }, [])
  return [parseRoute(hash), navigate]
}
