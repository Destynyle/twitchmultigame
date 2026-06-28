import type { ViewerScore, FeedEvent } from './types'

// Mid-game state persistence so an accidental reload of /control doesn't wipe
// the leaderboard. Scoped to channel + playlist; only restored on an exact match.

const KEY = 'blindtest:session'

export interface SavedSession {
  v: 1
  channel: string
  playlistId: string
  scores: ViewerScore[]
  streakIn: [string, number][]
  index: number
  feed: FeedEvent[]
  bonus: boolean
}

export function saveSession(s: SavedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Quota or serialization failure — non-fatal, the game keeps running in-memory.
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedSession
    return s.v === 1 ? s : null
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}
