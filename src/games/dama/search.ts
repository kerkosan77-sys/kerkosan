import { AlphaBeta, WIN, toEngineLines, type SearchGame, type SearchOptions } from '../../core/alphabeta'
import type { EngineLine } from '../../core/types'
import {
  DRAW_QUIET_MOVES,
  KING,
  MAN,
  decode,
  legalMoves,
  moveCode,
  playMove,
  promotionRow,
  rowOf,
  type DamaMove,
  type DamaPosition,
} from './rules'

/**
 * Dama engine on the shared alpha-beta search. Scores are in centi-men (100 = one man ahead)
 * from the side to move. Captures are compulsory, so positions with a capture pending are searched
 * on past the nominal depth until they are quiet.
 */

export const MAN_VALUE = 100
export const KING_VALUE = 300
/** Bonus for a man by its distance to the promotion row (index = rows still to go). */
const ADVANCE = [0, 40, 25, 15, 9, 4, 0, 0]

export function evaluate(position: DamaPosition): number {
  const { board } = position
  let total = 0
  for (let i = 0; i < board.length; i++) {
    const piece = board[i]
    if (piece === 0) continue
    const abs = Math.abs(piece)
    let value = abs === KING ? KING_VALUE : MAN_VALUE
    if (abs === MAN) {
      const rowsToGo = Math.abs(rowOf(i) - promotionRow(piece > 0 ? 'w' : 'b'))
      value += ADVANCE[rowsToGo]
    }
    total += piece > 0 ? value : -value
  }
  return position.turn === 'w' ? total : -total
}

/** Two independent 32-bit Zobrist tables (piece + 2 = 0..4, by square), combined into a 53-bit key. */
const ZOBRIST_A = new Uint32Array(5 * 64)
const ZOBRIST_B = new Uint32Array(5 * 64)
{
  let seed = 0x2545f491
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

function key(position: DamaPosition): number {
  let a = position.turn === 'w' ? 0 : 0x9e3779b9
  let b = position.turn === 'w' ? 0 : 0x7f4a7c15
  const { board } = position
  for (let i = 0; i < 64; i++) {
    const p = board[i]
    if (p === 0) continue
    a ^= ZOBRIST_A[(p + 2) * 64 + i]
    b ^= ZOBRIST_B[(p + 2) * 64 + i]
  }
  // Near the quiet-move draw the counter matters too.
  if (position.quiet >= DRAW_QUIET_MOVES - 8) {
    a ^= Math.imul(position.quiet, 0x01000193)
    b ^= Math.imul(position.quiet, 0x85ebca6b)
  }
  return (b & 0x1fffff) * 4294967296 + (a >>> 0)
}

function forwardRank(move: DamaMove, position: DamaPosition): number {
  const to = move.path[move.path.length - 1]
  const piece = Math.abs(position.board[move.from])
  if (move.promotes) return -2
  if (piece === MAN) return rowOf(to) !== rowOf(move.from) ? 0 : 1
  return 2
}

export const damaGame: SearchGame<DamaPosition, DamaMove> = {
  moves: legalMoves,
  play: playMove,
  code: moveCode,
  key,
  terminal(position, moves, ply) {
    if (moves.length === 0) return -(WIN - ply)
    let white = 0
    let black = 0
    for (const p of position.board) {
      if (p > 0) white++
      else if (p < 0) black++
    }
    if (white === 1 && black === 1) return 0
    if (position.quiet >= DRAW_QUIET_MOVES) return 0
    return null
  },
  evaluate,
  noisy: (_position, moves) => moves.length > 0 && moves[0].captured.length > 0,
  order: (position, moves) => moves.slice().sort((a, b) => forwardRank(a, position) - forwardRank(b, position)),
}

/** Engine lines for a position string (used by the Web Worker and by tests). */
export function analyzeDama(position: string, options: SearchOptions): EngineLine[] {
  const lines = new AlphaBeta(damaGame).analyze(decode(position), { maxNodes: 3_000_000, ...options })
  return toEngineLines(lines)
}
