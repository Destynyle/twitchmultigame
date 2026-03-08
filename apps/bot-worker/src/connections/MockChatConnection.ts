import type { IChatConnection } from './IChatConnection'

export class MockChatConnection implements IChatConnection {
  private connected = false
  private reconnecting = false
  private messageQueue: Array<[string, string, string, string]> = []
  private messageHandler?: (channel: string, username: string, displayName: string, text: string) => void
  private reconnectHandler?: () => void
  public sentMessages: string[] = []

  async connect(): Promise<void> { this.connected = true }
  async disconnect(): Promise<void> { this.connected = false }
  async sendMessage(channel: string, message: string): Promise<void> {
    this.sentMessages.push(`${channel}:${message}`)
  }
  onMessage(handler: (channel: string, username: string, displayName: string, text: string) => void): void {
    this.messageHandler = handler
  }
  onReconnect(handler: () => void): void {
    this.reconnectHandler = handler
  }
  isConnected(): boolean { return this.connected }

  /** Test helper: simulate an incoming chat message */
  simulateMessage(channel: string, username: string, displayName: string, text: string): void {
    if (this.reconnecting) {
      this.messageQueue.push([channel, username, displayName, text])
      return
    }
    this.messageHandler?.(channel, username, displayName, text)
  }

  /** Test helper: simulate a connection drop (starts queuing messages) */
  simulateDisconnect(): void {
    this.connected = false
    this.reconnecting = true
  }

  /** Test helper: simulate successful reconnection (flushes message queue) */
  simulateReconnect(): void {
    this.connected = true
    this.reconnecting = false
    const toProcess = [...this.messageQueue]
    this.messageQueue = []
    for (const [channel, username, displayName, text] of toProcess) {
      this.messageHandler?.(channel, username, displayName, text)
    }
    this.reconnectHandler?.()
  }
}
