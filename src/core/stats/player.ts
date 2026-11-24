import type { GameRecord } from '../../db/types'
import { sortedErrorTypes } from '../analysis/summary'
import { outcomeFor, type RecordOutcome } from '../records'
import type { GameModule, GamePhase, Side } from '../types'
import { analysable } from '../analysable'
import { pointsTotal } from './points'

/**
 * The player summary on the home screen: how strong the user plays (as a bot level, not points),
 * which bot to play next, which part of the game goes wrong most, and the latest games.
 */

/** Games used for the playing level and the error figures. */
export const SUMMARY_WINDOW = 10
const RECENT_GAMES = 6
const PHASES: GamePhase[] = ['opening', 'middlegame', 'endgame']

export interface PhaseStat {
  phase: GamePhase
  moves: number
  errors: number
  /** Mistakes and blunders per 10 of the user's moves. */
  per10: number
}

export interface RecentGame {
  id: string
  outcome: RecordOutcome
  level: number | null
  createdAt: number
  /** The user's mistakes and blunders, if analysed. */
  errors: number | null
  /** False for games whose moves are never analysed (Go on the big boards). */
  analysable: boolean
  /** Points this game added to the total. */
  points: number
}

export interface PlayerSummary {
  /** Games against the computer used for the level. */
  rated: number
  /** The bot level the user plays like (1..max), or null with too few games. */
  level: number | null
  /** The bot level to play next. */
  recommended: number
  /** Why that level is suggested. */
  reason: string
  phases: PhaseStat[]
  /** The part of the game with the most errors (enough moves only), or null. */
  weakest: GamePhase | null
  /** Most common error types in recent analysed games, most frequent first. */
  topErrors: [string, number][]
  /** The user's worst error in the latest analysed game (for "Dikkat et"), or null. */
  lastMistake: { gameId: string; ply: number; side: Side; label: string; errorType: string } | null
  recent: RecentGame[]
  /** Total points, and what the latest game added (null without games). */
  points: number
  lastPoints: number | null
  /** Mistakes and blunders per 10 moves in the last 10 analysed games, and in the 10 before (null if too few). */
  errorRate: number | null
  previousErrorRate: number | null
}

