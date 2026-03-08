import tmi from 'tmi.js'
import { logger } from '../logger'
import type { IChatConnection } from './IChatConnection'

/**
 * Connects to a Twitch channel using the streamer's own OAuth token.
 * The bot reads chat and can send messages as the streamer.
 */
export class TwitchChatConnection implements IChatConnection {
  private client: tmi.Client
  private connected = false
  private messageHandler?: (channel: string, username: string, displayName: string, text: string) => void

  /**
   * @param twitchLogin  The streamer's Twitch login (channel to join)
   * @param accessToken  The streamer's OAuth access token (without "oauth:" prefix)
   */
  constructor(twitchLogin: string, accessToken: string) {
    this.client = new tmi.Client({
      options: { debug: false },
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
      this.messageHandler?.(_channel, username, displayName, message)
    })

    this.client.on('connected', () => {
      this.connected = true
      logger.info({ channel: twitchLogin }, 'TwitchChatConnection connected')
    })

    this.client.on('disconnected', (reason) => {
      this.connected = false
      logger.warn({ channel: twitchLogin, reason }, 'TwitchChatConnection disconnected')
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect()
    this.connected = false
  }

  async sendMessage(channel: string, message: string): Promise<void> {
    await this.client.say(channel, message)
  }

  onMessage(handler: (channel: string, username: string, displayName: string, text: string) => void): void {
    this.messageHandler = handler
  }

  isConnected(): boolean {
    return this.connected
  }
}
