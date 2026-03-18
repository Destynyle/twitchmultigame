/**
 * Fisher-Yates (Knuth) shuffle — returns a shuffled array of indices [0..length-1].
 * Each index appears exactly once. O(n) time, O(n) space.
 */
export function fisherYatesShuffle(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}
