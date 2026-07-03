import type { MusicSource } from './types'
import type { Bracket } from '@playground/game-engine'

// ─── Battle mode (zero-back music tournament) ─────────────────────────────────

/** A song in the tournament pool. Resolved from a chat `!add <name>` via Spotify
 *  search, or added manually by the admin. */
export interface BattleEntry {
  id: string
  title: string
  artist: string | null
  source: MusicSource
  coverUrl?: string
  /** Twitch display name of the submitter (admin-added = 'admin'). */
  submittedBy: string
}

export interface BattleConfig {
  /** Theme announced to chat (e.g. "Sons de jeux vidéo"). */
  theme: string
  /** Max number of songs that enter the bracket (excess is trimmed at seed). */
  maxTotal: number
  /** Max submissions accepted per viewer during the lobby. */
  maxPerUser: number
  /** Default vote duration in seconds. */
  voteSec: number
}

export type BattlePhase = 'lobby' | 'bracket' | 'done'

/** Overlay-facing view of one contestant (no source/internal ids). */
export interface BattleSideView {
  title: string
  artist: string | null
  coverUrl: string | null
  submittedBy: string | null
}

/** A counted vote, surfaced as a floating `+pseudo` popup on the overlay. */
export interface BattleVoteFeed {
  id: string
  user: string
  side: 'a' | 'b'
  /** True when this message changed an existing vote rather than adding one. */
  changed: boolean
}

/** Read-only mirror broadcast Admin → Overlay. */
export interface BattleSnapshot {
  channel: string
  phase: BattlePhase
  theme: string
  pool: { count: number; max: number }
  match: {
    a: BattleSideView
    b: BattleSideView
    roundLabel: string
    /** 1-based match number within its round (for "Match 2/4"). */
    matchInRound: number
    matchesInRound: number
  } | null
  vote: {
    open: boolean
    startedAt: number
    durationMs: number
    a: number
    b: number
  } | null
  /** Winning side of the just-closed match (highlight before advancing). */
  lastWinner: 'a' | 'b' | null
  champion: BattleSideView | null
  feed: BattleVoteFeed[]
  /** Web submission room, when one is open (shown on the lobby overlay). */
  room: { code: string; url: string } | null
}

/** Persisted battle state (survives an accidental admin reload). */
export interface SavedBattle {
  v: 1
  channel: string
  config: BattleConfig
  entries: BattleEntry[]
  phase: BattlePhase
  bracket: Bracket | null
}
