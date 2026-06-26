import type { GamePlugin, SessionContext, ChatMessage, ScoringEvent } from '@playground/game-types'
import { fuzzyMatch } from './fuzzy-matcher'

interface TrackOptions {
  featurings?: string[]
  malusTerms?: string[]
  windowDurationMs?: number
}

// Bonus multiplier when a viewer names BOTH title and artist in the SAME message
// (harder/longer to type, so it's rewarded). Tunable.
const COMBO_MULTIPLIER = 1.5

interface TrackState {
  title: string
  artist: string | null
  featurings: string[]
  malusTerms: string[]
  windowDurationMs: number
  // Title and artist are independent targets, each with its own decay window
  // opened by the first viewer to find that specific target.
  titleWindowAt: number | null
  artistWindowAt: number | null
  titleScorers: Set<string>          // viewers who already scored the title this round
  artistScorers: Set<string>         // viewers who already scored the artist this round
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
      this.trackState.titleWindowAt = null
      this.trackState.artistWindowAt = null
      this.trackState.titleScorers = new Set()
      this.trackState.artistScorers = new Set()
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
      titleWindowAt: null,
      artistWindowAt: null,
      titleScorers: new Set(),
      artistScorers: new Set(),
      foundFeaturings: new Set(),
      malusCounters: new Map(),
    }
  }

  /**
   * Returns the timestamp (ms) when the title timing window opened (first correct
   * title guess), or null if no correct title guess yet this round.
   */
  getWindowOpenAt(): number | null {
    return this.trackState?.titleWindowAt ?? null
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

    // ── 2. Main guess: title and artist are independent targets ────────────
    // A viewer can score each once; naming both in one message earns a combo.
    const event = this.checkMainGuess(ctx, state, viewerUsername, viewerDisplayName, text, timestamp, guessMs)
    if (event !== undefined) return event

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
        label: featMatch,
      }
    }

    return null
  }

  /**
   * Evaluates the viewer's guess against the two independent targets (title and
   * artist). Each target is scored once per viewer, with its own decay window.
   * - Both newly matched in this message: (titlePts + artistPts) x COMBO_MULTIPLIER, reason='combo'
   * - Only title newly matched: decayed points, reason='correct_title'
   * - Only artist newly matched: decayed points, reason='correct_artist'
   * - Text matched a target but its window is closed / already scored: null (consume, no fall-through)
   * - No target text matched: undefined (fall through to featuring check)
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

    const wantTitle = titleMatches && !state.titleScorers.has(viewerUsername)
    const wantArtist =
      artistMatches && state.artist !== null && !state.artistScorers.has(viewerUsername)

    // No NEW target for this viewer: fall through to featuring only if the text
    // matched nothing at all; otherwise consume silently (already scored / repeat).
    if (!wantTitle && !wantArtist) {
      return titleMatches || artistMatches ? null : undefined
    }

    let titlePts = 0
    let artistPts = 0
    let gotTitle = false
    let gotArtist = false
    let elapsed = 0

    if (wantTitle) {
      const decay = computeDecayPoints(guessMs, state.titleWindowAt, state.windowDurationMs)
      if (decay !== null) {
        if (state.titleWindowAt === null) state.titleWindowAt = guessMs
        state.titleScorers.add(viewerUsername)
        titlePts = decay.pts
        gotTitle = true
        elapsed = Math.max(elapsed, decay.elapsed_ms)
      }
    }

    if (wantArtist) {
      const decay = computeDecayPoints(guessMs, state.artistWindowAt, state.windowDurationMs)
      if (decay !== null) {
        if (state.artistWindowAt === null) state.artistWindowAt = guessMs
        state.artistScorers.add(viewerUsername)
        artistPts = decay.pts
        gotArtist = true
        elapsed = Math.max(elapsed, decay.elapsed_ms)
      }
    }

    // Matched target text but every window was closed — ignore the guess.
    if (!gotTitle && !gotArtist) return null

    const base = { sessionId: ctx.sessionId, viewerUsername, viewerDisplayName, timestamp }

    if (gotTitle && gotArtist) {
      const total = Math.round((titlePts + artistPts) * COMBO_MULTIPLIER * 10) / 10
      return { ...base, points: total, reason: 'combo', elapsed_ms: elapsed }
    }
    if (gotTitle) {
      return { ...base, points: titlePts, reason: 'correct_title', elapsed_ms: elapsed }
    }
    return { ...base, points: artistPts, reason: 'correct_artist', elapsed_ms: elapsed }
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
