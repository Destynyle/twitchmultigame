// Wire types shared with the SPA (apps/app/src/lib/room-api.ts mirrors these).

export interface RoomConfig {
  theme: string
  maxPerUser: number
  maxTotal: number
  /** Reject submissions without a verified Twitch session. */
  requireTwitch: boolean
}

/** Same shape as the SPA's MusicSource — flows straight into the pool. */
export type SubmissionSource =
  | { kind: 'spotify'; trackId: string }
  | { kind: 'youtube'; videoId: string }

export interface RoomSubmission {
  id: string
  source: SubmissionSource
  title: string
  artist: string | null
  cover?: string
  /** Display name — the verified Twitch name when a token was provided. */
  name: string
  /** Anonymous browser id (fallback per-user cap; not a real identity). */
  clientId: string
  /** Twitch user id when the submission was made with a verified session. */
  twitchId?: string
  at: number
}

export interface TrackHit {
  trackId: string
  title: string
  artist: string | null
  cover?: string
}

/** Viewer-facing room state (GET /rooms/:code). */
export interface RoomView {
  code: string
  open: boolean
  theme: string
  maxPerUser: number
  count: number
  maxTotal: number
  /** Twitch app viewers authenticate against (null = Twitch login disabled). */
  twitchClientId: string | null
  requireTwitch: boolean
  /** Submissions made by the requesting clientId. */
  mine: Array<Pick<RoomSubmission, 'id' | 'title' | 'artist' | 'cover'>>
}

export interface Env {
  ROOMS: DurableObjectNamespace
  ROOM_PASSWORD: string
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
  /** Optional — enables viewer Twitch login on room pages. */
  TWITCH_CLIENT_ID?: string
}
