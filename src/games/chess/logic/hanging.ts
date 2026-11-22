import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { PIECE_VALUE } from './pieces'

export interface HangingPiece {
  square: Square
  type: PieceSymbol
  /** Material the opponent wins by starting captures on this square (in pawns). */
  loss: number
  /** True if at least one own piece defends the square. */
  defended: boolean
}

const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w')

/** Same position with a different side to move (en passant cleared, it would no longer be valid). */
export function withTurn(fen: string, color: Color): string {
  const parts = fen.split(' ')
  if (parts[1] === color) return fen
  parts[1] = color
  parts[3] = '-'
  return parts.join(' ')
}

function load(fen: string): Chess | null {
  try {
    return new Chess(fen)
  } catch {
    return null
  }
}

/**
 * Static exchange evaluation: how much material `by` wins if it starts capturing
 * on `square` and both sides keep recapturing with their cheapest piece (either
 * side may stop when continuing would cost material). Uses real legal moves, so
 * pins and x-ray attackers are handled. Returns <= 0 when capturing does not pay.
 */
export function staticExchange(fen: string, square: Square, by: Color): number {
  const chess = load(withTurn(fen, by))
  if (!chess) return 0
  const target = chess.get(square)
  if (!target || target.color === by || target.type === 'k') return 0

  const gain: number[] = []
  let victim = PIECE_VALUE[target.type]
  for (let depth = 0; depth < 32; depth++) {
    const captures = chess
      .moves({ verbose: true })
      .filter((move) => move.to === square && (!move.promotion || move.promotion === 'q'))
    if (captures.length === 0) break
    captures.sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece])
    const capture = captures[0]
    // A king may only capture when nothing can recapture; legal move generation guarantees that.
    gain[depth] = victim - (depth > 0 ? gain[depth - 1] : 0)
    victim = capture.promotion ? PIECE_VALUE.q : PIECE_VALUE[capture.piece]
    chess.move({ from: capture.from, to: capture.to, promotion: capture.promotion })
  }
  if (gain.length === 0) return 0
  for (let i = gain.length - 1; i > 0; i--) {
    gain[i - 1] = -Math.max(-gain[i - 1], gain[i])
  }
  return gain[0]
}

/** Pieces of `color` (kings excluded) that the opponent can win material from right now. */
export function findHangingPieces(fen: string, color: Color, minLoss = 1): HangingPiece[] {
  const chess = load(fen)
  if (!chess) return []
  const enemy = opposite(color)
  const result: HangingPiece[] = []
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color || cell.type === 'k') continue
      if (!chess.isAttacked(cell.square, enemy)) continue
      const loss = staticExchange(fen, cell.square, enemy)
      if (loss >= minLoss) {
        result.push({
          square: cell.square,
          type: cell.type,
          loss,
          defended: chess.attackers(cell.square, color).length > 0,
        })
      }
    }
  }
  return result.sort((a, b) => b.loss - a.loss)
}

export interface LeftHanging {
  piece: HangingPiece
  /** Net material lost after counting anything the move itself captured. */
  netLoss: number
  /** The hanging piece is the one that just moved. */
  isMovedPiece: boolean
  /** The piece was already en prise before the move (the move ignored the threat). */
  wasHangingBefore: boolean
  /** The moved piece used to defend the hanging piece. */
  removedDefender: boolean
}

/**
 * Checks whether playing `move` leaves one of the mover's pieces to be taken for
 * free (or for less than it is worth). Returns the worst case, or null if the
 * net loss stays below `minNetLoss` pawns.
 */
export function detectLeftHanging(
  fenBefore: string,
  move: { from: string; to: string; promotion?: string },
  minNetLoss = 2,
): LeftHanging | null {
  const chess = load(fenBefore)
  if (!chess) return null
  let played
  try {
    played = chess.move(move)
  } catch {
    return null
  }
  if (chess.isCheckmate()) return null

  const mover = played.color
  const gained = played.captured ? PIECE_VALUE[played.captured] : 0
  const fenAfter = chess.fen()
  const before = load(fenBefore)!

  let worst: LeftHanging | null = null
  for (const piece of findHangingPieces(fenAfter, mover, minNetLoss + gained)) {
    const netLoss = piece.loss - gained
    if (netLoss < minNetLoss || (worst && netLoss <= worst.netLoss)) continue
    const isMovedPiece = piece.square === played.to
    worst = {
      piece,
      netLoss,
      isMovedPiece,
      wasHangingBefore: !isMovedPiece && staticExchange(fenBefore, piece.square, opposite(mover)) >= piece.loss,
      removedDefender: !isMovedPiece && before.attackers(piece.square as Square, mover).includes(played.from),
    }
  }
  return worst
}

/** The smallest net loss any legal move allows (0 if some move keeps everything safe). */
export function leastLossAvailable(fenBefore: string, minNetLoss = 2): number {
  const chess = load(fenBefore)
  if (!chess) return 0
  let least = Infinity
  for (const move of chess.moves({ verbose: true })) {
    const loss = detectLeftHanging(fenBefore, { from: move.from, to: move.to, promotion: move.promotion }, minNetLoss)?.netLoss ?? 0
    least = Math.min(least, loss)
    if (least === 0) break
  }
  return least === Infinity ? 0 : least
}

/**
 * Coach-mode check: the move leaves a piece to be taken for free (or cheaply)
 * *and* a safer move exists. A piece that cannot be saved anyway is not nagged about.
 */
export function shouldWarn(
  fenBefore: string,
  move: { from: string; to: string; promotion?: string },
  minNetLoss = 2,
): LeftHanging | null {
  const result = detectLeftHanging(fenBefore, move, minNetLoss)
  if (!result) return null
  return leastLossAvailable(fenBefore, minNetLoss) < result.netLoss ? result : null
}
