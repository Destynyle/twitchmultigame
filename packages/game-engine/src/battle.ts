import { normalize } from './normalizer'
import { fuzzyMatch } from './fuzzy-matcher'

// ─── Pure battle-mode logic: bracket building + vote parsing ──────────────────
// No I/O, no state — the app's BattleController orchestrates around these.

export interface BattleItem {
  id: string
  title: string
  artist: string | null
}

export interface Matchup {
  /** null = empty slot (a future round, or a bye) */
  a: BattleItem | null
  b: BattleItem | null
  winner: 'a' | 'b' | null
}

/** Single-elimination bracket: an array of rounds, each an array of matchups. */
export type Bracket = Matchup[][]

/** Smallest power of two >= n (min 1). */
export function nextPow2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Build a single-elimination bracket from a seed list. The field is padded to
 * the next power of two with byes (null slots). Round 0 holds the first-round
 * pairings; later rounds start empty and fill in as winners are applied. Any
 * first-round matchup with a single contestant (bye) is auto-advanced.
 */
export function buildBracket(items: BattleItem[]): Bracket {
  const size = nextPow2(Math.max(2, items.length))
  const seeds: (BattleItem | null)[] = items.slice()
  while (seeds.length < size) seeds.push(null)

  const rounds: Bracket = []
  const first: Matchup[] = []
  for (let i = 0; i < size; i += 2) {
    first.push({ a: seeds[i] ?? null, b: seeds[i + 1] ?? null, winner: null })
  }
  rounds.push(first)

  let count = first.length
  while (count > 1) {
    count = Math.floor(count / 2)
    rounds.push(Array.from({ length: count }, () => ({ a: null, b: null, winner: null })))
  }

  // Auto-resolve byes in the first round and propagate.
  let out = rounds
  out[0]!.forEach((m, i) => {
    if (m.a && !m.b) out = applyWinner(out, 0, i, 'a')
    else if (!m.a && m.b) out = applyWinner(out, 0, i, 'b')
  })
  return out
}

function clone(b: Bracket): Bracket {
  return b.map((round) => round.map((m) => ({ ...m })))
}

/**
 * Record a matchup winner and slot them into the parent matchup of the next
 * round. Returns a new bracket (does not mutate the input).
 */
export function applyWinner(
  bracket: Bracket,
  round: number,
  match: number,
  winner: 'a' | 'b',
): Bracket {
  const b = clone(bracket)
  const mu = b[round]![match]!
  mu.winner = winner
  const w = winner === 'a' ? mu.a : mu.b
  const next = b[round + 1]
  if (next && w) {
    const parent = next[Math.floor(match / 2)]!
    if (match % 2 === 0) parent.a = w
    else parent.b = w
  }
  return b
}

/** Coordinates of the next matchup that has two contestants and no winner yet. */
export function nextOpenMatch(bracket: Bracket): { round: number; match: number } | null {
  for (let r = 0; r < bracket.length; r++) {
    const round = bracket[r]!
    for (let i = 0; i < round.length; i++) {
      const m = round[i]!
      if (m.a && m.b && !m.winner) return { round: r, match: i }
    }
  }
  return null
}

/** The tournament winner once the final matchup is decided, else null. */
export function champion(bracket: Bracket): BattleItem | null {
  const final = bracket[bracket.length - 1]?.[0]
  if (!final || !final.winner) return null
  return final.winner === 'a' ? final.a : final.b
}

// ─── Vote parsing ─────────────────────────────────────────────────────────────
// Fuzzy, forgiving: a chat vote can be a side keyword (1/2, left/right,
// gauche/droite…) or a fuzzy match against either song's title or artist.

const A_WORDS = new Set(['1', 'a', 'g', 'gauche', 'left', 'un', 'one', 'premier', 'first'])
const B_WORDS = new Set(['2', 'b', 'd', 'droite', 'right', 'deux', 'two', 'second', 'seconde'])

/**
 * Resolve a chat message to a vote for matchup side 'a' or 'b', or null if it
 * isn't a recognizable vote. Side keywords win first; otherwise a fuzzy title /
 * artist match decides, but only when it's unambiguous (one side, not both).
 */
export function parseVote(text: string, a: BattleItem, b: BattleItem): 'a' | 'b' | null {
  const t = normalize(text)
  if (!t) return null

  const first = t.split(' ')[0]!
  if (A_WORDS.has(t) || A_WORDS.has(first)) return 'a'
  if (B_WORDS.has(t) || B_WORDS.has(first)) return 'b'

  const aHit = fuzzyMatch(t, a.title) || (a.artist ? fuzzyMatch(t, a.artist) : false)
  const bHit = fuzzyMatch(t, b.title) || (b.artist ? fuzzyMatch(t, b.artist) : false)
  if (aHit && !bHit) return 'a'
  if (bHit && !aHit) return 'b'
  return null
}
