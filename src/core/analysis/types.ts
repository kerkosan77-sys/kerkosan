import type { Classification } from '../classify'
import type { Side } from '../types'

/** A move the engine considers about as good as the best one. */
export interface CandidateMove {
  move: string
  label: string
  /** Winning chances (0-100) for the side to move after playing it. */
  win: number
}

export interface MoveAnalysis {
  ply: number
  label: string
  code: string
  side: Side
  before: string
  after: string
  isUserMove: boolean
  /** Winning chances for the user (0-100) before the move with best play, and after the move (for both players' moves). */
  winBefore?: number
  winAfter?: number
  bestMove?: string
  bestLabel?: string
  /** Best moves from the position before the move (for puzzles). */
  candidates?: CandidateMove[]
  classification?: Classification
  drop?: number
  /** Short explanation; every move gets one. */
  explanation?: string
  /** Error category, for the user's inaccuracies, mistakes and blunders. */
  errorType?: string
  /** After an opponent's error: the user's best reply, shown on the board. */
  replyMove?: string
}

export interface GameSummary {
  userMoves: number
  /** The user's moves by class. */
  counts: Record<Classification, number>
  /** The opponent's moves by class. */
  opponentCounts?: Record<Classification, number>
  /** Error types of mistakes and blunders. */
  errorTypes: Record<string, number>
  topErrorType?: string
}

export interface GameAnalysis {
  version: number
  depth: number
  analyzedAt: number
  moves: MoveAnalysis[]
  summary: GameSummary
}
