import type { Playlist, Track } from './types'
import { cleanTitle } from './sanitize'

const PLAYLISTS_KEY = 'blindtest:playlists'
const CHANNEL_KEY = 'blindtest:channel'

// Re-sanitize titles on the way in so playlists imported before the sanitizer
// existed (or hand-edited) get cleaned too — not just fresh imports.
function sanitizePlaylist(p: Playlist): Playlist {
  return { ...p, tracks: p.tracks.map((t) => ({ ...t, title: cleanTitle(t.title) })) }
}

export function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(PLAYLISTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Playlist[]).map(sanitizePlaylist) : []
  } catch {
    return []
  }
}

export function savePlaylists(playlists: Playlist[]): void {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
}

/** Patch one track (by id) across all playlists and persist. */
export function updateTrack(
  trackId: string,
  patch: Partial<Pick<Track, 'title' | 'artist' | 'featurings' | 'malusTerms'>>,
): void {
  const playlists = loadPlaylists()
  let changed = false
  for (const p of playlists) {
    for (const t of p.tracks) {
      if (t.id === trackId) {
        Object.assign(t, patch)
        changed = true
      }
    }
  }
  if (changed) savePlaylists(playlists)
}

export function loadChannel(): string {
  return localStorage.getItem(CHANNEL_KEY) ?? ''
}

export function saveChannel(channel: string): void {
  localStorage.setItem(CHANNEL_KEY, channel.trim().toLowerCase())
}

export function exportPlaylist(playlist: Playlist): void {
  const blob = new Blob([JSON.stringify(playlist, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${playlist.name.replace(/\s+/g, '-').toLowerCase() || 'playlist'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parsePlaylistFile(text: string): Playlist {
  const obj = JSON.parse(text) as Playlist
  if (!obj.tracks || !Array.isArray(obj.tracks)) throw new Error('Fichier playlist invalide')
  return sanitizePlaylist({
    id: obj.id || crypto.randomUUID(),
    name: obj.name || 'Importée',
    tracks: obj.tracks,
  })
}
