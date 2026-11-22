import type { Side } from '../../core/types'

/**
 * Reversi on an 8x8 board. Black moves first (so black is Side 'w'), starting from four discs in
 * the middle. A disc must be placed so that it closes at least one straight line (row, column or
 * diagonal) of the opponent's discs with an own disc at the other end; all closed discs turn over.
 * A player with no such move passes (the other player moves again); when neither can move the
 * game ends and the player with more discs wins.
 * Squares use the usual Reversi notation: columns a-h from the left, rows 1-8 from the top.
 */

export const SIZE = 8
/** Discs: 1 = black (first player), -1 = white. */
export const BLACK = 1
export const WHITE = -1

export interface ReversiPosition {
  /** Index row * 8 + col; row 0 is the top row ("1"). */
  board: Int8Array
  /** Side to move; when the game is over, whoever would have moved next. */
  turn: Side
}

export interface ReversiMove {
  square: number
  /** Opponent discs turned over. */
  flips: number[]
}

export const COLOR_NAMES: Record<Side, string> = { w: 'Siyah', b: 'Beyaz' }

export const colorOf = (side: Side): number => (side === 'w' ? BLACK : WHITE)
export const opponentOf = (side: Side): Side => (side === 'w' ? 'b' : 'w')
export const rowOf = (index: number): number => Math.floor(index / SIZE)
export const colOf = (index: number): number => index % SIZE

const DIRECTIONS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

export const CORNERS = [0, 7, 56, 63]

/** "a1" (top-left) .. "h8" (bottom-right) */
export function squareName(index: number): string {
  return `${'abcdefgh'[colOf(index)]}${rowOf(index) + 1}`
}

export function squareIndex(name: string): number | null {
  const match = /^([a-h])([1-8])$/.exec(name.trim().toLowerCase())
  if (!match) return null
  return (Number(match[2]) - 1) * SIZE + 'abcdefgh'.indexOf(match[1])
}

export function initialPosition(): ReversiPosition {
  const board = new Int8Array(SIZE * SIZE)
  board[squareIndex('d4')!] = WHITE
  board[squareIndex('e5')!] = WHITE
  board[squareIndex('d5')!] = BLACK
  board[squareIndex('e4')!] = BLACK
  return { board, turn: 'w' }
}

/** "x <8 rows from the top, '/'-separated>" with . x (black) o (white); x/o = side to move. */
export function encode(position: ReversiPosition): string {
  const rows: string[] = []
  for (let r = 0; r < SIZE; r++) {
    let row = ''
    for (let c = 0; c < SIZE; c++) {
      const disc = position.board[r * SIZE + c]
      row += disc === BLACK ? 'x' : disc === WHITE ? 'o' : '.'
    }
    rows.push(row)
  }
  return `${position.turn === 'w' ? 'x' : 'o'} ${rows.join('/')}`
}

export function decode(text: string): ReversiPosition {
  const [turn, rows] = text.trim().split(/\s+/)
  if ((turn !== 'x' && turn !== 'o') || !rows) throw new Error('Geçersiz Reversi pozisyonu.')
  const lines = rows.split('/')
  if (lines.length !== SIZE || lines.some((l) => l.length !== SIZE)) throw new Error('Geçersiz Reversi pozisyonu.')
  const board = new Int8Array(SIZE * SIZE)
  lines.forEach((line, r) => {
    for (let c = 0; c < SIZE; c++) {
      const ch = line[c]
      if (ch === 'x') board[r * SIZE + c] = BLACK
      else if (ch === 'o') board[r * SIZE + c] = WHITE
      else if (ch !== '.') throw new Error('Geçersiz Reversi pozisyonu.')
    }
  })
  return { board, turn: turn === 'x' ? 'w' : 'b' }
}

/** Discs that a disc of `color` on `square` would turn over (empty if the move is not legal). */
export function flipsFor(board: Int8Array, square: number, color: number): number[] {
  if (board[square] !== 0) return []
  const flips: number[] = []
  const r0 = rowOf(square)
  const c0 = colOf(square)
  for (const [dr, dc] of DIRECTIONS) {
    let r = r0 + dr
    let c = c0 + dc
    const run: number[] = []
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === -color) {
      run.push(r * SIZE + c)
      r += dr
      c += dc
    }
    if (run.length > 0 && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === color) flips.push(...run)
  }
  return flips
}

export function movesFor(board: Int8Array, side: Side): ReversiMove[] {
  const color = colorOf(side)
  const moves: ReversiMove[] = []
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) continue
    const flips = flipsFor(board, i, color)
    if (flips.length > 0) moves.push({ square: i, flips })
  }
  return moves
}

/** Legal moves of the side to move (empty only when the game is over). */
export function legalMoves(position: ReversiPosition): ReversiMove[] {
  return movesFor(position.board, position.turn)
}

/** Plays a legal move (not checked). The turn passes on unless the opponent has no move. */
export function playMove(position: ReversiPosition, move: ReversiMove): ReversiPosition {
  const board = position.board.slice()
  const color = colorOf(position.turn)
  board[move.square] = color
  for (const s of move.flips) board[s] = color
  const opponent = opponentOf(position.turn)
  if (movesFor(board, opponent).length > 0) return { board, turn: opponent }
  if (movesFor(board, position.turn).length > 0) return { board, turn: position.turn }
  return { board, turn: opponent }
}

export function findMove(position: ReversiPosition, code: string): ReversiMove | null {
  const square = squareIndex(code)
  if (square === null) return null
  return legalMoves(position).find((m) => m.square === square) ?? null
}

export interface ReversiMoveResult {
  move: ReversiMove
  position: ReversiPosition
  mover: Side
  /** The opponent had no move, so the mover plays again. */
  opponentPassed: boolean
  over: boolean
}

export function applyMove(position: ReversiPosition, code: string): ReversiMoveResult | null {
  const move = findMove(position, code)
  if (!move) return null
  const next = playMove(position, move)
  const over = legalMoves(next).length === 0
  return { move, position: next, mover: position.turn, opponentPassed: !over && next.turn === position.turn, over }
}

export function discCount(board: Int8Array): { black: number; white: number; empty: number } {
  let black = 0
  let white = 0
  for (const d of board) {
    if (d === BLACK) black++
    else if (d === WHITE) white++
  }
  return { black, white, empty: board.length - black - white }
}

/** Disc counts by side ('w' = black). */
export function countsBySide(board: Int8Array): Record<Side, number> {
  const { black, white } = discCount(board)
  return { w: black, b: white }
}

/** Winner of a finished game (more discs), or null while it goes on. */
export function winnerOf(position: ReversiPosition): Side | 'draw' | null {
  if (legalMoves(position).length > 0) return null
  const { w, b } = countsBySide(position.board)
  return w > b ? 'w' : b > w ? 'b' : 'draw'
}

/** The corner next to an X-square (diagonal) or C-square (beside the corner), or null. */
export function cornerNear(square: number): { corner: number; kind: 'x' | 'c' } | null {
  for (const corner of CORNERS) {
    const dr = Math.abs(rowOf(square) - rowOf(corner))
    const dc = Math.abs(colOf(square) - colOf(corner))
    if (dr === 1 && dc === 1) return { corner, kind: 'x' }
    if (dr + dc === 1) return { corner, kind: 'c' }
  }
  return null
}
