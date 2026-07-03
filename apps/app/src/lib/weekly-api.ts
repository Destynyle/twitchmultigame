import { workerReq } from './room-api'
import type { Track, ViewerScore } from './types'

// Client for the "blindtest de la semaine" endpoints (apps/room-worker).
// Trust model: the week's tracks (answers included) are served to the host —
// the streamer animates without playing.

export interface WeeklyWeek {
  id: string
  theme: string
  tracks: Array<Omit<Track, 'id'>>
  publishedAt: number
}

export interface WeeklyScore {
  username: string
  displayName: string
  points: number
}

export interface WeeklyLeaderboard {
  id: string
  theme: string
  trackCount: number
  publishedAt: number
  channels: Array<{ channel: string; top: WeeklyScore[]; players: number; at: number }>
  global: Array<WeeklyScore & { channel: string }>
}

export function getWeekly(): Promise<WeeklyWeek> {
  return workerReq('/weekly')
}

export function getWeeklyLeaderboard(): Promise<WeeklyLeaderboard> {
  return workerReq('/weekly/leaderboard')
}

/** Publish the given playlist as the new week (admin — server-checked password).
 *  Replaces the current week and clears all channel results. */
export function publishWeekly(
  password: string,
  theme: string,
  tracks: Track[],
): Promise<{ ok: true; id: string; trackCount: number }> {
  return workerReq('/weekly', {
    method: 'POST',
    body: JSON.stringify({
      password,
      theme,
      tracks: tracks.map(({ id: _id, ...t }) => t),
    }),
  })
}

/** Push a finished run's leaderboard (streamer identity = verified Twitch token). */
export function pushWeeklyResults(
  weekId: string,
  twitchToken: string,
  leaderboard: ViewerScore[],
): Promise<{ ok: true }> {
  return workerReq('/weekly/results', {
    method: 'POST',
    body: JSON.stringify({
      id: weekId,
      twitchToken,
      players: leaderboard.length,
      leaderboard: leaderboard.map(({ username, displayName, points }) => ({
        username,
        displayName,
        points,
      })),
    }),
  })
}
