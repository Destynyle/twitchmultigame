import Redis from 'ioredis'
import { withTenantContext } from '@playground/db'
import { sessions, sessionScores, tracks } from '@playground/db/schema'
import { eq, desc } from 'drizzle-orm'
import type { GamePlugin, ScoringEvent } from '@playground/game-types'
import type { IChatConnection } from './connections/IChatConnection'
import { logger } from './logger'

type PluginWithTrack = GamePlugin & {
  setCurrentTrack(title: string, artist: string | null): void
}

interface LeaderboardEntry {
  username: string
  displayName: string
  score: number
}

interface BotSessionParams {
  sessionId: string
  tenantId: string
  twitchLogin: string
  plugin: PluginWithTrack
  connection: IChatConnection
  redisUrl: string
}

export class BotSession {
  private readonly sessionId: string
  private readonly tenantId: string
  private readonly plugin: PluginWithTrack
  private readonly connection: IChatConnection
  private readonly redisUrl: string

  private publisher: Redis | null = null
  private subscriber: Redis | null = null
  private currentTrackTitle = ''
  private currentTrackArtist: string | null = null
  private stopped = false

  constructor(params: BotSessionParams) {
    this.sessionId = params.sessionId
    this.tenantId = params.tenantId
    this.plugin = params.plugin
    this.connection = params.connection
    this.redisUrl = params.redisUrl
  }

