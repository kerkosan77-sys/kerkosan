import type { Score } from '../engine/uci'

const MATE_CP = 10000

/**
 * Converts a score to a single centipawn number (useful for sorting/comparing).
 * Mates map to ±10000, shorter mates being larger in magnitude.
 * "mate 0" means the side to move is already checkmated.
 */
export function scoreToCp(score: Score): number {
  if (score.kind === 'cp') return score.value
  if (score.value === 0) return -MATE_CP
  const sign = score.value > 0 ? 1 : -1
  return sign * (MATE_CP - Math.min(Math.abs(score.value), 99) * 10)
}

/** Flips a score to the other side's point of view. */
export function negateScore(score: Score): Score {
  if (score.kind === 'cp') return { kind: 'cp', value: -score.value }
  // "mate 0" (side to move is mated) becomes a win for the other side.
  if (score.value === 0) return { kind: 'mate', value: 1 }
  return { kind: 'mate', value: -score.value }
}

/**
 * Winning chances in percent (0-100) for the side whose point of view the score is from.
 * Same curve Lichess uses; mates count as 100% / 0%.
 */
export function winPercent(score: Score): number {
  if (score.kind === 'mate') return score.value > 0 ? 100 : 0
  const cp = Math.max(-1000, Math.min(1000, score.value))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}
