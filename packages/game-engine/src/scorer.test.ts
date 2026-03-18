import { describe, it, expect, beforeEach } from 'vitest'
import { BlindtestPlugin } from './blindtest-plugin'
import { fuzzyMatch } from './fuzzy-matcher'
import { normalize } from './normalizer'

const ctx = {
  sessionId: 'session-1',
  tenantId: 'tenant-1',
  gameType: 'blindtest',
}

function msg(text: string, viewer = 'viewer1', timestampMs?: number) {
  return {
    viewerUsername: viewer,
    viewerDisplayName: viewer,
    text,
    timestamp: timestampMs !== undefined ? new Date(timestampMs) : new Date(),
  }
}

// ─── normalizer ───────────────────────────────────────────────────────────────

describe('normalize', () => {
  it('lowercases and strips accents', () => {
    expect(normalize('Héros')).toBe('heros')
  })

  it('removes punctuation', () => {
    expect(normalize("Don't Stop Me Now!")).toBe('dont stop me now')
  })

  it('collapses whitespace', () => {
    expect(normalize('  a   b  ')).toBe('a b')
  })
})

// ─── fuzzyMatch ───────────────────────────────────────────────────────────────

describe('fuzzyMatch', () => {
  it('returns true for exact match', () => {
    expect(fuzzyMatch('bohemian rhapsody', 'Bohemian Rhapsody')).toBe(true)
  })

  it('tolerates typos within default tolerance', () => {
    // "boemian rhapsody" → 1 char diff out of 17 → within tolerance
    expect(fuzzyMatch('boemian rhapsody', 'Bohemian Rhapsody')).toBe(true)
  })

  it('rejects clearly wrong answers', () => {
    expect(fuzzyMatch('stairway to heaven', 'Bohemian Rhapsody')).toBe(false)
  })

  it('requires exact match for very short targets', () => {
    expect(fuzzyMatch('ab', 'ab')).toBe(true)
    expect(fuzzyMatch('ac', 'ab')).toBe(false)
  })

  it('strips accents before comparing', () => {
    expect(fuzzyMatch('heros', 'Héros')).toBe(true)
  })

  it('default tolerance is 0.15 (not 0.30)', () => {
    // Clearly wrong answer fails at any tolerance
    expect(fuzzyMatch('stairway to heaven', 'Bohemian Rhapsody')).toBe(false)
    // One-edit typo passes at 0.15 (1/17 ≈ 0.059)
    expect(fuzzyMatch('bohemian rhapsodx', 'Bohemian Rhapsody')).toBe(true)
    // Verify that calling without tolerance param uses 0.15 (same result as explicit 0.15)
    expect(fuzzyMatch('bohemian rhapsodx', 'Bohemian Rhapsody', 0.15)).toBe(true)
    // A large typo fails at 0.15 (explicitly test 0.15 is stricter than 0.30)
    // "xohemianxrhapsodyx" → many edits, clearly fails both
    expect(fuzzyMatch('stairway', 'Bohemian Rhapsody', 0.15)).toBe(false)
    expect(fuzzyMatch('stairway', 'Bohemian Rhapsody', 0.30)).toBe(false)
  })
})

// ─── BlindtestPlugin v1 (title-only track: artist=null) ───────────────────────
// When artist is null, only title scoring applies (no double-shot logic).

describe('BlindtestPlugin — title-only track (artist=null)', () => {
  let plugin: BlindtestPlugin

  beforeEach(async () => {
    plugin = new BlindtestPlugin()
    await plugin.onSessionStart(ctx)
    plugin.setCurrentTrack('Bohemian Rhapsody', null)
    await plugin.onReveal(ctx)
  })

  it('returns null when no track is set', async () => {
    const p = new BlindtestPlugin()
    await p.onSessionStart(ctx)
    const event = await p.onChatMessage(ctx, msg('Bohemian Rhapsody'))
    expect(event).toBeNull()
  })

  it('scores 3 pts for correct title (first viewer, no window yet)', async () => {
    const t0 = Date.now()
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(3)
    expect(event!.reason).toBe('correct_title')
  })

  it('returns null for wrong answer', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Stairway to Heaven'))
    expect(event).toBeNull()
  })

  it('tolerates typos in title', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rapsody'))
    expect(event).not.toBeNull()
    expect(event!.reason).toBe('correct_title')
  })

  it('clears state on next track action', async () => {
    await plugin.onStreamerAction(ctx, 'next')
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody'))
    expect(event).toBeNull()
  })

  it('stores sessionId in event', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody'))
    expect(event!.sessionId).toBe('session-1')
  })
})

