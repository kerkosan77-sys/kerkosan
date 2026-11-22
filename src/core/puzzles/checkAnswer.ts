import { ALTERNATIVE_MARGIN } from '../analysis/analyzeGame'
import type { CandidateMove } from '../analysis/types'
import type { GameEngine, GameModule, PlayedMove, Side } from '../types'
import type { PuzzleRecord } from '../../db/types'

export type Verdict = { correct: true; isBest: boolean; label: string } | { correct: false; label: string | null }

/** Winning chances (0-100) for the solver after their move. */
export type Evaluator = (played: PlayedMove, solver: Side) => Promise<number>

type PuzzleAnswerData = Pick<PuzzleRecord, 'position' | 'playedMove' | 'bestMove' | 'candidates' | 'userSide'>

const normalize = (move: string) => move.trim().toLowerCase()

/** Wider margin when the answer and the best move are judged by two separate searches. */
export const SEPARATE_SEARCH_MARGIN = 5

export function matchCandidate(puzzle: Pick<PuzzleRecord, 'candidates'>, move: string): CandidateMove | null {
  const wanted = normalize(move)
  return puzzle.candidates.find((c) => normalize(c.move) === wanted) ?? null
}

/** A move is accepted if it keeps the winning chances within `margin` points of the best move. */
export function isAcceptable(bestWin: number, moveWin: number, margin = ALTERNATIVE_MARGIN): boolean {
  return bestWin - moveWin <= margin
}

export function bestWinOf(puzzle: Pick<PuzzleRecord, 'candidates'>): number {
  return puzzle.candidates.reduce((best, c) => Math.max(best, c.win), 0)
}

/**
 * Checks a puzzle answer. Known good moves are accepted right away, the original
 * mistake is rejected right away, a winning move is always accepted, and any
 * other legal move is evaluated by the engine. With compareAfterBest, the position
 * after the best move is evaluated too and the two results are compared.
 */
export async function checkAnswer(
  game: Pick<GameModule, 'playAt' | 'compareAfterBest'>,
  puzzle: PuzzleAnswerData,
  move: string,
  evaluate: Evaluator,
): Promise<Verdict> {
  const played = game.playAt(puzzle.position, move)
  if (!played) return { correct: false, label: null }

  if (matchCandidate(puzzle, move)) {
    return { correct: true, isBest: normalize(move) === normalize(puzzle.bestMove), label: played.label }
  }
  if (normalize(move) === normalize(puzzle.playedMove)) return { correct: false, label: played.label }
  if (played.ended === 'win') return { correct: true, isBest: false, label: played.label }

  const win = await evaluate(played, puzzle.userSide)
  const afterBest = game.compareAfterBest ? game.playAt(puzzle.position, puzzle.bestMove) : null
  const acceptable = afterBest
    ? isAcceptable(await evaluate(afterBest, puzzle.userSide), win, SEPARATE_SEARCH_MARGIN)
    : isAcceptable(bestWinOf(puzzle), win)
  return acceptable
    ? { correct: true, isBest: false, label: played.label }
    : { correct: false, label: played.label }
}

/** Evaluator backed by the game's engine. */
export function engineEvaluator(game: Pick<GameModule, 'winPercent'>, engine: GameEngine, depth: number): Evaluator {
  return async (played, solver) => {
    if (played.ended === 'win') return 100
    if (played.ended === 'loss') return 0
    if (played.ended === 'draw') return 50
    const line = (await engine.analyze(played.position, { depth, multiPV: 1 }))[0]
    if (!line) return 50
    const win = game.winPercent(line.score)
    return played.turn === solver ? win : 100 - win
  }
}
