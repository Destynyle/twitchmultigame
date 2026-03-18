import { describe, it, expect, beforeEach } from 'vitest'
import { BlindtestPlugin } from './blindtest-plugin'
import { fuzzyMatch } from './fuzzy-matcher'
import { normalize } from './normalizer'

const ctx = {
  sessionId: 'session-1',
  tenantId: 'tenant-1',
  gameType: 'blindtest',
}

function msg(text: string, viewer = 'viewer1') {
  return {
    viewerUsername: viewer,
    viewerDisplayName: viewer,
    text,
    timestamp: new Date(),
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

  it('tolerates typos within 30%', () => {
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
})

// ─── BlindtestPlugin ──────────────────────────────────────────────────────────

describe('BlindtestPlugin', () => {
  let plugin: BlindtestPlugin

  beforeEach(async () => {
    plugin = new BlindtestPlugin()
    await plugin.onSessionStart(ctx)
    plugin.setCurrentTrack('Bohemian Rhapsody', 'Queen')
    await plugin.onReveal(ctx)
  })

  it('returns null when no track is set', async () => {
    const p = new BlindtestPlugin()
    await p.onSessionStart(ctx)
    const event = await p.onChatMessage(ctx, msg('Bohemian Rhapsody'))
    expect(event).toBeNull()
  })

  it('scores 3 pts for correct title (first viewer)', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody'))
    expect(event).not.toBeNull()
    expect(event!.points).toBe(3)
    expect(event!.reason).toBe('correct_title')
  })

  it('scores 1 pt for correct title after title already found', async () => {
    await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'first'))
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody', 'second'))
    expect(event!.points).toBe(1)
  })

  it('scores 2 pts for correct artist (first viewer)', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Queen'))
    expect(event!.points).toBe(2)
    expect(event!.reason).toBe('correct_artist')
  })

  it('scores 5 pts when title + artist matched in one message', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody Queen'))
    expect(event!.points).toBe(5)
    expect(event!.reason).toBe('correct_answer')
  })

  it('a viewer can only score once per track', async () => {
    const first = await plugin.onChatMessage(ctx, msg('Queen'))
    expect(first).not.toBeNull()
    const second = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody'))
    expect(second).toBeNull()
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

  it('stores scores keyed by game_type blindtest (sessionId in event)', async () => {
    const event = await plugin.onChatMessage(ctx, msg('Bohemian Rhapsody'))
    expect(event!.sessionId).toBe('session-1')
  })
})

// ─── V2 Scoring Mechanics ────────────────────────────────────────────────────

describe('timing window (GAME-01)', () => {
  it.todo('first finder gets 3 pts (title)')
  it.todo('first finder gets 3 pts (artist)')
  it.todo('viewer at t=1.5s in 3s window gets 2.0 pts (linear decay)')
  it.todo('viewer at t=0s (simultaneous with first) gets 3.0 pts')
  it.todo('viewer after window closes gets null (silently ignored)')
  it.todo('window opens on first correct title guess')
  it.todo('window opens on first correct artist guess')
  it.todo('decay formula: pts = 3 - 2 * (elapsed_ms / window_ms) rounded to 1 decimal')
})

describe('streak multiplier (GAME-02)', () => {
  it.todo('streak starts at 0 for new viewer')
  it.todo('streak increments by 1 after a round where viewer scored')
  it.todo('streak x1 applies multiplier 1.1 to title/artist points')
  it.todo('streak x5 applies multiplier 1.5')
  it.todo('featuring points (1pt) are NOT multiplied by streak')
  it.todo('streak resets when viewer misses a round (no score)')
  it.todo('streak resets when viewer triggers malus')
  it.todo('streak resets when double-shot fails (one of two correct)')
  it.todo('streak resets on wrong answer even if viewer later scores correctly')
  it.todo('points stored with 1 decimal place (e.g. 2.6)')
})

describe('malus trap terms (GAME-03)', () => {
  it.todo('viewer typing a malus term gets -1 pt (first hit)')
  it.todo('second malus hit same round gets -2 pts')
  it.todo('third malus hit same round gets -3 pts')
  it.todo('malus counter resets at new round')
  it.todo('malus detected via fuzzy match with 0.15 tolerance')
  it.todo('message with both malus AND correct answer: malus wins, correct ignored')
  it.todo('malus breaks streak')
  it.todo('malus terms loaded from playlist, not per-track')
})

describe('double-shot v2 (GAME-04)', () => {
  it.todo('both title and artist correct in one message: (title_pts + artist_pts) x 2')
  it.todo('first finder double-shot at t=0: (3+3) x 2 = 12 pts')
  it.todo('double-shot at t=1.5s (3s window): (2.0+2.0) x 2 = 8.0 pts')
  it.todo('only title correct in double-shot attempt: 0 pts (all-or-nothing)')
  it.todo('only artist correct in double-shot attempt: 0 pts')
  it.todo('failed double-shot resets streak')
  it.todo('double-shot reason is "double_shot" not "correct_answer"')
})

describe('featurings (GAME-05)', () => {
  it.todo('featuring guess scores 1 pt instantly (no timing window)')
  it.todo('each featuring is independently guessable')
  it.todo('already-found featuring returns null')
  it.todo('featuring points are NOT multiplied by streak')
  it.todo('featuring counts as "found this round" for streak continuation')
  it.todo('empty featurings array: no featuring scoring attempted')
  it.todo('featuring reason is "featuring"')
})

describe('shuffle (GAME-07)', () => {
  it.todo('Fisher-Yates produces a permutation of all indices')
  it.todo('every index appears exactly once')
  it.todo('shuffle result is different from sorted order (statistical)')
})
