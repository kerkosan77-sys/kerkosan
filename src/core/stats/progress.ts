import type { AttemptRecord, GameRecord } from '../../db/types'

export const GAME_WINDOW = 10
export const ATTEMPT_WINDOW = 50

export interface BlunderStats {
  /** Average blunders per game over the most recent analysed games, or null without data. */
  average: number | null
  /** How many games the average is based on (up to GAME_WINDOW). */
  games: number
  /** Same average for the GAME_WINDOW games before those, if there are at least 3. */
  previous: number | null
}

const playedTime = (game: GameRecord) => game.playedAt ?? game.createdAt

function averageBlunders(games: GameRecord[]): number {
  return games.reduce((sum, game) => sum + (game.analysis?.summary.counts.blunder ?? 0), 0) / games.length
}

export function blunderStats(games: GameRecord[], window = GAME_WINDOW): BlunderStats {
  const analysed = games.filter((g) => g.analysis).sort((a, b) => playedTime(b) - playedTime(a))
  const recent = analysed.slice(0, window)
  const before = analysed.slice(window, window * 2)
  return {
    average: recent.length ? averageBlunders(recent) : null,
    games: recent.length,
    previous: before.length >= 3 ? averageBlunders(before) : null,
  }
}

/**
 * Blunder averages split by how the game was played: learning mode (coach on) versus
 * unassisted games (playing mode, plus games imported from outside, which were real games).
 */
export function blunderStatsByMode(games: GameRecord[], window = GAME_WINDOW): { learn: BlunderStats; unassisted: BlunderStats } {
  return {
    learn: blunderStats(
      games.filter((g) => g.mode === 'learn'),
      window,
    ),
    unassisted: blunderStats(
      games.filter((g) => g.mode !== 'learn'),
      window,
    ),
  }
}

export interface PuzzleStats {
  /** Share of attempts solved on the first try (0-100), or null without attempts. */
  rate: number | null
  attempts: number
}

/** `attempts` should be the most recent ones; only the first ATTEMPT_WINDOW are used. */
export function puzzleStats(attempts: AttemptRecord[], window = ATTEMPT_WINDOW): PuzzleStats {
  const recent = attempts.slice(0, window)
  if (recent.length === 0) return { rate: null, attempts: 0 }
  const firstTry = recent.filter((a) => a.result === 'correct').length
  return { rate: (firstTry / recent.length) * 100, attempts: recent.length }
}

/** 1.5 -> "1,5" */
export function formatDecimal(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: value % 1 === 0 ? 0 : 1 })
}
