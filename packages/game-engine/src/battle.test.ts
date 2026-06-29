import { describe, it, expect } from 'vitest'
import {
  buildBracket,
  applyWinner,
  nextOpenMatch,
  champion,
  nextPow2,
  parseVote,
  type BattleItem,
} from './battle'

const item = (id: string, title: string, artist: string | null = null): BattleItem => ({
  id,
  title,
  artist,
})

describe('nextPow2', () => {
  it('rounds up to the next power of two', () => {
    expect(nextPow2(1)).toBe(1)
    expect(nextPow2(2)).toBe(2)
    expect(nextPow2(3)).toBe(4)
    expect(nextPow2(5)).toBe(8)
    expect(nextPow2(8)).toBe(8)
    expect(nextPow2(9)).toBe(16)
  })
})

describe('buildBracket', () => {
  it('builds a 2-round bracket for 4 items', () => {
    const b = buildBracket([item('1', 'A'), item('2', 'B'), item('3', 'C'), item('4', 'D')])
    expect(b).toHaveLength(2) // semi + final
    expect(b[0]).toHaveLength(2)
    expect(b[1]).toHaveLength(1)
    expect(b[0]![0]!.a!.id).toBe('1')
    expect(b[0]![0]!.b!.id).toBe('2')
  })

  it('pads non-power-of-two fields with byes and auto-advances them', () => {
    const b = buildBracket([item('1', 'A'), item('2', 'B'), item('3', 'C')])
    expect(b[0]).toHaveLength(2)
    // Second matchup is C vs bye → C auto-advances into the final.
    expect(b[0]![1]!.winner).toBe('a')
    expect(b[1]![0]!.b!.id).toBe('3')
    // First matchup still open (A vs B).
    expect(b[0]![0]!.winner).toBeNull()
  })

  it('a 3-item field has its first real match as the next open match', () => {
    const b = buildBracket([item('1', 'A'), item('2', 'B'), item('3', 'C')])
    expect(nextOpenMatch(b)).toEqual({ round: 0, match: 0 })
  })
})

describe('applyWinner + propagation', () => {
  it('slots winners into the correct parent side and crowns a champion', () => {
    let b = buildBracket([item('1', 'A'), item('2', 'B'), item('3', 'C'), item('4', 'D')])
    b = applyWinner(b, 0, 0, 'a') // A beats B → final.a
    b = applyWinner(b, 0, 1, 'b') // D beats C → final.b
    expect(b[1]![0]!.a!.id).toBe('1')
    expect(b[1]![0]!.b!.id).toBe('4')
    expect(champion(b)).toBeNull() // final not played yet
    b = applyWinner(b, 1, 0, 'a')
    expect(champion(b)!.id).toBe('1')
  })

  it('does not mutate the input bracket', () => {
    const b = buildBracket([item('1', 'A'), item('2', 'B')])
    const after = applyWinner(b, 0, 0, 'a')
    expect(b[0]![0]!.winner).toBeNull()
    expect(after[0]![0]!.winner).toBe('a')
  })
})

describe('parseVote', () => {
  const a = item('1', 'Bohemian Rhapsody', 'Queen')
  const b = item('2', 'Billie Jean', 'Michael Jackson')

  it('reads numeric and side keywords', () => {
    expect(parseVote('1', a, b)).toBe('a')
    expect(parseVote('2', a, b)).toBe('b')
    expect(parseVote('gauche !!', a, b)).toBe('a')
    expect(parseVote('droite', a, b)).toBe('b')
    expect(parseVote('left', a, b)).toBe('a')
    expect(parseVote('right', a, b)).toBe('b')
  })

  it('fuzzy-matches a song title or artist', () => {
    expect(parseVote('queen', a, b)).toBe('a')
    expect(parseVote('billie jean', a, b)).toBe('b')
    expect(parseVote('bohemian rapsody', a, b)).toBe('a') // typo tolerated
  })

  it('returns null for ambiguous or unrelated messages', () => {
    expect(parseVote('lol', a, b)).toBeNull()
    expect(parseVote('', a, b)).toBeNull()
  })
})
