import type { GameId, Level } from '../types'

/**
 * Points levels: a game's running points total is shown as one of its 8 levels (Çok kolay … Usta),
 * so the points always say how far the user has come. Each move earns or costs points, so a game
 * with more moves per game moves the total faster and gets wider ranges.
 */

/** Where each level starts, level 1 first. About how many of the user's moves one game has is in the note. */
export const RANK_START: Record<GameId, number[]> = {
  // about 20 moves per game
  mangala: [0, 50, 125, 250, 425, 650, 950, 1300],
  // about 30
  reversi: [0, 75, 200, 375, 650, 1000, 1400, 1950],
  // about 40
  chess: [0, 100, 250, 500, 850, 1300, 1900, 2600],
  // about 50
  dama: [0, 125, 300, 650, 1050, 1650, 2400, 3250],
  // about 50 on the 9x9 board, counting the moves that close the borders at the end
  go: [0, 125, 300, 650, 1050, 1650, 2400, 3250],
}

export interface RankStep {
  level: number
  name: string
  /** First points total of this level. */
  min: number
  /** Last points total of this level (null for the top level). */
  max: number | null
}

/** All levels of a game with their points ranges. */
export function rankLadder(gameId: GameId, levels: Level[]): RankStep[] {
  const starts = RANK_START[gameId]
  return [...levels]
    .sort((a, b) => a.id - b.id)
    .map((level, index) => ({
      level: level.id,
      name: level.name,
      min: starts[Math.min(index, starts.length - 1)],
      max: index + 1 < starts.length && index + 1 < levels.length ? starts[index + 1] - 1 : null,
    }))
}

export interface PointsRank extends RankStep {
  /** The next level, or null at the top. */
  next: RankStep | null
  /** Points still needed for the next level (0 at the top). */
  toNext: number
  /** 0..1: how far along this level the total is (1 at the top). */
  progress: number
}

/** The level a points total belongs to. */
export function pointsRank(points: number, gameId: GameId, levels: Level[]): PointsRank {
  const ladder = rankLadder(gameId, levels)
  let index = 0
  while (index + 1 < ladder.length && points >= ladder[index + 1].min) index++
  const step = ladder[index]
  const next = ladder[index + 1] ?? null
  return {
    ...step,
    next,
    toNext: next ? next.min - points : 0,
    progress: next ? Math.max(0, Math.min(1, (points - step.min) / (next.min - step.min))) : 1,
  }
}

/** "100–249 puan", "2.600+ puan" */
export function rangeText(step: RankStep): string {
  const n = (value: number) => value.toLocaleString('tr-TR')
  return step.max === null ? `${n(step.min)}+ puan` : `${n(step.min)}–${n(step.max)} puan`
}
