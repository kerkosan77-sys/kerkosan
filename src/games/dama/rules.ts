import type { Side } from '../../core/types'

/**
 * Turkish draughts (Dama) on an 8x8 board, 16 pieces each.
 * - Men move one square forward or sideways and capture the same way (never backwards or diagonally).
 * - Capturing is compulsory and the sequence that takes the most pieces must be chosen.
 *   Jumped pieces leave the board at once, so their squares may be crossed later in the same move.
 * - A man on the far row becomes a dama (king); mid-capture it goes on capturing as a dama.
 * - A dama moves and captures along rows and columns over any distance, landing on any empty square
 *   beyond the piece it takes, but may not turn back (180 degrees) between two captures.
 * - A player with no legal move loses. Draws: one piece each, the same position three times, or
 *   32 dama moves in a row without a capture.
 * White moves first, so white is Side 'w'.
 */

export const SIZE = 8
/** Pieces: positive = white, negative = black; 1 = man, 2 = dama. */
export const MAN = 1
export const KING = 2
export const DRAW_QUIET_MOVES = 32

export interface DamaPosition {
  /** Index row * 8 + col; row 0 is the 8th rank (black's back row). */
  board: Int8Array
  turn: Side
  /** Dama moves in a row without a capture or a man move. */
  quiet: number
}

export interface DamaMove {
  from: number
  /** Squares the piece stops on, in order (one square for a plain move). */
  path: number[]
  /** Pieces taken, in order. */
  captured: number[]
  /** The man becomes a dama during this move. */
  promotes: boolean
}

export const COLOR_NAMES: Record<Side, string> = { w: 'Beyaz', b: 'Siyah' }

export const signOf = (side: Side): number => (side === 'w' ? 1 : -1)
export const sideOfPiece = (piece: number): Side | null => (piece > 0 ? 'w' : piece < 0 ? 'b' : null)
export const opponentOf = (side: Side): Side => (side === 'w' ? 'b' : 'w')
const forwardOf = (side: Side): number => (side === 'w' ? -1 : 1)
export const promotionRow = (side: Side): number => (side === 'w' ? 0 : SIZE - 1)
export const rowOf = (index: number): number => Math.floor(index / SIZE)
export const colOf = (index: number): number => index % SIZE

const DIRECTIONS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

/** "a1" .. "h8" (a1 = white's bottom-left corner). */
export function squareName(index: number): string {
  return `${'abcdefgh'[colOf(index)]}${SIZE - rowOf(index)}`
}

export function squareIndex(name: string): number | null {
  const match = /^([a-h])([1-8])$/.exec(name.trim().toLowerCase())
  if (!match) return null
  return (SIZE - Number(match[2])) * SIZE + 'abcdefgh'.indexOf(match[1])
}

export function initialPosition(): DamaPosition {
  const board = new Int8Array(SIZE * SIZE)
  for (let c = 0; c < SIZE; c++) {
    board[1 * SIZE + c] = -MAN
    board[2 * SIZE + c] = -MAN
    board[5 * SIZE + c] = MAN
    board[6 * SIZE + c] = MAN
  }
  return { board, turn: 'w', quiet: 0 }
}

const PIECE_CHARS: Record<number, string> = { 0: '.', 1: 'w', 2: 'W', [-1]: 'b', [-2]: 'B' }
const CHAR_PIECES: Record<string, number> = { '.': 0, w: 1, W: 2, b: -1, B: -2 }

/** "w <8 rows from the 8th rank, '/'-separated> <quiet>" with . w W b B */
export function encode(position: DamaPosition): string {
  const rows: string[] = []
  for (let r = 0; r < SIZE; r++) {
    let row = ''
    for (let c = 0; c < SIZE; c++) row += PIECE_CHARS[position.board[r * SIZE + c]]
    rows.push(row)
  }
  return `${position.turn} ${rows.join('/')} ${position.quiet}`
}

export function decode(text: string): DamaPosition {
  const [turn, rows, quiet] = text.trim().split(/\s+/)
  if ((turn !== 'w' && turn !== 'b') || !rows) throw new Error('Geçersiz Dama pozisyonu.')
  const lines = rows.split('/')
  if (lines.length !== SIZE || lines.some((l) => l.length !== SIZE)) throw new Error('Geçersiz Dama pozisyonu.')
  const board = new Int8Array(SIZE * SIZE)
  lines.forEach((line, r) => {
    for (let c = 0; c < SIZE; c++) {
      const piece = CHAR_PIECES[line[c]]
      if (piece === undefined) throw new Error('Geçersiz Dama pozisyonu.')
      board[r * SIZE + c] = piece
    }
  })
  return { board, turn, quiet: Number(quiet) || 0 }
}

/** Board and side to move only (used to spot repeated positions). */
export function boardKey(position: DamaPosition): string {
  return encode(position).split(' ').slice(0, 2).join(' ')
}

/** Whether the piece on `from` can start a capture (a quick check before the full search). */
function canCapture(board: Int8Array, from: number, side: Side): boolean {
  const own = signOf(side)
  const back = -forwardOf(side)
  const king = Math.abs(board[from]) === KING
  const r0 = rowOf(from)
  const c0 = colOf(from)
  for (let d = 0; d < 4; d++) {
    const [dr, dc] = DIRECTIONS[d]
    if (!king && dr === back) continue
    let r = r0 + dr
    let c = c0 + dc
    if (king) while (inside(r, c) && board[r * SIZE + c] === 0) {
      r += dr
      c += dc
    }
    if (!inside(r, c) || board[r * SIZE + c] * own >= 0) continue
    if (inside(r + dr, c + dc) && board[(r + dr) * SIZE + c + dc] === 0) return true
  }
  return false
}

