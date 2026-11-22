import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js'
import { PIECE_VALUE } from './pieces'
import { staticExchange } from './hanging'

export interface UciMove {
  from: string
  to: string
  promotion?: string
}

export function parseUci(uci: string): UciMove {
  const move: UciMove = { from: uci.slice(0, 2), to: uci.slice(2, 4) }
  if (uci.length > 4) move.promotion = uci[4]
  return move
}

/** Plays a UCI move on a copy of the position. Returns null if it is illegal. */
export function playUci(fen: string, uci: string): { move: Move; fen: string } | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(parseUci(uci))
    return { move, fen: chess.fen() }
  } catch {
    return null
  }
}

/** UCI -> SAN for the given position ("g1f3" -> "Nf3"). Falls back to the UCI string. */
export function uciToSan(fen: string, uci: string): string {
  return playUci(fen, uci)?.move.san ?? uci
}

export interface ForkTarget {
  square: Square
  type: PieceSymbol
}

/**
 * Enemy pieces that the piece on `square` attacks *and* that are real targets:
 * the king, anything worth more than the attacker, or anything it can win outright.
 * Two or more targets = a fork / double attack.
 */
export function forkTargets(fen: string, square: Square): ForkTarget[] {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return []
  }
  const attacker = chess.get(square)
  if (!attacker) return []
  const enemy: Color = attacker.color === 'w' ? 'b' : 'w'
  const attackerValue = PIECE_VALUE[attacker.type]
  const targets: ForkTarget[] = []

  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== enemy) continue
      if (!chess.attackers(cell.square, attacker.color).includes(square)) continue
      const isTarget =
        cell.type === 'k' ||
        PIECE_VALUE[cell.type] > attackerValue ||
        staticExchange(fen, cell.square, attacker.color) > 0
      if (isTarget) targets.push({ square: cell.square, type: cell.type })
    }
  }
  return targets.sort((a, b) => PIECE_VALUE[b.type] - PIECE_VALUE[a.type])
}

/**
 * Net material change for `color` along a line of UCI moves (captures and promotions),
 * stopping at a quiet point so a line cut off mid-exchange does not mislead.
 */
export function lineMaterial(fen: string, line: string[], color: Color, maxPlies = 8): number {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return 0
  }
  const values: number[] = [0]
  const captures: boolean[] = []
  let net = 0
  for (const uci of line.slice(0, maxPlies + 4)) {
    let move: Move
    try {
      move = chess.move(parseUci(uci))
    } catch {
      break
    }
    const sign = move.color === color ? 1 : -1
    if (move.captured) net += sign * PIECE_VALUE[move.captured]
    if (move.promotion) net += sign * (PIECE_VALUE[move.promotion] - PIECE_VALUE.p)
    values.push(net)
    captures.push(Boolean(move.captured))
  }
  // Pick the last ply <= maxPlies after which the next move is not a capture;
  // if the exchange keeps going past maxPlies, follow it to its end.
  let end = Math.min(maxPlies, captures.length)
  while (end < captures.length && captures[end]) end++
  return values[end]
}

/** Index, move and resulting position of the first capture made by `by` in the line, or null. */
export function firstCaptureBy(
  fen: string,
  line: string[],
  by: Color,
  maxPlies = 6,
): { index: number; move: Move; fenAfter: string } | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return null
  }
  for (let i = 0; i < Math.min(line.length, maxPlies); i++) {
    let move: Move
    try {
      move = chess.move(parseUci(line[i]))
    } catch {
      return null
    }
    if (move.color === by && move.captured) return { index: i, move, fenAfter: chess.fen() }
  }
  return null
}