  async start(): Promise<void> {
    logger.info({ sessionId: this.sessionId }, 'BotSession starting')

    // 1. Load session + tracks from DB
    const sessionRow = await withTenantContext(this.tenantId, async (tx) => {
      const [s] = await tx.select().from(sessions).where(eq(sessions.id, this.sessionId))
      return s ?? null
    })

    if (!sessionRow) {
      throw new Error(`Session ${this.sessionId} not found`)
    }

    const playlistId = sessionRow.playlistId
    let trackList: Array<{ title: string; artist: string | null; position: number }> = []

    if (playlistId) {
      trackList = await withTenantContext(this.tenantId, async (tx) => {
        return tx
          .select({ title: tracks.title, artist: tracks.artist, position: tracks.position })
          .from(tracks)
          .where(eq(tracks.playlistId, playlistId))
          .orderBy(tracks.position)
      })
    }

    const currentIndex = sessionRow.currentTrackIndex
    const currentTrack = trackList[currentIndex] ?? null

    this.currentTrackTitle = currentTrack?.title ?? ''
    this.currentTrackArtist = currentTrack?.artist ?? null

    // 2. Connect to chat
    await this.connection.connect()

    // 3. Create Redis clients
    this.publisher = new Redis(this.redisUrl)
    this.subscriber = new Redis(this.redisUrl)

    // 4. Register chat message handler
    this.connection.onMessage(async (_channel, username, displayName, text) => {
      await this.handleChatMessage(username, displayName, text)
    })

    // 4b. Register disconnect/reconnect handlers for bot status tracking
    this.connection.onDisconnect?.(() => {
      logger.info({ sessionId: this.sessionId }, 'Chat disconnected — marking reconnecting')
      void this.setBotStatus('reconnecting')
    })

    this.connection.onReconnect?.(() => {
      logger.info({ sessionId: this.sessionId }, 'Chat reconnected — session continues')
      void this.setBotStatus('connected')
      void this.publishSystemEvent('reconnected')
    })

    // 5. Subscribe to session command channel
    await this.subscriber.subscribe(`session:cmd:${this.sessionId}`)
    this.subscriber.on('message', (_channel: string, message: string) => {
      void this.handleCommand(message)
    })

    // 6. Init plugin — onSessionStart first (may reset state), then set current track
    await this.plugin.onSessionStart({
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      gameType: sessionRow.gameType,
      ...(playlistId ? { playlistId } : {}),
    })
    this.plugin.setCurrentTrack(this.currentTrackTitle, this.currentTrackArtist)

    // 7. Publish initial overlay state
    await this.publishState('active', [])

    // 8. Mark bot as connected in Redis for admin monitoring
    await this.setBotStatus('connected')

    logger.info({ sessionId: this.sessionId }, 'BotSession started')
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true

    logger.info({ sessionId: this.sessionId }, 'BotSession stopping')

    // Remove bot status key (session is intentionally ending)
    if (this.publisher) {
      await this.publisher.del(`bot:status:${this.sessionId}`).catch(() => {})
    }

    try {
      await this.connection.disconnect()
    } catch (e) {
      logger.error({ err: e }, 'Error disconnecting chat connection')
    }

    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe()
        this.subscriber.disconnect()
      } catch (e) {
        logger.error({ err: e }, 'Error disconnecting Redis subscriber')
      }
    }

    if (this.publisher) {
      try {
        this.publisher.disconnect()
      } catch (e) {
        logger.error({ err: e }, 'Error disconnecting Redis publisher')
      }
    }
  }

  private async handleChatMessage(username: string, displayName: string, text: string): Promise<void> {
    try {
      const scoringEvent = await this.plugin.onChatMessage(
        {
          sessionId: this.sessionId,
          tenantId: this.tenantId,
          gameType: 'blindtest',
        },
        {
          viewerUsername: username,
          viewerDisplayName: displayName,
          text,
          timestamp: new Date(),
        }
      )

      if (!scoringEvent) return

      // Upsert score in DB
      await this.upsertScore(scoringEvent)

      // Get updated leaderboard
      const leaderboard = await this.getLeaderboard()

      // Publish scoring event
      await this.publishScoringEvent(scoringEvent)

      // Publish updated state
      await this.publishState('active', leaderboard)
    } catch (e) {
      logger.error({ err: e, sessionId: this.sessionId }, 'Error handling chat message')
    }
  }

  private async handleCommand(message: string): Promise<void> {
    try {
      const parsed = JSON.parse(message) as { action?: string }
      const action = parsed.action

      logger.info({ sessionId: this.sessionId, action }, 'Received session command')

      switch (action) {
        case 'next':
          await this.handleNext()
          break
        case 'pause':
          await this.handlePause()
          break
        case 'resume':
          await this.handleResume()
          break
        case 'end':
          await this.handleEnd()
          break
        default:
          logger.warn({ action }, 'Unknown session command')
      }
    } catch (e) {
      logger.error({ err: e, message }, 'Error handling session command')
    }
  }

  private async handleNext(): Promise<void> {
    const sessionRow = await withTenantContext(this.tenantId, async (tx) => {
      const [s] = await tx.select().from(sessions).where(eq(sessions.id, this.sessionId))
      return s ?? null
    })
    if (!sessionRow) return

    const newIndex = sessionRow.currentTrackIndex + 1

    await withTenantContext(this.tenantId, async (tx) => {
      await tx
        .update(sessions)
        .set({ currentTrackIndex: newIndex })
        .where(eq(sessions.id, this.sessionId))
    })

    // Load next track
    if (sessionRow.playlistId) {
      const trackList = await withTenantContext(this.tenantId, async (tx) => {
        return tx
          .select({ title: tracks.title, artist: tracks.artist, position: tracks.position })
          .from(tracks)
          .where(eq(tracks.playlistId, sessionRow.playlistId!))
          .orderBy(tracks.position)
      })

      const nextTrack = trackList[newIndex] ?? null
      this.currentTrackTitle = nextTrack?.title ?? ''
      this.currentTrackArtist = nextTrack?.artist ?? null
    }

    this.plugin.setCurrentTrack(this.currentTrackTitle, this.currentTrackArtist)
    await this.plugin.onReveal({
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      gameType: sessionRow.gameType,
    })

    const leaderboard = await this.getLeaderboard()
    await this.publishState('active', leaderboard)
  }

  private async handlePause(): Promise<void> {
    await withTenantContext(this.tenantId, async (tx) => {
      await tx
        .update(sessions)
        .set({ status: 'paused' })
        .where(eq(sessions.id, this.sessionId))
    })
    await this.publishState('paused', [])
  }

  private async handleResume(): Promise<void> {
    await withTenantContext(this.tenantId, async (tx) => {
      await tx
        .update(sessions)
        .set({ status: 'active' })
        .where(eq(sessions.id, this.sessionId))
    })
    const leaderboard = await this.getLeaderboard()
    await this.publishState('active', leaderboard)
  }

  private async handleEnd(): Promise<void> {
    await withTenantContext(this.tenantId, async (tx) => {
      await tx
        .update(sessions)
        .set({ status: 'ended', endedAt: new Date() })
        .where(eq(sessions.id, this.sessionId))
    })

    const sessionRow = await withTenantContext(this.tenantId, async (tx) => {
      const [s] = await tx.select().from(sessions).where(eq(sessions.id, this.sessionId))
      return s ?? null
    })

    if (sessionRow) {
      await this.plugin.onSessionEnd({
        sessionId: this.sessionId,
        tenantId: this.tenantId,
        gameType: sessionRow.gameType,
      })
    }

    await this.publishState('ended', [])
    await this.stop()
  }

  private async upsertScore(event: ScoringEvent): Promise<void> {
    await withTenantContext(this.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(sessionScores)
        .where(eq(sessionScores.sessionId, this.sessionId))
        .then((rows) => rows.filter((r) => r.viewerUsername === event.viewerUsername))

      if (existing) {
        await tx
          .update(sessionScores)
          .set({
            score: existing.score + event.points,
            correctAnswers: existing.correctAnswers + 1,
            updatedAt: new Date(),
          })
          .where(eq(sessionScores.id, existing.id))
      } else {
        await tx.insert(sessionScores).values({
          sessionId: this.sessionId,
          tenantId: this.tenantId,
          viewerUsername: event.viewerUsername,
          viewerDisplayName: event.viewerDisplayName,
          gameType: 'blindtest',
          score: event.points,
          correctAnswers: 1,
        })
      }
    })
  }

  private async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const scores = await withTenantContext(this.tenantId, async (tx) => {
      return tx
        .select({
          viewerUsername: sessionScores.viewerUsername,
          viewerDisplayName: sessionScores.viewerDisplayName,
          score: sessionScores.score,
        })
        .from(sessionScores)
        .where(eq(sessionScores.sessionId, this.sessionId))
        .orderBy(desc(sessionScores.score))
        .limit(10)
    })

    return scores.map((s) => ({
      username: s.viewerUsername,
      displayName: s.viewerDisplayName,
      score: s.score,
    }))
  }

  private async setBotStatus(status: 'connected' | 'reconnecting'): Promise<void> {
    if (!this.publisher) return
    const value = JSON.stringify({ status, since: new Date().toISOString() })
    // TTL 300s — auto-cleaned if bot crashes without explicit stop
    await this.publisher.setex(`bot:status:${this.sessionId}`, 300, value)
  }

  private async publishSystemEvent(event: 'reconnected'): Promise<void> {
    if (!this.publisher) return
    const payload = JSON.stringify({
      type: 'system',
      event,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    })
    await this.publisher.publish(`overlay:${this.tenantId}`, payload)
  }

  private async publishScoringEvent(event: ScoringEvent): Promise<void> {
    if (!this.publisher) return
    const payload = JSON.stringify({
      type: 'scoring',
      sessionId: event.sessionId,
      viewerUsername: event.viewerUsername,
      viewerDisplayName: event.viewerDisplayName,
      points: event.points,
      reason: event.reason,
      timestamp: event.timestamp.toISOString(),
    })
    await this.publisher.publish(`overlay:${this.tenantId}`, payload)
  }

  private async publishState(
    status: 'active' | 'paused' | 'ended',
    leaderboard: LeaderboardEntry[]
  ): Promise<void> {
    if (!this.publisher) return
    const payload = JSON.stringify({
      type: 'state',
      status,
      trackTitle: this.currentTrackTitle,
      trackArtist: this.currentTrackArtist,
      leaderboard,
    })
    await this.publisher.publish(`overlay:${this.tenantId}`, payload)
  }
}
