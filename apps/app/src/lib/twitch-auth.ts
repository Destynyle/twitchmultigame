import { getTwitchClientId, twitchRedirectUri } from './connections'

// Twitch login via OAuth implicit grant (token in URL fragment). Twitch does not
// support PKCE for public clients, so implicit is the zero-backend path. Used only
// to auto-fill the streamer's channel name — chat reading stays anonymous.

const AUTH_URL = 'https://id.twitch.tv/oauth2/authorize'
const TOKEN_KEY = 'blindtest:twitchToken'

export function beginTwitchAuth(): void {
  const clientId = getTwitchClientId()
  if (!clientId) throw new Error('Twitch client_id manquant (Réglages)')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: twitchRedirectUri(),
    response_type: 'token',
    scope: '',
  })
  window.location.href = `${AUTH_URL}?${params}`
}

// Called on the /auth/twitch callback. Reads the token from the URL fragment,
// resolves the channel login, and persists it.
export async function completeTwitchAuth(fragment: string): Promise<string> {
  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const token = params.get('access_token')
  if (!token) throw new Error('Token Twitch absent')
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': getTwitchClientId() },
  })
  if (!res.ok) throw new Error(`Twitch API ${res.status}`)
  const json = (await res.json()) as { data: { login: string }[] }
  const login = json.data[0]?.login
  if (!login) throw new Error('Impossible de lire la chaîne Twitch')
  localStorage.setItem(TOKEN_KEY, token)
  return login
}

export function isTwitchConnected(): boolean {
  return !!localStorage.getItem(TOKEN_KEY)
}
