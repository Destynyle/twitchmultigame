// Game execution logic — populated in Epic 3
// IMPORTANT: This package must NEVER be imported by apps/web
export { normalize } from './normalizer'
export { fuzzyMatch } from './fuzzy-matcher'
export { BlindtestPlugin } from './blindtest-plugin'
export { QuizPlugin } from './quiz-plugin'
export { fisherYatesShuffle } from './shuffle'
export {
  buildBracket,
  applyWinner,
  nextOpenMatch,
  champion,
  nextPow2,
  parseVote,
} from './battle'
export type { BattleItem, Matchup, Bracket } from './battle'
