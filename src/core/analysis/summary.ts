import { CLASSIFICATIONS, type Classification } from '../classify'
import type { GameSummary, MoveAnalysis } from './types'

export const emptyCounts = (): Record<Classification, number> =>
  Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>

/**
 * Counts both players' move classes and the user's error types (of mistakes and blunders).
 * `priority` lists error types most fundamental first; it breaks ties and "other" comes last.
 */
export function summarize(moves: MoveAnalysis[], priority: string[] = []): GameSummary {
  const counts = emptyCounts()
  const opponentCounts = emptyCounts()
  const errorTypes: Record<string, number> = {}
  let userMoves = 0

  for (const move of moves) {
    if (!move.classification) continue
    if (!move.isUserMove) {
      opponentCounts[move.classification]++
      continue
    }
    userMoves++
    counts[move.classification]++
    if ((move.classification === 'mistake' || move.classification === 'blunder') && move.errorType) {
      errorTypes[move.errorType] = (errorTypes[move.errorType] ?? 0) + 1
    }
  }

  const summary: GameSummary = { userMoves, counts, opponentCounts, errorTypes }
  const top = sortedErrorTypes(errorTypes, priority)[0]
  if (top) summary.topErrorType = top[0]
  return summary
}

/** Error types with their counts, most frequent first. */
export function sortedErrorTypes(errorTypes: Record<string, number>, priority: string[] = []): [string, number][] {
  const rank = (type: string) => {
    if (type === 'other') return Number.MAX_SAFE_INTEGER
    const index = priority.indexOf(type)
    return index === -1 ? priority.length : index
  }
  return Object.entries(errorTypes)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]))
}
