// Wire types shared with the SPA (apps/app/src/lib/room-api.ts mirrors these).

export interface RoomConfig {
  theme: string
  maxPerUser: number
  maxTotal: number
}

export interface RoomSubmission {
  id: string
  trackId: string
  title: string
  artist: string | null
  cover?: string
  /** Viewer-chosen display name. */
  name: string
  /** Anonymous browser id (per-user cap; not a real identity). */
  clientId: string
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
  /** Submissions made by the requesting clientId. */
  mine: Array<Pick<RoomSubmission, 'id' | 'title' | 'artist' | 'cover'>>
}

export interface Env {
  ROOMS: DurableObjectNamespace
  ROOM_PASSWORD: string
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
}
