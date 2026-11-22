import type { EngineLine, Score } from './types'

const MATE_CP = 10000

/**
 * Converts a score to a single comparable number in the game's "cp" units.
 * Mates map to ±10000, shorter mates being larger in magnitude; "mate 0" = already lost.
 */
export function scoreToCp(score: Score): number {
  if (score.kind === 'cp') return score.value
  if (score.value === 0) return -MATE_CP
  const sign = score.value > 0 ? 1 : -1
  return sign * (MATE_CP - Math.min(Math.abs(score.value), 99) * 10)
}

/**
 * Easy computer levels look at several candidate moves and pick one with controlled
 * randomness instead of always playing the engine's choice.
 */
export interface Humanize {
  /** How many candidate moves the engine reports. */
  multiPV: number
  /** Softmax temperature in "cp" units: higher = picks weaker moves more often. */
  temperature: number
  /** Chance of playing a completely random legal move. */
  randomMoveChance: number
}

/** Picks a move from the engine's candidate lines. Pure (randomness injected) so it can be tested. */
export function pickHumanMove(
  lines: EngineLine[],
  legalMoves: string[],
  humanize: Humanize,
  random: () => number = Math.random,
): string | null {
  if (legalMoves.length === 0) return null
  if (humanize.randomMoveChance > 0 && random() < humanize.randomMoveChance) {
    return legalMoves[Math.floor(random() * legalMoves.length)] ?? legalMoves[0]
  }
  const candidates = lines.filter((line) => line.pv[0] && legalMoves.includes(line.pv[0]))
  if (candidates.length === 0) return null

  const values = candidates.map((line) => scoreToCp(line.score))
  const best = Math.max(...values)
  const temperature = Math.max(1, humanize.temperature)
  const weights = values.map((value) => Math.exp((value - best) / temperature))
  const total = weights.reduce((sum, w) => sum + w, 0)

  let roll = random() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return candidates[i].pv[0]
  }
  return candidates[candidates.length - 1].pv[0]
}