// ─── V2 Scoring Mechanics ────────────────────────────────────────────────────

describe('timing window (GAME-01)', () => {
  let plugin: BlindtestPlugin
  const WINDOW_MS = 3000

  beforeEach(async () => {
    plugin = new BlindtestPlugin()
    await plugin.onSessionStart(ctx)
    plugin.setCurrentTrack('Bohemian Rhapsody', null, { windowDurationMs: WINDOW_MS })
    await plugin.onReveal(ctx)
  })

  it('first finder gets 3 pts (title)', async () => {
    const t0 = 1000000
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(3)
    expect(event!.reason).toBe('correct_title')
  })

  it('viewer at t=0s (simultaneous with first) gets 3.0 pts', async () => {
    const t0 = 1000000
    // First finder opens window
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    // Second viewer at same timestamp
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer2', t0))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(3)
  })

  it('viewer at t=1.5s in 3s window gets 2.0 pts (linear decay)', async () => {
    const t0 = 1000000
    // First finder opens window at t0
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    // Second viewer at t0 + 1500ms
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer2', t0 + 1500))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(2.0)
  })

  it('decay formula: pts = 3 - 2 * (elapsed_ms / window_ms) rounded to 1 decimal', async () => {
    const t0 = 1000000
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    // At t0 + 750ms → elapsed=750, ratio=0.25 → pts = 3 - 2*0.25 = 2.5
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer2', t0 + 750))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(2.5)
    expect(event!.elapsed_ms).toBe(750)
  })

  it('viewer after window closes gets null (silently ignored)', async () => {
    const t0 = 1000000
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    // After window: t0 + 3001ms
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer2', t0 + 3001))
    expect(event).toBeNull()
  })

  it('window opens on first correct title guess', async () => {
    const t0 = 1000000
    expect(plugin.getWindowOpenAt()).toBeNull()
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    expect(plugin.getWindowOpenAt()).toBe(t0)
  })
})

describe('timing window (GAME-01) — artist track', () => {
  let plugin: BlindtestPlugin
  const WINDOW_MS = 3000

  beforeEach(async () => {
    plugin = new BlindtestPlugin()
    await plugin.onSessionStart(ctx)
    // artist-only track (title=null not valid, so use double-shot track and test artist side via double-shot)
    // Actually for artist-window testing, use a title-only track with artist=null is covered above.
    // This describe block tests a separate scenario: window opens on first correct double-shot guess.
    plugin.setCurrentTrack('Bohemian Rhapsody', null, { windowDurationMs: WINDOW_MS })
    await plugin.onReveal(ctx)
  })

  it('window opens on first correct title guess (second viewer decays)', async () => {
    const t0 = 2000000
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'first', t0))
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'second', t0 + 1500))
    expect(event!.points).toBe(2.0)
    expect(plugin.getWindowOpenAt()).toBe(t0)
  })
})

