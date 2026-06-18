// ─── Music source ───────────────────────────────────────────────────────────
export type MusicSource =
  | { kind: 'youtube'; videoId: string }
  | { kind: 'spotify'; trackId: string }

// ─── Track / Playlist (client-side config) ──────────────────────────────────
export interface Track {
  id: string
  title: string
  /** null = single-target (title only); set = double-shot (title + artist) */
  artist: string | null
  featurings: string[]
  malusTerms: string[]
  source: MusicSource
  /** Album/cover art URL (Spotify has no derivable cover from the id alone) */
  coverUrl?: string
  /** Optional per-track scoring window override (ms) */
  windowMs?: number
}

export interface Playlist {
  id: string
  name: string
  tracks: Track[]
}

// ─── Live game state ─────────────────────────────────────────────────────────
export type RoundStatus = 'idle' | 'playing' | 'revealed'

export interface ViewerScore {
  username: string
  displayName: string
  points: number
  streak: number
}

export type FeedKind = 'found' | 'malus' | 'featuring' | 'streak' | 'system'

export interface FeedEvent {
  id: string
  kind: FeedKind
  text: string
  at: number
}

/** Snapshot broadcast from Control → Overlay (read-only mirror) */
export interface GameSnapshot {
  channel: string
  status: RoundStatus
  trackIndex: number
  trackTotal: number
  /** Revealed answer (only populated when status === 'revealed') */
  reveal: { title: string; artist: string | null; featurings: string[] } | null
  coverUrl: string | null
  found: boolean
  leaderboard: ViewerScore[]
  feed: FeedEvent[]
}
