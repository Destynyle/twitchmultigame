import { getSpotifyClientId, spotifyRedirectUri } from './connections'
import { cleanTitle } from './sanitize'
import type { Track } from './types'

// Spotify Authorization Code flow with PKCE — no client secret, runs in-browser.
// Only the playlist BUILDER (streamer) connects; viewers never touch Spotify.

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
// playlist-read-* for importing; user-*-playback-state to drive the desktop app
// (Connect mode). Granting playback scopes needs a reconnect for existing users.
const SCOPES =
  'playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state'
const TOKEN_KEY = 'blindtest:spotifyToken'
const VERIFIER_KEY = 'blindtest:spotifyVerifier'
const STATE_KEY = 'blindtest:spotifyState'

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
  const state = randomString(16)
  localStorage.setItem(STATE_KEY, state)
  const challenge = base64url(await sha256(verifier))
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `${AUTH_URL}?${params}`
}

export async function completeSpotifyAuth(code: string, state: string | null): Promise<void> {
  const expected = localStorage.getItem(STATE_KEY)
  localStorage.removeItem(STATE_KEY)
  if (!expected || state !== expected) throw new Error('État OAuth invalide (CSRF) — relance la connexion')
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

// ─── Connect playback (control the desktop app) ────────────────────────────────
async function playerPut(path: string, body?: unknown): Promise<void> {
  const token = await validAccessToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (res.ok || res.status === 204) return
  if (res.status === 404) {
    throw new Error("Aucun appareil Spotify actif — ouvre l'app Spotify et lance/sélectionne-la une fois")
  }
  if (res.status === 403) throw new Error('Spotify Premium requis pour piloter la lecture (mode App)')
  if (res.status === 401) throw new Error('Reconnecte Spotify (nouvelles permissions de lecture)')
  throw new Error(`Spotify lecture ${res.status}`)
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
}

export async function getDevices(): Promise<SpotifyDevice[]> {
  const j = await api<{ devices: SpotifyDevice[] }>('/me/player/devices')
  return j.devices ?? []
}

/** Start a track on the user's Spotify desktop app (full song, Premium). */
export async function playTrack(trackId: string, deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
  await playerPut(`/me/player/play${q}`, { uris: [`spotify:track:${trackId}`] })
}

export async function pausePlayback(deviceId?: string): Promise<void> {
  const q = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ''
  await playerPut(`/me/player/pause${q}`)
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

// Extract a playlist id from a pasted link/URI: open.spotify.com/playlist/<id>
// or spotify:playlist:<id> (with optional ?si=… query).
export function parsePlaylistId(input: string): string | null {
  const m = input.trim().match(/playlist[/:]([A-Za-z0-9]{22})/)
  return m ? m[1]! : null
}

// Import any (public or owned) playlist from a pasted link. Needs a connected
// Spotify token even for public playlists — the Web API rejects anonymous reads.
export async function importSpotifyPlaylistByLink(
  input: string,
): Promise<{ name: string; tracks: Track[] }> {
  const id = parsePlaylistId(input)
  if (!id) throw new Error('Lien playlist Spotify non reconnu')
  const meta = await api<{ name: string }>(`/playlists/${id}?fields=name`)
  const tracks = await importSpotifyPlaylist(id)
  return { name: meta.name || 'Playlist Spotify', tracks }
}

export interface SpotifyTrackHit {
  trackId: string
  title: string
  artist: string | null
  featurings: string[]
  cover?: string
}

// Full-text track search (Battle mode resolves a chat `!add <name>` to a song
// without anyone pasting a link — links get censored by Twitch moderation).
// Search needs only a valid user token, no extra scope.
export async function searchSpotifyTracks(query: string, limit = 5): Promise<SpotifyTrackHit[]> {
  const q = query.trim()
  if (!q) return []
  const j = await api<{ tracks?: { items: any[] } }>(
    `/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`,
  )
  return (j.tracks?.items ?? []).map((t: any): SpotifyTrackHit => {
    const artists: string[] = (t.artists ?? []).map((a: any) => a.name)
    const cover: string | undefined = t.album?.images?.[0]?.url
    return {
      trackId: t.id,
      title: cleanTitle(t.name),
      artist: artists[0] ?? null,
      featurings: artists.slice(1),
      ...(cover ? { cover } : {}),
    }
  })
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
        title: cleanTitle(t.name),
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
