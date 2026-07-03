// Admin password for server-side gated actions (weekly publish, room creation).
// NEVER hardcoded: the bundle and the repo are public. Prompted once, kept in
// localStorage on the admin's own browser; the worker's ROOM_PASSWORD secret is
// the actual gate.

const KEY = 'admin:workerPass'

export function getAdminPassword(): string | null {
  const stored = localStorage.getItem(KEY)
  if (stored) return stored
  const entered = window.prompt('Mot de passe admin (secret ROOM_PASSWORD du worker) :')
  if (!entered?.trim()) return null
  localStorage.setItem(KEY, entered.trim())
  return entered.trim()
}

/** Call after a 403 so the next attempt re-prompts. */
export function clearAdminPassword(): void {
  localStorage.removeItem(KEY)
}
