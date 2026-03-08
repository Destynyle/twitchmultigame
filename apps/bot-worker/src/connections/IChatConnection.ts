export interface IChatConnection {
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendMessage(channel: string, message: string): Promise<void>
  onMessage(handler: (channel: string, username: string, displayName: string, text: string) => void): void
  onReconnect?(handler: () => void): void
  onDisconnect?(handler: () => void): void
  isConnected(): boolean
}
