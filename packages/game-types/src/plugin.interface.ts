export interface ChatMessage {
  viewerUsername: string
  viewerDisplayName: string
  text: string
  timestamp: Date
}

export interface SessionContext {
  sessionId: string
  tenantId: string
  gameType: string
  playlistId?: string
}

export interface ScoringEvent {
  sessionId: string
  viewerUsername: string
  viewerDisplayName: string
  points: number  // can be negative for malus
  reason: 'correct_title' | 'correct_artist' | 'correct_answer' | 'partial' | 'malus' | 'featuring' | 'double_shot' | 'combo'
  timestamp: Date
  streakMultiplier?: number
  elapsed_ms?: number
}

export interface GamePlugin {
  /** Semver string, e.g. "1.0.0" */
  readonly version: string
  /** Called when a session is started */
  onSessionStart(ctx: SessionContext): Promise<void>
  /** Called for every chat message received */
  onChatMessage(ctx: SessionContext, message: ChatMessage): Promise<ScoringEvent | null>
  /** Called when the streamer triggers an action (next/pause/reveal/end) */
  onStreamerAction(ctx: SessionContext, action: string, payload?: unknown): Promise<void>
  /** Called when the current track/question is revealed */
  onReveal(ctx: SessionContext): Promise<void>
  /** Called when the session ends */
  onSessionEnd(ctx: SessionContext): Promise<void>
}
