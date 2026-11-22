import { AlphaBeta, WIN, toEngineLines, type SearchGame, type SearchOptions } from '../../core/alphabeta'
import type { EngineLine } from '../../core/types'
import {
  colorOf,
  cornerNear,
  decode,
  discCount,
  legalMoves,
  movesFor,
  opponentOf,
  playMove,
  squareName,
  type ReversiMove,
  type ReversiPosition,
} from './rules'

/**
 * Reversi engine on the shared alpha-beta search. The evaluation (from the side to move) adds up
 * square values (corners high, the squares next to an empty corner low), mobility (how many moves
 * each side has) and, late in the game, the disc count. Near the end the search runs to the last
 * move, so the result is exact.
 */

// prettier-ignore
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, -1, -1, -1, -1, -2, 10,
  5, -2, -1, -1, -1, -1, -2, 5,
  5, -2, -1, -1, -1, -1, -2, 5,
  10, -2, -1, -1, -1, -1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
]

/** A square's value; next to an occupied corner the danger is gone. */
function weightOf(board: Int8Array, square: number): number {
  const w = WEIGHTS[square]
  if (w >= 0) return w
  const near = cornerNear(square)
  return near && board[near.corner] !== 0 ? 5 : w
}

export function evaluate(position: ReversiPosition): number {
  const { board, turn } = position
  const me = colorOf(turn)
  let positional = 0
  for (let i = 0; i < 64; i++) {
    const disc = board[i]
    if (disc !== 0) positional += disc === me ? weightOf(board, i) : -weightOf(board, i)
  }
  const mine = movesFor(board, turn).length
  const theirs = movesFor(board, opponentOf(turn)).length
  const mobility = (80 * (mine - theirs)) / (mine + theirs + 2)
  const { black, white, empty } = discCount(board)
  const discs = (me === 1 ? black - white : white - black) * (empty < 16 ? 4 : 0)
  return Math.round(positional + mobility + discs)
}

const ZOBRIST_A = new Uint32Array(2 * 64)
const ZOBRIST_B = new Uint32Array(2 * 64)
{
  let seed = 0x6c078965
  const next = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return seed >>> 0
  }
  for (let i = 0; i < ZOBRIST_A.length; i++) {
    ZOBRIST_A[i] = next()
    ZOBRIST_B[i] = next()
  }
}

function key(position: ReversiPosition): number {
  let a = position.turn === 'w' ? 0 : 0x9e3779b9
  let b = position.turn === 'w' ? 0 : 0x7f4a7c15
  const { board } = position
  for (let i = 0; i < 64; i++) {
    const d = board[i]
    if (d === 0) continue
    const k = (d === 1 ? 0 : 64) + i
    a ^= ZOBRIST_A[k]
    b ^= ZOBRIST_B[k]
  }
  return (b & 0x1fffff) * 4294967296 + (a >>> 0)
}

export const reversiGame: SearchGame<ReversiPosition, ReversiMove> = {
  moves: legalMoves,
  play: playMove,
  code: (move) => squareName(move.square),
  key,
  side: (position) => position.turn,
  terminal(position, moves, ply) {
    if (moves.length > 0) return null
    const { black, white } = discCount(position.board)
    const diff = colorOf(position.turn) === 1 ? black - white : white - black
    return diff > 0 ? WIN - ply : diff < 0 ? -(WIN - ply) : 0
  },
  evaluate,
  order: (position, moves) => moves.slice().sort((a, b) => weightOf(position.board, b.square) - weightOf(position.board, a.square)),
}

/** Empty squares from which the search runs to the end of the game, by search depth. */
export function exactFrom(depth: number): number {
  return depth >= 9 ? 14 : depth >= 6 ? 10 : depth >= 4 ? 8 : 0
}

/** Engine lines for a position string (used by the Web Worker and by tests). */
export function analyzeReversi(position: string, options: SearchOptions): EngineLine[] {
  const root = decode(position)
  const empty = discCount(root.board).empty
  const depth = empty <= exactFrom(options.depth) ? Math.max(options.depth, empty) : options.depth
  const lines = new AlphaBeta(reversiGame).analyze(root, { maxNodes: 3_000_000, ...options, depth })
  return toEngineLines(lines)
}
