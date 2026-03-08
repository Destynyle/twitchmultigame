import type { GamePlugin, SessionContext, ChatMessage, ScoringEvent } from '@playground/game-types'
import { fuzzyMatch } from './fuzzy-matcher'

interface TrackState {
  title: string
  artist: string | null
  titleSolvedBy: string | null   // viewerUsername who first found the title
  artistSolvedBy: string | null  // viewerUsername who first found the artist
  answeredViewers: Set<string>   // viewers who have already scored this round
}

export class BlindtestPlugin implements GamePlugin {
  readonly version = '1.0.0'

  private trackState: TrackState | null = null

  async onSessionStart(_ctx: SessionContext): Promise<void> {
    this.trackState = null
  }

  async onReveal(_ctx: SessionContext): Promise<void> {
    // Called when the streamer reveals the current track (title + artist become available).
    // Track data is set externally via setCurrentTrack() before reveal.
    if (this.trackState) {
      // Reset per-round tracking on each reveal
      this.trackState.titleSolvedBy = null
      this.trackState.artistSolvedBy = null
      this.trackState.answeredViewers = new Set()
    }
  }

  /**
   * Sets the current track that viewers are guessing.
   * Must be called before the round starts (before onReveal).
   */
  setCurrentTrack(title: string, artist: string | null): void {
    this.trackState = {
      title,
      artist,
      titleSolvedBy: null,
      artistSolvedBy: null,
      answeredViewers: new Set(),
    }
  }

  async onChatMessage(
    ctx: SessionContext,
    message: ChatMessage
  ): Promise<ScoringEvent | null> {
    if (!this.trackState) return null

    const { viewerUsername, viewerDisplayName, text, timestamp } = message
    const state = this.trackState

    // Each viewer can only score once per track
    if (state.answeredViewers.has(viewerUsername)) return null

    const matchesTitle = fuzzyMatch(text, state.title)
    const matchesArtist = state.artist ? fuzzyMatch(text, state.artist) : false

    if (!matchesTitle && !matchesArtist) return null

    state.answeredViewers.add(viewerUsername)

    // Both title AND artist matched in a single message
    if (matchesTitle && matchesArtist) {
      if (!state.titleSolvedBy) state.titleSolvedBy = viewerUsername
      if (!state.artistSolvedBy) state.artistSolvedBy = viewerUsername
      return {
        sessionId: ctx.sessionId,
        viewerUsername,
        viewerDisplayName,
        points: 5,
        reason: 'correct_answer',
        timestamp,
      }
    }

    if (matchesTitle) {
      const firstToSolve = !state.titleSolvedBy
      if (firstToSolve) state.titleSolvedBy = viewerUsername
      return {
        sessionId: ctx.sessionId,
        viewerUsername,
        viewerDisplayName,
        points: firstToSolve ? 3 : 1,
        reason: 'correct_title',
        timestamp,
      }
    }

    // matchesArtist
    const firstToSolve = !state.artistSolvedBy
    if (firstToSolve) state.artistSolvedBy = viewerUsername
    return {
      sessionId: ctx.sessionId,
      viewerUsername,
      viewerDisplayName,
      points: firstToSolve ? 2 : 1,
      reason: 'correct_artist',
      timestamp,
    }
  }

  async onStreamerAction(_ctx: SessionContext, action: string, _payload?: unknown): Promise<void> {
    if (action === 'next' || action === 'skip') {
      // Clear track state when moving to next track
      this.trackState = null
    }
  }

  async onSessionEnd(_ctx: SessionContext): Promise<void> {
    this.trackState = null
  }
}
