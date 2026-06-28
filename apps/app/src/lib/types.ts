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
  /** Player tied to the event (for the overlay popup); absent for system events */
  author?: string
}

/** Snapshot broadcast from Control → Overlay (read-only mirror) */
export interface GameSnapshot {
  channel: string
  status: RoundStatus
  trackIndex: number
  trackTotal: number
  /** Revealed answer (only populated when status === 'revealed') */
  reveal: { title: string; artist: string | null; featurings: string[] } | null
  /**
   * Progressive reveal for the overlay answer panel. Each field appears as its
   * scoring window closes (title/artist) or as it is found (featurings), before
   * the streamer manually reveals everything.
   */
  partial: {
    title: string | null
    artist: string | null
    /** Whether this track even has an artist target (drives a masked slot) */
    hasArtist: boolean
    /** Featurings already found (revealed immediately) */
    featurings: string[]
    /** Total featurings to find (for masked placeholder slots) */
    featuringTotal: number
  }
  coverUrl: string | null
  found: boolean
  /** Live scoring window for the overlay countdown bar (null when not playing) */
  round: { startedAt: number; windowMs: number } | null
  /** Whether the current round awards double points */
  bonus: boolean
  leaderboard: ViewerScore[]
  feed: FeedEvent[]
}
