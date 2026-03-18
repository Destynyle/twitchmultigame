import type { GamePlugin, SessionContext, ChatMessage, ScoringEvent } from '@playground/game-types'
import { fuzzyMatch } from './fuzzy-matcher'

interface TrackOptions {
  featurings?: string[]
  malusTerms?: string[]
  windowDurationMs?: number
}

interface TrackState {
  title: string
  artist: string | null
  featurings: string[]
  malusTerms: string[]
  windowDurationMs: number
  /** Timestamp (ms) of the first correct title or double-shot guess */
  windowOpenAt: number | null
  answeredViewers: Set<string>       // viewers who used their main guess this round
  foundFeaturings: Set<string>       // featuring names already found this round
  malusCounters: Map<string, number> // viewerUsername → malus hit count this round
}

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Computes decayed points for a viewer who guessed at `guessMs`.
 * - If window not yet open (first finder): returns { pts: 3, elapsed: 0 }.
 * - If within window: returns { pts, elapsed } where pts = 3 - 2*(elapsed/window), rounded to 1 decimal.
 * - If window has closed (elapsed > windowDurationMs): returns null (guess ignored).
 */
function computeDecayPoints(
  guessMs: number,
  windowOpenAt: number | null,
  windowDurationMs: number
): { pts: number; elapsed_ms: number } | null {
  if (windowOpenAt === null) {
    // First finder — full 3 pts, no elapsed time
    return { pts: 3, elapsed_ms: 0 }
  }
  const elapsed_ms = Math.max(0, guessMs - windowOpenAt)
  if (elapsed_ms > windowDurationMs) {
    return null
  }
  const ratio = elapsed_ms / windowDurationMs
  const pts = Math.round((3 - 2 * ratio) * 10) / 10
  return { pts, elapsed_ms }
}

/**
 * Checks if a message matches any malus term (fuzzy, 0.15 tolerance).
 * Returns the matched term or null.
 */
function checkMalus(text: string, malusTerms: string[]): string | null {
  for (const term of malusTerms) {
    if (fuzzyMatch(text, term, 0.15)) return term
  }
  return null
}

/**
 * Checks if a message matches any unfound featuring (default 0.15 fuzzy tolerance).
 * Returns the matched featuring name or null.
 */
