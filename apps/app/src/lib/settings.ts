// Global, machine-local game settings: scoring-window duration and overlay theme.
// All client-side; persisted in localStorage like everything else.

const WINDOW_KEY = 'blindtest:windowMs'
const THEME_KEY = 'blindtest:theme'

// ─── Scoring window ───────────────────────────────────────────────────────────
const DEFAULT_WINDOW_MS = 5000
const MIN_WINDOW_MS = 2000
const MAX_WINDOW_MS = 30000

/** Default scoring-window duration (ms). A track may still override per-track. */
export function getWindowMs(): number {
  const v = Number(localStorage.getItem(WINDOW_KEY))
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_WINDOW_MS
}

export function setWindowMs(ms: number): void {
  const clamped = Math.min(MAX_WINDOW_MS, Math.max(MIN_WINDOW_MS, Math.round(ms)))
  localStorage.setItem(WINDOW_KEY, String(clamped))
}

// ─── Themes ─────────────────────────────────────────────────────────────────--
export interface ThemeDef {
  id: string
  name: string
  emoji: string
}

// Visual styling lives in index.css keyed by `body[data-theme="<id>"]`.
export const THEMES: ThemeDef[] = [
  { id: 'midnight', name: 'Minuit', emoji: '🌃' },
  { id: 'petit-prince', name: 'Le Petit Prince', emoji: '🌹' },
]

export function getTheme(): string {
  const id = localStorage.getItem(THEME_KEY) || 'midnight'
  return THEMES.some((t) => t.id === id) ? id : 'midnight'
}

export function setTheme(id: string): void {
  localStorage.setItem(THEME_KEY, id)
  applyTheme(id)
}

/** Set the active theme on <body> so the CSS variables take effect. */
export function applyTheme(id: string): void {
  document.body.dataset.theme = id
}
