import { normalize } from './normalizer'

/** Levenshtein edit distance between two strings */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,      // deletion
        matrix[i]![j - 1]! + 1,      // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      )
    }
  }
  return matrix[b.length]![a.length]!
}

/**
 * Returns true if `input` fuzzy-matches `target` within the given
 * Levenshtein tolerance ratio (default 0.15 = 15%).
 *
 * Match is positive if:
 * - the normalized input contains the normalized target as a substring, OR
 * - the Levenshtein distance ratio is within the tolerance.
 *
 * Very short targets (< 3 chars) require an exact match or substring inclusion.
 */
export function fuzzyMatch(input: string, target: string, tolerance = 0.15): boolean {
  const normInput = normalize(input)
  const normTarget = normalize(target)

  if (normInput.length === 0 || normTarget.length === 0) return false

  // Substring inclusion (handles "Bohemian Rhapsody Queen" matching both title and artist)
  if (normInput.includes(normTarget)) return true

  // Very short targets require exact/inclusion match only
  if (normTarget.length < 3) return false

  const maxLen = Math.max(normInput.length, normTarget.length)
  const dist = levenshtein(normInput, normTarget)
  return dist / maxLen <= tolerance
}
