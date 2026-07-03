import { getTwitchClientId, twitchRedirectUri } from './connections'

// Twitch login via OAuth implicit grant (token in URL fragment). Twitch does not
// support PKCE for public clients, so implicit is the zero-backend path. Fills the
// streamer's channel name and, with the chat scopes, lets the app POST feedback
// messages (battle `!add` confirmations) — chat reading stays anonymous.

const AUTH_URL = 'https://id.twitch.tv/oauth2/authorize'
const TOKEN_KEY = 'blindtest:twitchToken'
const LOGIN_KEY = 'blindtest:twitchLogin'
const SCOPES_KEY = 'blindtest:twitchScopes'
const STATE_KEY = 'blindtest:twitchState'

// chat:read is required by IRC auth even for a write-mostly connection.
const SCOPES = 'chat:read chat:edit'

function randomState(): string {
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => ('0' + b.toString(16)).slice(-2)).join('')
}

export function beginTwitchAuth(): void {
  const clientId = getTwitchClientId()
  if (!clientId) throw new Error('Twitch client_id manquant (Réglages)')
  const state = randomState()
  localStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: twitchRedirectUri(),
    response_type: 'token',
    scope: SCOPES,
    state,
  })
  window.location.href = `${AUTH_URL}?${params}`
}

// Called on the /auth/twitch callback. Reads the token from the URL fragment,
// resolves the channel login, and persists it.
export async function completeTwitchAuth(fragment: string): Promise<string> {
  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const expected = localStorage.getItem(STATE_KEY)
  localStorage.removeItem(STATE_KEY)
  if (!expected || params.get('state') !== expected) {
    throw new Error('État OAuth invalide (CSRF) — relance la connexion')
  }
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
  localStorage.setItem(LOGIN_KEY, login)
  // The fragment echoes back the scopes actually granted (space-separated).
  localStorage.setItem(SCOPES_KEY, params.get('scope') ?? '')
  return login
}

export function isTwitchConnected(): boolean {
  return !!localStorage.getItem(TOKEN_KEY)
}

export interface ChatCredentials {
  login: string
  token: string
}

/** IRC write credentials, or null when not connected / connected without the
 *  chat scopes (older login — a reconnect re-prompts with the new scopes). */
export function getChatCredentials(): ChatCredentials | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const login = localStorage.getItem(LOGIN_KEY)
  const scopes = (localStorage.getItem(SCOPES_KEY) ?? '').split(' ')
  if (!token || !login || !scopes.includes('chat:edit')) return null
  return { login, token }
}

/** Connected, but with a pre-chat-scopes token — surfaced as a reconnect hint. */
export function needsChatReconnect(): boolean {
  return isTwitchConnected() && getChatCredentials() === null
}