function checkFeaturing(text: string, featurings: string[], foundFeaturings: Set<string>): string | null {
  for (const feat of featurings) {
    if (!foundFeaturings.has(feat) && fuzzyMatch(text, feat)) return feat
  }
  return null
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export class BlindtestPlugin implements GamePlugin {
  readonly version = '2.0.0'

  private trackState: TrackState | null = null

  async onSessionStart(_ctx: SessionContext): Promise<void> {
    this.trackState = null
  }

  async onReveal(_ctx: SessionContext): Promise<void> {
    if (this.trackState) {
      // Reset per-round tracking on each reveal
      this.trackState.windowOpenAt = null
      this.trackState.answeredViewers = new Set()
      this.trackState.foundFeaturings = new Set()
      this.trackState.malusCounters = new Map()
    }
  }

  /**
   * Sets the current track that viewers are guessing.
   * Must be called before the round starts (before onReveal).
   *
   * @param title - Track title viewers must guess
   * @param artist - Artist name (null if not a scoring target)
   * @param options - Optional: featurings, malusTerms, windowDurationMs
   */
  setCurrentTrack(title: string, artist: string | null, options?: TrackOptions): void {
    this.trackState = {
      title,
      artist,
      featurings: options?.featurings ?? [],
      malusTerms: options?.malusTerms ?? [],
      windowDurationMs: options?.windowDurationMs ?? 5000,
      windowOpenAt: null,
      answeredViewers: new Set(),
      foundFeaturings: new Set(),
      malusCounters: new Map(),
    }
  }

  /**
   * Returns the timestamp (ms) when the timing window opened (first correct guess),
   * or null if no correct guess yet this round.
   * Exposed for BotSession to compute timers externally if needed.
   */
  getWindowOpenAt(): number | null {
    return this.trackState?.windowOpenAt ?? null
  }

  async onChatMessage(
    ctx: SessionContext,
    message: ChatMessage
  ): Promise<ScoringEvent | null> {
    if (!this.trackState) return null

    const { viewerUsername, viewerDisplayName, text, timestamp } = message
    const state = this.trackState
    const guessMs = timestamp.getTime()

    // ── 1. Malus check (highest priority, beats correct answers) ───────────
    const malusMatch = checkMalus(text, state.malusTerms)
    if (malusMatch !== null) {
      const counter = (state.malusCounters.get(viewerUsername) ?? 0) + 1
      state.malusCounters.set(viewerUsername, counter)
      return {
        sessionId: ctx.sessionId,
        viewerUsername,
        viewerDisplayName,
        points: -counter,
        reason: 'malus',
        timestamp,
      }
    }

    // ── 2. Main guess: each viewer gets one attempt per round ──────────────
    if (!state.answeredViewers.has(viewerUsername)) {
      const event = this.checkMainGuess(ctx, state, viewerUsername, viewerDisplayName, text, timestamp, guessMs)
      if (event !== undefined) return event
    }

    // ── 3. Featuring check (independent from main guess) ───────────────────
    // Viewers can score featurings even after guessing title/artist (or vice versa).
    const featMatch = checkFeaturing(text, state.featurings, state.foundFeaturings)
    if (featMatch !== null) {
      state.foundFeaturings.add(featMatch)
      return {
        sessionId: ctx.sessionId,
        viewerUsername,
        viewerDisplayName,
        points: 1,
        reason: 'featuring',
        timestamp,
      }
    }

    return null
  }

  /**
   * Evaluates the viewer's main guess (title/artist or double-shot).
   * Returns a ScoringEvent if the message matches, undefined to fall through (no match at all).
   * Returns null if the window has closed for a correct guess.
   */
  private checkMainGuess(
    ctx: SessionContext,
    state: TrackState,
    viewerUsername: string,
    viewerDisplayName: string,
    text: string,
    timestamp: Date,
    guessMs: number
  ): ScoringEvent | null | undefined {
    const titleMatches = fuzzyMatch(text, state.title)
    const artistMatches = state.artist !== null ? fuzzyMatch(text, state.artist) : false

    if (state.artist !== null) {
      return this.checkDoubleShot(ctx, state, viewerUsername, viewerDisplayName, text, timestamp, guessMs, titleMatches, artistMatches)
    } else {
      return this.checkSingleTitle(ctx, state, viewerUsername, viewerDisplayName, timestamp, guessMs, titleMatches)
    }
  }

  /**
   * Handles double-shot track (artist is non-null).
   * - Both match: (titlePts + artistPts) x 2, reason='double_shot'
   * - Only one matches: 0 pts, reason='double_shot' (all-or-nothing)
   * - Neither matches: undefined (fall through to featuring check)
   */
  private checkDoubleShot(
    ctx: SessionContext,
    state: TrackState,
    viewerUsername: string,
    viewerDisplayName: string,
    _text: string,
    timestamp: Date,
    guessMs: number,
    titleMatches: boolean,
    artistMatches: boolean
  ): ScoringEvent | null | undefined {
    if (titleMatches && artistMatches) {
      const decay = computeDecayPoints(guessMs, state.windowOpenAt, state.windowDurationMs)
      if (decay === null) {
        // Window closed — ignore (do not add to answeredViewers)
        return null
      }
      if (state.windowOpenAt === null) {
        state.windowOpenAt = guessMs
      }
      const total = Math.round((decay.pts + decay.pts) * 2 * 10) / 10
      state.answeredViewers.add(viewerUsername)
      return {
        sessionId: ctx.sessionId,
        viewerUsername,
        viewerDisplayName,
        points: total,
        reason: 'double_shot',
        timestamp,
        elapsed_ms: decay.elapsed_ms,
      }
    }

    if (titleMatches || artistMatches) {
      // Failed double-shot: consumed the guess, 0 pts
      state.answeredViewers.add(viewerUsername)
      return {
        sessionId: ctx.sessionId,
        viewerUsername,
        viewerDisplayName,
        points: 0,
        reason: 'double_shot',
        timestamp,
      }
    }

    return undefined // no match — fall through
  }

  /**
   * Handles single-target track (artist is null, title only).
   * - Title matches: decayed points, reason='correct_title'
   * - No match: undefined (fall through to featuring check)
   */
  private checkSingleTitle(
    ctx: SessionContext,
    state: TrackState,
    viewerUsername: string,
    viewerDisplayName: string,
    timestamp: Date,
    guessMs: number,
    titleMatches: boolean
  ): ScoringEvent | null | undefined {
    if (!titleMatches) return undefined

    const decay = computeDecayPoints(guessMs, state.windowOpenAt, state.windowDurationMs)
    if (decay === null) {
      // Window closed — ignore
      return null
    }
    if (state.windowOpenAt === null) {
      state.windowOpenAt = guessMs
    }
    state.answeredViewers.add(viewerUsername)
    return {
      sessionId: ctx.sessionId,
      viewerUsername,
      viewerDisplayName,
      points: decay.pts,
      reason: 'correct_title',
      timestamp,
      elapsed_ms: decay.elapsed_ms,
    }
  }

  async onStreamerAction(_ctx: SessionContext, action: string, _payload?: unknown): Promise<void> {
    if (action === 'next' || action === 'skip') {
      this.trackState = null
    }
  }

  async onSessionEnd(_ctx: SessionContext): Promise<void> {
    this.trackState = null
  }
}
