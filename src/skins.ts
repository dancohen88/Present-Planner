import { loadSkinId } from './storage.ts'

// A skin is just a name. All the styling lives in index.css under
// :root[data-skin='…'], where each skin swaps the design tokens (the --bg,
// --text, --accent… custom properties) that every component already uses.
// That is the "theming with CSS custom properties" pattern: no component knows
// which skin is on.

export const SKINS = [
  // themeColor tints the phone's status bar; null keeps index.html's own.
  { id: 'classic', label: 'Classic', icon: '🎁', themeColor: null },
  { id: 'snow', label: 'Snow scene', icon: '❄️', themeColor: '#c3d8ea' },
  { id: 'workshop', label: "Elves' workshop", icon: '🧝', themeColor: '#f1e2c8' },
  { id: 'diehard', label: 'Die Hard', icon: '💥', themeColor: '#090c12' },
] as const

export type SkinId = (typeof SKINS)[number]['id']

export function isSkinId(value: unknown): value is SkinId {
  return SKINS.some((skin) => skin.id === value)
}

/** The skin saved on this device, or Classic. */
export function savedSkin(): SkinId {
  const id = loadSkinId()
  return isSkinId(id) ? id : 'classic'
}

export function applySkin(id: SkinId): void {
  const root = document.documentElement
  if (id === 'classic') delete root.dataset.skin
  else root.dataset.skin = id

  const { themeColor } = SKINS.find((skin) => skin.id === id)!
  const metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  for (const meta of metas) {
    // Remember index.html's light/dark colours so Classic can put them back.
    meta.dataset.original ??= meta.content
    meta.content = themeColor ?? meta.dataset.original
  }
}
