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

// Both redirects derive from the current origin. In dev, run the app on
// https://127.0.0.1:5173 (see vite.config basicSsl): Spotify rejects the
// hostname `localhost` (needs loopback IP literal) and forbids http except
// loopback; Twitch requires https. https://127.0.0.1 satisfies both.
export function spotifyRedirectUri(): string {
  return `${window.location.origin}/auth/spotify`
}
export function twitchRedirectUri(): string {
  return `${window.location.origin}/auth/twitch`
}
