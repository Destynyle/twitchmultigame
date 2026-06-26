import { cleanTitle } from './sanitize'
import type { MusicSource } from './types'

// Parse a pasted URL/ID into a MusicSource. Supports YouTube and Spotify.
export function parseSource(input: string): MusicSource | null {
  const s = input.trim()
  if (!s) return null

  // YouTube: youtu.be/<id>, youtube.com/watch?v=<id>, /embed/<id>, or bare 11-char id
  const yt =
    s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/) ||
    s.match(/^([A-Za-z0-9_-]{11})$/)
  if (yt) return { kind: 'youtube', videoId: yt[1]! }

  // Spotify: open.spotify.com/track/<id> or spotify:track:<id>
  const sp = s.match(/track[/:]([A-Za-z0-9]{22})/)
  if (sp) return { kind: 'spotify', trackId: sp[1]! }

  return null
}

// Cover/thumbnail URL for the overlay (blurred until found).
export function coverUrl(source: MusicSource): string | null {
  if (source.kind === 'youtube') {
    return `https://img.youtube.com/vi/${source.videoId}/hqdefault.jpg`
  }
  // Spotify cover requires the oEmbed/API; the embed renders its own art.
  return null
}

// Best-effort metadata fetch from a pasted URL (no API key).
// YouTube oEmbed is public and CORS-enabled; Spotify oEmbed returns title only.
export async function fetchMeta(
  source: MusicSource,
): Promise<{ title?: string; artist?: string; cover?: string }> {
  try {
    if (source.kind === 'youtube') {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${source.videoId}&format=json`,
      )
      if (!r.ok) return {}
      const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
      return { title: j.title ? cleanTitle(j.title) : undefined, artist: j.author_name, cover: j.thumbnail_url }
    }
    const r = await fetch(
      `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${source.trackId}`,
    )
    if (!r.ok) return {}
    const j = (await r.json()) as { title?: string; thumbnail_url?: string }
    return { title: j.title ? cleanTitle(j.title) : undefined, cover: j.thumbnail_url }
  } catch {
    return {}
  }
}
