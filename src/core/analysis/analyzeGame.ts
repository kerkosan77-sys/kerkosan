import { EngineCancelledError } from '../engine'
import type { EngineLine, GameEngine, GameModule, Side } from '../types'
import { opposite } from '../types'
import { evaluateMove } from './evaluateMove'
import { summarize } from './summary'
import type { GameAnalysis } from './types'

export { ALTERNATIVE_MARGIN } from './evaluateMove'

/** Bump when the analysis or explanations change for all games: older stored analyses are then redone automatically. */
export const ANALYSIS_VERSION = 6

/** Version stored with a game's analysis: the shared version plus the game's own revision. */
export function analysisVersion(game: Pick<GameModule, 'analysisRevision'>): number {
  return ANALYSIS_VERSION + 1000 * (game.analysisRevision ?? 0)
}
/** Lines searched where the user is to move (the extra ones become puzzle answers). */
const CANDIDATE_LINES = 3
/** Lines searched where the opponent is to move: two, to see when a move was the only good one. */
const OPPONENT_LINES = 2

export interface AnalyzeOptions {
  depth?: number
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/**
 * Games with compareAfterBest: the mover's winning chances after the engine's best move, from a
 * search of that position. Null when not needed (the played move was searched next to the best one).
 */
export async function searchAfterBest(
  game: GameModule,
  engine: GameEngine,
  position: string,
  played: string,
  mover: Side,
  lines: EngineLine[],
  depth: number,
): Promise<number | null> {
  const best = lines[0]?.pv[0]
  if (!best || lines.some((line) => line.pv[0] === played)) return null
  const next = game.playAt(position, best)
  if (!next) return null
  if (next.ended) return next.ended === 'win' ? 100 : next.ended === 'loss' ? 0 : 50
  const line = (await engine.analyze(next.position, { depth, multiPV: 1 }))[0]
  if (!line) return null
  const win = game.winPercent(line.score)
  return next.turn === mover ? win : 100 - win
}

/**
 * Evaluates every position of the game with the game's engine and classifies every move of both
 * players by how much winning chance it gave away, with a short explanation for each.
 */
export async function analyzeGame(
  game: GameModule,
  engine: GameEngine,
  record: string,
  userSide: Side,
  options: AnalyzeOptions = {},
): Promise<GameAnalysis> {
  const depth = options.depth ?? game.analysisDepth
  const { moves: history, terminal } = game.readGame(record)
  const n = history.length
  if (n === 0) throw new Error('Bu oyunda hiç hamle yok.')

  const positions = [...history.map((m) => m.before), history[n - 1].after]
  // In games with extra turns the same side may move again, so ask the record, not parity.
  const sideToMove = (i: number): Side => (i < n ? history[i].side : opposite(history[n - 1].side))

  const needed: number[] = []
  for (let i = 0; i <= n; i++) if (!terminal[i]) needed.push(i)

  const evals = new Map<number, EngineLine[]>()
  const afterBest = new Map<number, number>()
  const total = needed.length + (game.compareAfterBest ? n : 0)
  let done = 0
  options.onProgress?.(0, total)
  for (const i of needed) {
    if (options.signal?.aborted) throw new EngineCancelledError()
    const multiPV = sideToMove(i) === userSide ? CANDIDATE_LINES : OPPONENT_LINES
    const lines = await engine.analyze(positions[i], { depth, multiPV })
    if (options.signal?.aborted) throw new EngineCancelledError()
    evals.set(i, lines)
    options.onProgress?.(++done, total)
    if (game.compareAfterBest && i < n) {
      const win = await searchAfterBest(game, engine, positions[i], history[i].code, history[i].side, lines, depth)
      if (options.signal?.aborted) throw new EngineCancelledError()
      if (win !== null) afterBest.set(i, win)
      options.onProgress?.(++done, total)
    }
  }

  const moves = history.map((move, i) =>
    evaluateMove({
      game,
      ply: i,
      move,
      userSide,
      lines: evals.get(i) ?? [],
      afterBestWin: afterBest.get(i) ?? null,
      ended: terminal[i + 1] ?? null,
      replyLines: evals.get(i + 1) ?? null,
      sideAfter: sideToMove(i + 1),
      nextCode: history[i + 1]?.code ?? null,
    }),
  )

  return {
    version: analysisVersion(game),
    depth,
    analyzedAt: Date.now(),
    moves,
    summary: summarize(
      moves,
      game.errorTypes.map((t) => t.id),
    ),
  }
}
