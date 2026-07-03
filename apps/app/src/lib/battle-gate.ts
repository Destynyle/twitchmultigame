// Password gate for the work-in-progress Battle mode.
//
// NOTE: this is obscurity, not security. Everything ships in the static bundle,
// so anyone reading the JS can bypass it. Its only job is to keep the unfinished
// mode out of the way of casual visitors until it's polished. Real per-room
// authorization would require a backend (deliberately avoided here).

const KEY = 'battle:unlocked'
// Also sent as the room-creation password (worker checks it against its
// ROOM_PASSWORD secret). Still shipped in the bundle, so still obscurity —
// change the worker secret to something private to truly lock room creation.
export const PASSWORD = 'desty'

export function isBattleUnlocked(): boolean {
  return localStorage.getItem(KEY) === '1'
}

export function tryUnlock(pw: string): boolean {
  if (pw.trim().toLowerCase() === PASSWORD) {
    localStorage.setItem(KEY, '1')
    return true
  }
  return false
}

export function lockBattle(): void {
  localStorage.removeItem(KEY)
}
