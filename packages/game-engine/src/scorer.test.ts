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