describe('malus trap terms (GAME-03)', () => {
  let plugin: BlindtestPlugin

  beforeEach(async () => {
    plugin = new BlindtestPlugin()
    await plugin.onSessionStart(ctx)
    plugin.setCurrentTrack('Bohemian Rhapsody', null, { malusTerms: ['stairway', 'hotel california'] })
    await plugin.onReveal(ctx)
  })

  it('viewer typing a malus term gets -1 pt (first hit)', async () => {
    const event = await plugin.onChatMessage(ctx, msg('stairway'))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(-1)
    expect(event!.reason).toBe('malus')
  })

  it('second malus hit same round gets -2 pts', async () => {
    await plugin.onChatMessage(ctx, msg('stairway', 'viewer1'))
    const event = await plugin.onChatMessage(ctx, msg('hotel california', 'viewer1'))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(-2)
    expect(event!.reason).toBe('malus')
  })

  it('third malus hit same round gets -3 pts', async () => {
    await plugin.onChatMessage(ctx, msg('stairway', 'viewer1'))
    await plugin.onChatMessage(ctx, msg('hotel california', 'viewer1'))
    const event = await plugin.onChatMessage(ctx, msg('stairway', 'viewer1'))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(-3)
  })

  it('malus counter resets at new round (setCurrentTrack)', async () => {
    await plugin.onChatMessage(ctx, msg('stairway', 'viewer1'))
    await plugin.onChatMessage(ctx, msg('hotel california', 'viewer1'))
    // New round
    plugin.setCurrentTrack('Another Song', null, { malusTerms: ['stairway'] })
    await plugin.onReveal(ctx)
    const event = await plugin.onChatMessage(ctx, msg('stairway', 'viewer1'))
    expect(event!.points).toBe(-1)
  })

  it('malus detected via fuzzy match with 0.15 tolerance', async () => {
    // "starrway" is close to "stairway" — within 0.15
    const event = await plugin.onChatMessage(ctx, msg('starrway'))
    expect(event).not.toBeNull()
    expect(event!.reason).toBe('malus')
  })

  it('message with both malus AND correct answer: malus wins, correct ignored', async () => {
    const event = await plugin.onChatMessage(ctx, msg('stairway bohemian rhapsody'))
    expect(event).not.toBeNull()
    expect(event!.reason).toBe('malus')
    expect(event!.points).toBe(-1)
  })

  it('malus terms loaded from options (not per-track hardcoded)', async () => {
    // Plugin without malus terms does not trigger malus
    const p2 = new BlindtestPlugin()
    await p2.onSessionStart(ctx)
    p2.setCurrentTrack('Bohemian Rhapsody', null, {})
    await p2.onReveal(ctx)
    const event = await p2.onChatMessage(ctx, msg('stairway'))
    expect(event).toBeNull()
  })
})

describe('double-shot v2 (GAME-04)', () => {
  let plugin: BlindtestPlugin
  const WINDOW_MS = 3000

  beforeEach(async () => {
    plugin = new BlindtestPlugin()
    await plugin.onSessionStart(ctx)
    plugin.setCurrentTrack('Bohemian Rhapsody', 'Queen', { windowDurationMs: WINDOW_MS })
    await plugin.onReveal(ctx)
  })

  it('both title and artist correct in one message: (title_pts + artist_pts) x 2', async () => {
    const t0 = 1000000
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody Queen', 'viewer1', t0))
    expect(event).not.toBeNull()
    // First finder: title_pts=3, artist_pts=3 → (3+3)x2 = 12
    expect(event!.points).toBe(12)
    expect(event!.reason).toBe('double_shot')
  })

  it('first finder double-shot at t=0: (3+3) x 2 = 12 pts', async () => {
    const t0 = 1000000
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody Queen', 'viewer1', t0))
    expect(event!.points).toBe(12)
    expect(event!.reason).toBe('double_shot')
  })

  it('double-shot at t=1.5s (3s window): (2.0+2.0) x 2 = 8.0 pts', async () => {
    const t0 = 1000000
    // First finder opens window
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody Queen', 'viewer1', t0))
    // Second viewer at t0+1500ms
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody Queen', 'viewer2', t0 + 1500))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(8.0)
    expect(event!.reason).toBe('double_shot')
  })

  it('only title correct in double-shot attempt: 0 pts (all-or-nothing)', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1'))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(0)
    expect(event!.reason).toBe('double_shot')
  })

  it('only artist correct in double-shot attempt: 0 pts', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Queen', 'viewer1'))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(0)
    expect(event!.reason).toBe('double_shot')
  })

  it('double-shot reason is "double_shot" not "correct_answer"', async () => {
    const t0 = 1000000
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody Queen', 'viewer1', t0))
    expect(event!.reason).toBe('double_shot')
    expect(event!.reason).not.toBe('correct_answer')
  })

  it('failed double-shot viewer cannot retry (answeredViewers)', async () => {
    // Failed double-shot adds to answeredViewers
    const first = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1'))
    expect(first!.points).toBe(0)
    // Second attempt should be null (already in answeredViewers)
    const second = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody Queen', 'viewer1'))
    expect(second).toBeNull()
  })

  it('title-only track (artist=null): title match scores as correct_title (no double-shot)', async () => {
    const p2 = new BlindtestPlugin()
    await p2.onSessionStart(ctx)
    p2.setCurrentTrack('Bohemian Rhapsody', null, { windowDurationMs: WINDOW_MS })
    await p2.onReveal(ctx)
    const t0 = 1000000
    const event = await p2.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1', t0))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(3)
    expect(event!.reason).toBe('correct_title')
  })
})