type ModuleInfo = Pick<GameModule, 'levels' | 'defaultLevel' | 'phaseOf' | 'errorTypes'> &
  Partial<Pick<GameModule, 'canAnalyse' | 'position' | 'stateFromRecord'>>

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** `games` newest first (as listGames returns them). */
export function playerSummary(games: GameRecord[], game: ModuleInfo): PlayerSummary {
  const maxLevel = Math.max(...game.levels.map((l) => l.id))
  const minLevel = Math.min(...game.levels.map((l) => l.id))

  // Playing level: beating a bot of level L counts as playing at L+1, losing as L-1, a draw as L.
  const rated = games
    .filter((g) => g.source === 'play' && typeof g.level === 'number')
    .map((g) => ({ level: g.level as number, outcome: outcomeFor(g.result, g.userSide) }))
    .filter((g) => g.outcome !== 'unknown')
    .slice(0, SUMMARY_WINDOW)
  const performance = rated.map((g) => clamp(g.level + (g.outcome === 'win' ? 1 : g.outcome === 'loss' ? -1 : 0), minLevel, maxLevel))
  const level = performance.length >= 2 ? Math.round(performance.reduce((a, b) => a + b, 0) / performance.length) : null

  // Next bot: move up after winning two of the last three games at the same level, down after losing two.
  let recommended = game.defaultLevel
  let reason = 'Başlamak için önerilen seviye.'
  if (rated.length > 0) {
    const current = rated[0].level
    const sameLevel = rated.filter((g) => g.level === current).slice(0, 3)
    const wins = sameLevel.filter((g) => g.outcome === 'win').length
    const losses = sameLevel.filter((g) => g.outcome === 'loss').length
    if (wins >= 2 && current < maxLevel) {
      recommended = current + 1
      reason = `Bu seviyede son ${sameLevel.length} oyunun ${wins} tanesini kazandın: bir üst seviyeyi dene.`
    } else if (losses >= 2 && current > minLevel) {
      recommended = current - 1
      reason = `Bu seviyede son ${sameLevel.length} oyunun ${losses} tanesini kaybettin: bir alt seviyede pekiş.`
    } else {
      recommended = current
      reason = 'Bu seviye sana uygun: biraz daha bu seviyede oyna.'
    }
  }

  // Errors by part of the game, from the latest analysed games.
  const analysed = games.filter((g) => g.analysis).slice(0, SUMMARY_WINDOW)
  const byPhase = new Map<GamePhase, { moves: number; errors: number }>(PHASES.map((p) => [p, { moves: 0, errors: 0 }]))
  const errorTypes: Record<string, number> = {}
  for (const record of analysed) {
    for (const move of record.analysis!.moves) {
      if (!move.isUserMove || !move.classification) continue
      const phase = game.phaseOf?.(move.before, move.ply) ?? 'middlegame'
      const stat = byPhase.get(phase)!
      stat.moves++
      if (move.classification === 'mistake' || move.classification === 'blunder') stat.errors++
    }
    for (const [type, count] of Object.entries(record.analysis!.summary.errorTypes)) {
      errorTypes[type] = (errorTypes[type] ?? 0) + count
    }
  }
  const phases = PHASES.map((phase) => {
    const { moves, errors } = byPhase.get(phase)!
    return { phase, moves, errors, per10: moves > 0 ? (errors / moves) * 10 : 0 }
  })
  const candidates = phases.filter((p) => p.moves >= 5 && p.errors > 0)
  const weakest = candidates.length > 0 ? candidates.reduce((a, b) => (b.per10 > a.per10 ? b : a)).phase : null

  const { total, perGame } = pointsTotal(games)
  const allAnalysed = games.filter((g) => g.analysis)
  const rate = (list: GameRecord[]) => {
    let moves = 0
    let errors = 0
    for (const record of list) {
      for (const move of record.analysis!.moves) {
        if (!move.isUserMove || !move.classification) continue
        moves++
        if (move.classification === 'mistake' || move.classification === 'blunder') errors++
      }
    }
    return moves > 0 ? (errors / moves) * 10 : null
  }
  const previousGames = allAnalysed.slice(SUMMARY_WINDOW, 2 * SUMMARY_WINDOW)

  const recent = games.slice(0, RECENT_GAMES).map((g) => ({
    id: g.id,
    outcome: outcomeFor(g.result, g.userSide),
    level: typeof g.level === 'number' ? g.level : null,
    createdAt: g.playedAt ?? g.createdAt,
    errors: g.analysis ? g.analysis.summary.counts.mistake + g.analysis.summary.counts.blunder : null,
    analysable: g.analysis ? true : analysable(game, g.record),
    points: perGame.get(g.id) ?? 0,
  }))

  return {
    rated: rated.length,
    level,
    recommended,
    reason,
    phases,
    weakest,
    topErrors: sortedErrorTypes(
      errorTypes,
      game.errorTypes.map((t) => t.id),
    ).slice(0, 3),
    lastMistake: lastMistakeOf(analysed[0]),
    recent,
    points: total,
    lastPoints: games.length > 0 ? (perGame.get(games[0].id) ?? 0) : null,
    errorRate: rate(allAnalysed.slice(0, SUMMARY_WINDOW)),
    previousErrorRate: previousGames.length >= 3 ? rate(previousGames) : null,
  }
}

/** The biggest blunder (or else mistake) the user made in a game, for a concrete "Dikkat et" note. */
function lastMistakeOf(game: GameRecord | undefined): PlayerSummary['lastMistake'] {
  if (!game?.analysis) return null
  const errors = game.analysis.moves.filter((m) => m.isUserMove && (m.classification === 'blunder' || m.classification === 'mistake'))
  if (errors.length === 0) return null
  const rank = (m: (typeof errors)[number]) => (m.classification === 'blunder' ? 1000 : 0) + (m.drop ?? 0)
  const worst = errors.reduce((a, b) => (rank(b) > rank(a) ? b : a))
  return { gameId: game.id, ply: worst.ply, side: worst.side, label: worst.label, errorType: worst.errorType ?? 'other' }
}
