import tmi from 'tmi.js'
import { logger } from '../logger'
import type { IChatConnection } from './IChatConnection'

interface QueuedMessage {
  channel: string
  username: string
  displayName: string
  text: string
}

/**
 * Connects to a Twitch channel using the streamer's own OAuth token.
 * The bot reads chat and can send messages as the streamer.
 *
 * Reconnection: tmi.js reconnects automatically on drop (NFR-P3: within 5s).
 * Messages received during the reconnection window are queued and processed
 * in order once the connection is restored (FR27).
 */
export class TwitchChatConnection implements IChatConnection {
  private client: tmi.Client
  private connected = false
  private hasConnectedOnce = false
  private intentionalDisconnect = false
  private reconnecting = false
  private messageQueue: QueuedMessage[] = []
  private messageHandler?: (channel: string, username: string, displayName: string, text: string) => void
  private reconnectHandler?: () => void
  private disconnectHandler?: () => void

  constructor(private readonly twitchLogin: string, accessToken: string) {
    this.client = new tmi.Client({
      options: { debug: false },
      connection: {
        reconnect: true,
        maxReconnectAttempts: 10,
        reconnectDecay: 1.5,
        reconnectInterval: 1000,
      },
      identity: {
        username: twitchLogin,
        password: `oauth:${accessToken}`,
      },
      channels: [twitchLogin],
    })

    this.client.on('message', (_channel, tags, message, self) => {
      if (self) return
      const username = tags.username ?? tags['display-name'] ?? 'unknown'
      const displayName = tags['display-name'] ?? username

      if (this.reconnecting) {
        this.messageQueue.push({ channel: _channel, username, displayName, text: message })
        logger.debug({ channel: _channel, username, queueSize: this.messageQueue.length }, 'Message queued during reconnection')
        return
      }

      this.messageHandler?.(_channel, username, displayName, message)
    })

    this.client.on('connected', () => {
      const wasReconnecting = this.reconnecting
      this.connected = true
      this.reconnecting = false

      if (!this.hasConnectedOnce) {
        this.hasConnectedOnce = true
        logger.info({ channel: twitchLogin }, 'TwitchChatConnection connected')
      } else {
        logger.info({ channel: twitchLogin, queuedMessages: this.messageQueue.length }, 'TwitchChatConnection reconnected')
        this.flushMessageQueue()
        this.reconnectHandler?.()
      }

      // suppress unused warning — wasReconnecting used for future guard if needed
      void wasReconnecting
    })

    this.client.on('disconnected', (reason) => {
      this.connected = false
      if (!this.intentionalDisconnect) {
        this.reconnecting = true
        logger.warn({ channel: twitchLogin, reason }, 'TwitchChatConnection disconnected — reconnecting')
        this.disconnectHandler?.()
      } else {
        logger.info({ channel: twitchLogin }, 'TwitchChatConnection intentionally disconnected')
      }
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true
    await this.client.disconnect()
    this.connected = false
  }

  async sendMessage(channel: string, message: string): Promise<void> {
    if (!this.connected) {
      logger.warn({ channel }, 'sendMessage skipped — not connected')
      return
    }
    await this.client.say(channel, message)
  }

  onMessage(handler: (channel: string, username: string, displayName: string, text: string) => void): void {
    this.messageHandler = handler
  }

  onReconnect(handler: () => void): void {
    this.reconnectHandler = handler
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return
    const toProcess = [...this.messageQueue]
    this.messageQueue = []
    logger.info({ count: toProcess.length }, 'Flushing queued messages after reconnection')
    for (const msg of toProcess) {
      this.messageHandler?.(msg.channel, msg.username, msg.displayName, msg.text)
    }
  }
}
