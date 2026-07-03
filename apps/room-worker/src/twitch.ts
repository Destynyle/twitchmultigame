// Verified Twitch identity from a viewer/streamer access token.
// validate → login/user_id (any valid token), Helix → display name (best effort).

export interface TwitchIdentity {
  userId: string
  login: string
  displayName: string
}

// Module-level cache (per isolate) — 5 min freshness is plenty.
const cache = new Map<string, { id: TwitchIdentity; exp: number }>()

/** Returns null when the token is invalid/expired, or (when `expectedClientId`
 *  is set) minted for another app. */
export async function validateTwitchToken(
  token: string,
  expectedClientId?: string,
): Promise<TwitchIdentity | null> {
  const cached = cache.get(token)
  if (cached && Date.now() < cached.exp) return cached.id
  const v = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` },
  })
  if (!v.ok) return null
  const j = (await v.json()) as { login?: string; user_id?: string; client_id?: string }
  if (!j.user_id || !j.login) return null
  if (expectedClientId && j.client_id !== expectedClientId) return null
  let displayName = j.login
  try {
    const u = await fetch('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': j.client_id! },
    })
    if (u.ok) {
      const uj = (await u.json()) as { data?: { display_name?: string }[] }
      displayName = uj.data?.[0]?.display_name || j.login
    }
  } catch {
    // keep login
  }
  const id: TwitchIdentity = { userId: j.user_id, login: j.login, displayName }
  cache.set(token, { id, exp: Date.now() + 5 * 60000 })
  return id
}