/** All capture sequences of the piece on `from`, each run until no further capture is possible. */
function capturesFrom(board: Int8Array, from: number, side: Side, out: DamaMove[]) {
  const piece = board[from]
  const own = signOf(side)
  const back = -forwardOf(side)
  const lastRow = promotionRow(side)
  const path: number[] = []
  const captured: number[] = []
  board[from] = 0 // the moving piece's own square is empty while it captures

  const visit = (at: number, king: boolean, lastDir: number, promoted: boolean) => {
    let extended = false
    for (let d = 0; d < 4; d++) {
      const [dr, dc] = DIRECTIONS[d]
      // A dama may not turn back between captures; men never capture backwards.
      if (lastDir >= 0 && dr === -DIRECTIONS[lastDir][0] && dc === -DIRECTIONS[lastDir][1]) continue
      if (!king && dr === back) continue
      let r = rowOf(at) + dr
      let c = colOf(at) + dc
      if (king) while (inside(r, c) && board[r * SIZE + c] === 0) {
        r += dr
        c += dc
      }
      if (!inside(r, c)) continue
      const victim = r * SIZE + c
      if (board[victim] * own >= 0) continue
      let lr = r + dr
      let lc = c + dc
      const taken = board[victim]
      board[victim] = 0
      while (inside(lr, lc) && board[lr * SIZE + lc] === 0) {
        const land = lr * SIZE + lc
        extended = true
        const promotes = !king && lr === lastRow
        path.push(land)
        captured.push(victim)
        visit(land, king || promotes, d, promoted || promotes)
        path.pop()
        captured.pop()
        if (!king) break
        lr += dr
        lc += dc
      }
      board[victim] = taken
    }
    if (!extended && captured.length > 0) out.push({ from, path: path.slice(), captured: captured.slice(), promotes: promoted })
  }

  visit(from, Math.abs(piece) === KING, -1, false)
  board[from] = piece
}

/** Legal moves: the longest captures if any capture exists, otherwise all plain moves. */
export function legalMoves(position: DamaPosition): DamaMove[] {
  const { board, turn } = position
  const own = signOf(turn)
  const captures: DamaMove[] = []
  for (let i = 0; i < board.length; i++) {
    if (board[i] * own > 0 && canCapture(board, i, turn)) capturesFrom(board, i, turn, captures)
  }
  if (captures.length > 0) {
    let most = 0
    for (const m of captures) if (m.captured.length > most) most = m.captured.length
    return captures.filter((m) => m.captured.length === most)
  }
  const moves: DamaMove[] = []
  const forward = forwardOf(turn)
  for (let i = 0; i < board.length; i++) {
    const piece = board[i] * own
    if (piece <= 0) continue
    for (const [dr, dc] of DIRECTIONS) {
      if (piece === MAN && dr === -forward) continue
      let r = rowOf(i) + dr
      let c = colOf(i) + dc
      while (inside(r, c) && board[r * SIZE + c] === 0) {
        const to = r * SIZE + c
        moves.push({ from: i, path: [to], captured: [], promotes: piece === MAN && r === promotionRow(turn) })
        if (piece === MAN) break
        r += dr
        c += dc
      }
    }
  }
  return moves
}

/** "c3-c4" for a plain move, "c3xc5xe5" for a capture. */
export function moveCode(move: DamaMove): string {
  return [move.from, ...move.path].map(squareName).join(move.captured.length > 0 ? 'x' : '-')
}

export function findMove(position: DamaPosition, code: string): DamaMove | null {
  const wanted = code.trim().toLowerCase()
  return legalMoves(position).find((m) => moveCode(m) === wanted) ?? null
}

/** Plays a legal move (not checked). */
export function playMove(position: DamaPosition, move: DamaMove): DamaPosition {
  const board = position.board.slice()
  const piece = board[move.from]
  board[move.from] = 0
  for (const s of move.captured) board[s] = 0
  board[move.path[move.path.length - 1]] = move.promotes ? KING * signOf(position.turn) : piece
  const kingMove = Math.abs(piece) === KING && move.captured.length === 0
  return { board, turn: opponentOf(position.turn), quiet: kingMove ? position.quiet + 1 : 0 }
}

export interface DamaMoveResult {
  move: DamaMove
  position: DamaPosition
  mover: Side
}

/** Plays a move given by its code; null if it is not legal. */
export function applyMove(position: DamaPosition, code: string): DamaMoveResult | null {
  const move = findMove(position, code)
  if (!move) return null
  return { move, position: playMove(position, move), mover: position.turn }
}

export function pieceCount(board: Int8Array, side: Side): { men: number; kings: number } {
  const own = signOf(side)
  let men = 0
  let kings = 0
  for (const p of board) {
    if (p * own === MAN) men++
    else if (p * own === KING) kings++
  }
  return { men, kings }
}

export type EndReason = 'no_moves' | 'no_pieces' | 'one_each' | 'quiet' | 'repetition'

/** The game is over in this position: the winner (or a draw) and why. Repetitions are checked by the caller. */
export function statusOf(position: DamaPosition): { winner: Side | 'draw'; reason: EndReason } | null {
  const white = pieceCount(position.board, 'w')
  const black = pieceCount(position.board, 'b')
  const whiteTotal = white.men + white.kings
  const blackTotal = black.men + black.kings
  if (whiteTotal === 0 || blackTotal === 0) return { winner: whiteTotal === 0 ? 'b' : 'w', reason: 'no_pieces' }
  if (whiteTotal === 1 && blackTotal === 1) return { winner: 'draw', reason: 'one_each' }
  if (legalMoves(position).length === 0) return { winner: opponentOf(position.turn), reason: 'no_moves' }
  if (position.quiet >= DRAW_QUIET_MOVES) return { winner: 'draw', reason: 'quiet' }
  return null
}
