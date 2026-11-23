import type { GameRecord } from '../../db/types'
import type { Classification } from '../classify'
import { outcomeFor } from '../records'

/**
 * Points: winning and losing count most; among the moves only the best and the special ones earn
 * points, while errors cost points. Ordinary good moves (✓, ✓✓) earn nothing, so playing out an
 * easy ending move after move does not pile up points. Points are worked out again from the saved
 * games every time (nothing extra is stored), so a re-analysis or a restored backup always gives
 * the same total, and a change here applies to the old games too.
 */

export const MOVE_POINTS: Record<Classification, number> = {
  brilliant: 5,
  great: 3,
  best: 1,
  excellent: 0,
  good: 0,
  forced: 0,
  inaccuracy: -1,
  mistake: -3,
  blunder: -5,
}

/** Per bot level: a win earns WIN × level, a draw DRAW × level, a loss costs LOSS × (9 − level). */
export const RESULT_POINTS = { win: 10, draw: 4, loss: 6 } as const

/** Beating a strong bot is worth more; losing to a weak one costs more. Levels run 1-8. */
export function resultPoints(outcome: ReturnType<typeof outcomeFor>, level: number | null): number {
  if (level === null) return 0
  if (outcome === 'win') return RESULT_POINTS.win * level
  if (outcome === 'draw') return RESULT_POINTS.draw * level
  if (outcome === 'loss') return -RESULT_POINTS.loss * (9 - level)
  return 0
}

export interface GamePoints {
  /** From the user's moves (0 until the game is analysed). */
  moves: number
  /** From winning or losing against the computer. */
  result: number
  total: number
  analysed: boolean
}

export function gamePoints(game: GameRecord): GamePoints {
  let moves = 0
  for (const move of game.analysis?.moves ?? []) {
    if (move.isUserMove && move.classification) moves += MOVE_POINTS[move.classification] ?? 0
  }
  const level = game.source === 'play' && typeof game.level === 'number' ? game.level : null
  const result = resultPoints(outcomeFor(game.result, game.userSide), level)
  return { moves, result, total: moves + result, analysed: Boolean(game.analysis) }
}

export interface PointsTotal {
  total: number
  /** Points each game added (after the floor at zero), by game id. */
  perGame: Map<string, number>
}

/** `games` newest first. The running total never goes below zero. */
export function pointsTotal(games: GameRecord[]): PointsTotal {
  let total = 0
  const perGame = new Map<string, number>()
  for (const game of [...games].reverse()) {
    const before = total
    total = Math.max(0, total + gamePoints(game).total)
    perGame.set(game.id, total - before)
  }
  return { total, perGame }
}

/** "+12", "-5", "0" */
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