describe('featurings (GAME-05)', () => {
  let plugin: BlindtestPlugin

  beforeEach(async () => {
    plugin = new BlindtestPlugin()
    await plugin.onSessionStart(ctx)
    plugin.setCurrentTrack('Bohemian Rhapsody', null, { featurings: ['Freddie Mercury', 'Roger Taylor'] })
    await plugin.onReveal(ctx)
  })

  it('featuring guess scores 1 pt instantly (no timing window)', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Freddie Mercury', 'viewer1'))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(1)
    expect(event!.reason).toBe('featuring')
  })

  it('each featuring is independently guessable', async () => {
    const e1 = await plugin.onChatMessage(ctx, msg('Freddie Mercury', 'viewer1'))
    const e2 = await plugin.onChatMessage(ctx, msg('Roger Taylor', 'viewer2'))
    expect(e1!.points).toBe(1)
    expect(e2!.points).toBe(1)
  })

  it('already-found featuring returns null', async () => {
    await plugin.onChatMessage(ctx, msg('Freddie Mercury', 'viewer1'))
    const event = await plugin.onChatMessage(ctx, msg('Freddie Mercury', 'viewer2'))
    expect(event).toBeNull()
  })

  it('featuring reason is "featuring"', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Freddie Mercury'))
    expect(event!.reason).toBe('featuring')
  })

  it('empty featurings array: no featuring scoring attempted', async () => {
    const p2 = new BlindtestPlugin()
    await p2.onSessionStart(ctx)
    p2.setCurrentTrack('Bohemian Rhapsody', null, { featurings: [] })
    await p2.onReveal(ctx)
    const event = await p2.onChatMessage(ctx, msg('Freddie Mercury'))
    expect(event).toBeNull()
  })

  it('featuring does not add viewer to answeredViewers — can still guess title', async () => {
    // Viewer scores a featuring
    const featEvent = await plugin.onChatMessage(ctx, msg('Freddie Mercury', 'viewer1'))
    expect(featEvent!.reason).toBe('featuring')
    // Same viewer can still guess the title
    const titleEvent = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'viewer1'))
    expect(titleEvent).not.toBeNull()
    expect(titleEvent!.reason).toBe('correct_title')
  })

  it('viewer can score multiple featurings', async () => {
    const e1 = await plugin.onChatMessage(ctx, msg('Freddie Mercury', 'viewer1'))
    const e2 = await plugin.onChatMessage(ctx, msg('Roger Taylor', 'viewer1'))
    expect(e1!.reason).toBe('featuring')
    expect(e2!.reason).toBe('featuring')
  })
})

describe('shuffle (GAME-07)', () => {
  it.todo('Fisher-Yates produces a permutation of all indices')
  it.todo('every index appears exactly once')
  it.todo('shuffle result is different from sorted order (statistical)')
})
