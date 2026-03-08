import type { IChatConnection } from './IChatConnection'

export class MockChatConnection implements IChatConnection {
  private connected = false
  private messageHandler?: (channel: string, username: string, displayName: string, text: string) => void
  public sentMessages: string[] = []

  async connect(): Promise<void> { this.connected = true }
  async disconnect(): Promise<void> { this.connected = false }
  async sendMessage(channel: string, message: string): Promise<void> {
    this.sentMessages.push(`${channel}:${message}`)
  }
  onMessage(handler: (channel: string, username: string, displayName: string, text: string) => void): void {
    this.messageHandler = handler
  }
  isConnected(): boolean { return this.connected }

  /** Test helper: simulate an incoming chat message */
  simulateMessage(channel: string, username: string, displayName: string, text: string): void {
    this.messageHandler?.(channel, username, displayName, text)
  }
}
