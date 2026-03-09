import Redis from 'ioredis'
import { withTenantContext } from '@playground/db'
import { oauthTokens } from '@playground/db/schema'
import { and, eq } from 'drizzle-orm'
import { decrypt } from '@playground/shared/utils/encrypt'
import { env } from '@playground/shared/env'
import { BlindtestPlugin, QuizPlugin } from '@playground/game-engine'
import { BotSession } from './bot-session'
import { MockChatConnection } from './connections/MockChatConnection'
import { TwitchChatConnection } from './connections/TwitchChatConnection'
import { logger } from './logger'

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
const SESSIONS_EVENTS_CHANNEL = 'sessions:events'

interface SessionLaunchedEvent {
  type: 'session_launched'
  sessionId: string
  tenantId: string
  twitchLogin: string
  gameType: 'blindtest' | 'quiz'
}

interface SessionEndedEvent {
  type: 'session_ended'
  sessionId: string
}

type SessionEvent = SessionLaunchedEvent | SessionEndedEvent

export class SessionRunner {
  private activeSessions: Map<string, BotSession> = new Map()
  private subscriber: Redis | null = null

  async start(): Promise<void> {
    this.subscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 })
    this.subscriber.on('error', (err: Error) => {
      logger.error({ err: err.message }, 'Redis subscriber error')
    })
    await this.subscriber.subscribe(SESSIONS_EVENTS_CHANNEL)
    this.subscriber.on('message', (_channel: string, message: string) => {
      void this.handleEvent(message)
    })
    logger.info('SessionRunner listening for session events')
  }

  stop(): void {
    this.subscriber?.unsubscribe().catch(() => {})
    this.subscriber?.disconnect()
    this.subscriber = null
    logger.info('SessionRunner stopped')
  }

  private async handleEvent(message: string): Promise<void> {
    try {
      const event = JSON.parse(message) as SessionEvent
      if (event.type === 'session_launched') await this.startSession(event)
      else if (event.type === 'session_ended') await this.stopSession(event.sessionId)
    } catch (err) {
      logger.error({ err }, 'SessionRunner failed to handle event')
    }
  }

  private async startSession(event: SessionLaunchedEvent): Promise<void> {
    const { sessionId, tenantId, twitchLogin, gameType } = event
    if (this.activeSessions.has(sessionId)) return

    logger.info({ sessionId, gameType }, 'Starting BotSession')

    const plugin = gameType === 'quiz' ? new QuizPlugin() : new BlindtestPlugin()

    // Fetch streamer's Twitch OAuth token from DB
    let connection
    try {
      const [tokenRow] = await withTenantContext(tenantId, async (tx) =>
        tx.select({ encryptedAccessToken: oauthTokens.encryptedAccessToken })
          .from(oauthTokens)
          .where(and(eq(oauthTokens.tenantId, tenantId), eq(oauthTokens.provider, 'twitch')))
      )
      if (tokenRow) {
        const accessToken = decrypt(tokenRow.encryptedAccessToken, env.TOKEN_ENCRYPTION_KEY)
        connection = new TwitchChatConnection(twitchLogin, accessToken)
      } else {
        logger.warn({ tenantId }, 'No Twitch token found, using MockChatConnection')
        connection = new MockChatConnection()
      }
    } catch (err) {
      logger.error({ err, tenantId }, 'Failed to fetch Twitch token, using MockChatConnection')
      connection = new MockChatConnection()
    }

    const botSession = new BotSession({ sessionId, tenantId, twitchLogin, plugin, connection, redisUrl: REDIS_URL })
    this.activeSessions.set(sessionId, botSession)

    botSession.start().catch((err: unknown) => {
      logger.error({ err, sessionId }, 'BotSession failed to start')
      this.activeSessions.delete(sessionId)
    })
  }

  private async stopSession(sessionId: string): Promise<void> {
    const botSession = this.activeSessions.get(sessionId)
    if (!botSession) return
    await botSession.stop().catch((err: unknown) => logger.error({ err, sessionId }, 'Error stopping BotSession'))
    this.activeSessions.delete(sessionId)
    logger.info({ sessionId }, 'BotSession removed')
  }
}
