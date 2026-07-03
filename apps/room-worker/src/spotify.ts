import type { Env, TrackHit } from './types'

// App-only Spotify auth (Client Credentials) — enough for /search, needs no
// user consent, so viewers never touch Spotify. Token cached per isolate.

let cached: { token: string; exp: number } | null = null

async function appToken(env: Env): Promise<string> {
  if (cached && Date.now() < cached.exp - 30000) return cached.token
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`spotify token ${res.status}`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 }
  return cached.token
}

// Strip "- Remastered 2011"-style noise, same intent as the SPA's cleanTitle.
function cleanTitle(t: string): string {
  return t.replace(/\s*[-–]\s*(remaster(ed)?|live|mono|stereo|version|edit)[^,]*$/i, '').trim() || t
}

export async function searchTracks(env: Env, query: string, limit = 6): Promise<TrackHit[]> {
  const q = query.trim().slice(0, 100)
  if (!q) return []
  const token = await appToken(env)
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`spotify search ${res.status}`)
  const json = (await res.json()) as { tracks?: { items: any[] } }
  return (json.tracks?.items ?? []).map((t: any): TrackHit => {
    const artists: string[] = (t.artists ?? []).map((a: any) => a.name)
    const cover: string | undefined = t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url
    return {
      trackId: t.id,
      title: cleanTitle(t.name),
      artist: artists[0] ?? null,
      ...(cover ? { cover } : {}),
    }
  })
}
