import type { GamePlugin, SessionContext, ChatMessage, ScoringEvent } from '@playground/game-types'
import { fuzzyMatch } from './fuzzy-matcher'

interface QuizState {
  question: string
  answer: string | null
  firstAnsweredBy: string | null
  answeredViewers: Set<string>
}

export class QuizPlugin implements GamePlugin {
  readonly version = '1.0.0'

  private quizState: QuizState | null = null

  async onSessionStart(_ctx: SessionContext): Promise<void> {
    this.quizState = null
  }

  async onReveal(_ctx: SessionContext): Promise<void> {
    if (this.quizState) {
      this.quizState.firstAnsweredBy = null
      this.quizState.answeredViewers = new Set()
    }
  }

  /**
   * Sets the current question/answer pair.
   * title = question displayed to viewers
   * artist = correct answer (can be null to disable scoring)
   */
  setCurrentTrack(title: string, artist: string | null): void {
    this.quizState = {
      question: title,
      answer: artist,
      firstAnsweredBy: null,
      answeredViewers: new Set(),
    }
  }

  async onChatMessage(
    ctx: SessionContext,
    message: ChatMessage
  ): Promise<ScoringEvent | null> {
    if (!this.quizState) return null

    const { viewerUsername, viewerDisplayName, text, timestamp } = message
    const state = this.quizState
    const answer = state.answer

    if (answer === null) return null

    // Each viewer can only score once per question
    if (state.answeredViewers.has(viewerUsername)) return null

    const matchesAnswer = fuzzyMatch(text, answer)
    if (!matchesAnswer) return null

    state.answeredViewers.add(viewerUsername)

    const isFirst = !state.firstAnsweredBy
    if (isFirst) state.firstAnsweredBy = viewerUsername

    return {
      sessionId: ctx.sessionId,
      viewerUsername,
      viewerDisplayName,
      points: isFirst ? 3 : 1,
      reason: 'correct_answer',
      timestamp,
    }
  }

  async onStreamerAction(_ctx: SessionContext, action: string, _payload?: unknown): Promise<void> {
    if (action === 'next' || action === 'skip') {
      this.quizState = null
    }
  }

  async onSessionEnd(_ctx: SessionContext): Promise<void> {
    this.quizState = null
  }
}
