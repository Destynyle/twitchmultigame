import type { SavedBattle } from './battle-types'

// Persist the battle room (config + pool + bracket + phase) so an accidental
// reload of the admin tab doesn't wipe an in-progress tournament. Transient
// vote tallies are intentionally not saved.

const KEY = 'battle:state'

export function saveBattle(state: SavedBattle): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function loadBattle(): SavedBattle | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedBattle
    return s.v === 1 ? s : null
  } catch {
    return null
  }
}

export function clearBattle(): void {
  localStorage.removeItem(KEY)
}
