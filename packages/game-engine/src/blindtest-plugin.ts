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
  answeredViewers: Set<string>      // viewers who used their main guess this round
  foundFeaturings: Set<string>      // featuring names already found this round
  malusCounters: Map<string, number> // viewerUsername → malus hit count this round
}

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Computes the decayed points for a viewer who guessed at `guessTimestamp`.
 * The window opens at `windowOpenAt`. If no window open yet (first finder), returns 3.
 * If outside the window, returns null (guess ignored).
 * Formula: pts = 3 - 2 * (elapsed_ms / windowDurationMs), rounded to 1 decimal.
 */
function computeDecayPoints(
  guessTimestamp: number,
  windowOpenAt: number | null,
  windowDurationMs: number
): number | null {
  if (windowOpenAt === null) {
    // This viewer is the first finder — full 3 pts, window opens now
    return 3
  }
  const elapsed_ms = guessTimestamp - windowOpenAt
  if (elapsed_ms < 0) {
    // Message arrived before window opened (clock skew) — treat as simultaneous
    return 3
  }
  if (elapsed_ms > windowDurationMs) {
    // Outside the window — ignored
    return null
  }
  const ratio = elapsed_ms / windowDurationMs
  const pts = 3 - 2 * ratio
  return Math.round(pts * 10) / 10
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
 * Checks if a message matches any unfound featuring (default fuzzy tolerance).
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
   * Returns the timestamp (ms) when the window opened (first correct guess),
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

    // ── 1. Malus check (highest priority) ──────────────────────────────────
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

    // ── 2. Main guess (title / double-shot) — each viewer gets one attempt ──
    if (!state.answeredViewers.has(viewerUsername)) {
      const titleMatches = fuzzyMatch(text, state.title)
      const artistMatches = state.artist !== null ? fuzzyMatch(text, state.artist) : false

      if (state.artist !== null) {
        // ── Double-shot track (both targets exist) ──────────────────────────
        if (titleMatches && artistMatches) {
          // SUCCESS: both matched → compute decay for each and multiply
          const titlePts = computeDecayPoints(guessMs, state.windowOpenAt, state.windowDurationMs)
          if (titlePts === null) {
            // Window has closed — ignore
            return null
          }
          if (state.windowOpenAt === null) {
            state.windowOpenAt = guessMs
          }
          const artistPts = titlePts // same timestamp, same decay
          const total = Math.round((titlePts + artistPts) * 2 * 10) / 10
          state.answeredViewers.add(viewerUsername)
          return {
            sessionId: ctx.sessionId,
            viewerUsername,
            viewerDisplayName,
            points: total,
            reason: 'double_shot',
            timestamp,
            elapsed_ms: state.windowOpenAt !== null ? guessMs - (state.windowOpenAt - (state.windowOpenAt === guessMs ? 0 : state.windowOpenAt)) : 0,
          }
        }

        if (titleMatches || artistMatches) {
          // FAILURE: only one of two matched → 0 pts, add to answeredViewers (no retry)
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
      } else {
        // ── Single-target track (artist=null) ───────────────────────────────
        if (titleMatches) {
          const pts = computeDecayPoints(guessMs, state.windowOpenAt, state.windowDurationMs)
          if (pts === null) {
            // Window has closed — ignore (but don't add to answeredViewers)
            return null
          }
          const elapsed_ms = state.windowOpenAt !== null ? guessMs - state.windowOpenAt : 0
          if (state.windowOpenAt === null) {
            state.windowOpenAt = guessMs
          }
          state.answeredViewers.add(viewerUsername)
          return {
            sessionId: ctx.sessionId,
            viewerUsername,
            viewerDisplayName,
            points: pts,
            reason: 'correct_title',
            timestamp,
            elapsed_ms,
          }
        }
      }
    }

    // ── 3. Featuring check (viewer can score featurings AND title/artist) ───
    // Note: featuring viewers are tracked separately — answeredViewers only
    // covers title/artist guesses, not featurings.
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

  async onStreamerAction(_ctx: SessionContext, action: string, _payload?: unknown): Promise<void> {
    if (action === 'next' || action === 'skip') {
      this.trackState = null
    }
  }

  async onSessionEnd(_ctx: SessionContext): Promise<void> {
    this.trackState = null
  }
}
