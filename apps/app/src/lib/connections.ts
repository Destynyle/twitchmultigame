// Client-side OAuth config. Only public client IDs live here (no secrets) —
// Spotify uses PKCE, Twitch uses implicit grant. Both run fully in the browser.

const SPOTIFY_CLIENT_KEY = 'blindtest:spotifyClientId'
const TWITCH_CLIENT_KEY = 'blindtest:twitchClientId'

export function getSpotifyClientId(): string {
  return (
    localStorage.getItem(SPOTIFY_CLIENT_KEY) ||
    (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ||
    ''
  )
}
export function setSpotifyClientId(id: string): void {
  localStorage.setItem(SPOTIFY_CLIENT_KEY, id.trim())
}

export function getTwitchClientId(): string {
  return (
    localStorage.getItem(TWITCH_CLIENT_KEY) ||
    (import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined) ||
    ''
  )
}
export function setTwitchClientId(id: string): void {
  localStorage.setItem(TWITCH_CLIENT_KEY, id.trim())
}

// Both redirects derive from origin + base path. In dev (base '/') on
// https://127.0.0.1:5173 — Spotify rejects the hostname `localhost` (needs the
// loopback IP literal) and forbids http except loopback; Twitch requires https,
// so https://127.0.0.1 satisfies both. In prod (GitHub Pages, base '/<repo>/')
// the redirect becomes https://<user>.github.io/<repo>/auth/...
function appUrl(path: string): string {
  // BASE_URL has a trailing slash ('/' or '/twitchmultigame/').
  return `${window.location.origin}${import.meta.env.BASE_URL}${path}`
}
export function spotifyRedirectUri(): string {
  return appUrl('auth/spotify')
}
export function twitchRedirectUri(): string {
  return appUrl('auth/twitch')
}
