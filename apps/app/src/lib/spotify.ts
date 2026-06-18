import { getSpotifyClientId, spotifyRedirectUri } from './connections'
import type { Track } from './types'

// Spotify Authorization Code flow with PKCE — no client secret, runs in-browser.
// Only the playlist BUILDER (streamer) connects; viewers never touch Spotify.

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SCOPES = 'playlist-read-private playlist-read-collaborative'
const TOKEN_KEY = 'blindtest:spotifyToken'
const VERIFIER_KEY = 'blindtest:spotifyVerifier'

interface StoredToken {
  access_token: string
  refresh_token?: string
  expires_at: number
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function randomString(len: number): string {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => ('0' + b.toString(16)).slice(-2)).join('')
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
}

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function beginSpotifyAuth(): Promise<void> {
  const clientId = getSpotifyClientId()
  if (!clientId) throw new Error('Spotify client_id manquant (Réglages)')
  const verifier = randomString(64)
  localStorage.setItem(VERIFIER_KEY, verifier)
  const challenge = base64url(await sha256(verifier))
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `${AUTH_URL}?${params}`
}

export async function completeSpotifyAuth(code: string): Promise<void> {
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('PKCE verifier introuvable')
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: spotifyRedirectUri(),
    client_id: getSpotifyClientId(),
    code_verifier: verifier,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Échange token Spotify échoué (${res.status})`)
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  storeToken(json)
  localStorage.removeItem(VERIFIER_KEY)
}

function storeToken(json: { access_token: string; refresh_token?: string; expires_in: number }): void {
  const tok: StoredToken = {
    access_token: json.access_token,
    ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
    expires_at: Date.now() + json.expires_in * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tok))
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    return null
  }
}

export function isSpotifyConnected(): boolean {
  return readToken() !== null
}

export function disconnectSpotify(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function validAccessToken(): Promise<string> {
  const tok = readToken()
  if (!tok) throw new Error('Spotify non connecté')
  if (Date.now() < tok.expires_at - 30000) return tok.access_token
  // Refresh
  if (!tok.refresh_token) throw new Error('Session Spotify expirée, reconnecte-toi')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tok.refresh_token,
      client_id: getSpotifyClientId(),
    }),
  })
  if (!res.ok) throw new Error('Refresh Spotify échoué')
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  storeToken({ ...json, refresh_token: json.refresh_token ?? tok.refresh_token })
  return json.access_token
}

async function api<T>(path: string): Promise<T> {
  const token = await validAccessToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Spotify API ${res.status}`)
  return res.json() as Promise<T>
}

// ─── Data ─────────────────────────────────────────────────────────────────────
export interface SpotifyPlaylistRef {
  id: string
  name: string
  total: number
}

export async function fetchMyPlaylists(): Promise<SpotifyPlaylistRef[]> {
  const out: SpotifyPlaylistRef[] = []
  let url: string | null = '/me/playlists?limit=50'
  while (url) {
    const page: { items: any[]; next: string | null } = await api(url)
    for (const p of page.items) out.push({ id: p.id, name: p.name, total: p.tracks?.total ?? 0 })
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null
  }
  return out
}

export async function importSpotifyPlaylist(playlistId: string): Promise<Track[]> {
  const tracks: Track[] = []
  let url: string | null = `/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,name,artists(name),album(images)))`
  while (url) {
    const page: { items: any[]; next: string | null } = await api(url)
    for (const it of page.items) {
      const t = it.track
      if (!t?.id) continue
      const artists: string[] = (t.artists ?? []).map((a: any) => a.name)
      const cover: string | undefined = t.album?.images?.[0]?.url
      tracks.push({
        id: crypto.randomUUID(),
        title: t.name,
        artist: artists[0] ?? null,
        featurings: artists.slice(1),
        malusTerms: [],
        source: { kind: 'spotify', trackId: t.id },
        ...(cover ? { coverUrl: cover } : {}),
      })
    }
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null
  }
  return tracks
}
