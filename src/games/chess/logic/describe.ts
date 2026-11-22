import { Chess, type Color, type PieceSymbol } from 'chess.js'
import type { GamePhase, MoveFacts } from '../../../core/types'
import { factsSentence } from '../../../core/analysis/moveText'
import { findHangingPieces, staticExchange } from './hanging'
import { forkTargets, playUci } from './motifs'
import { PIECE_VALUE, PIECE_WORDS, joinTurkish } from './pieces'

const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w')
const CENTRE = new Set(['d4', 'e4', 'd5', 'e5'])

/**
 * What a chess move does, in words true for either player: captures, checks, castling,
 * promotion, double attacks, saving a piece under attack, development and the centre.
 */
export function describeChessMove(fen: string, uci: string): MoveFacts | null {
  let before: Chess
  try {
    before = new Chess(fen)
  } catch {
    return null
  }
  const forced = before.moves().length === 1
  const played = playUci(fen, uci)
  if (!played) return null
  const { move } = played
  const after = new Chess(played.fen)
  const mover = move.color
  const enemy = opposite(mover)

  if (after.isCheckmate()) return { text: 'Mat! Oyunu bitiriyor.', forced }

  const facts: string[] = []
  const captured = move.captured as PieceSymbol | undefined
  if (captured) facts.push(move.flags.includes('e') ? 'Geçerken alarak piyonu alıyor' : `${PIECE_WORDS[captured].acc} alıyor`)
  if (move.promotion) facts.push(`Piyon ${PIECE_WORDS[move.promotion as PieceSymbol].base} oluyor`)
  if (move.flags.includes('k') || move.flags.includes('q')) facts.push('Rok yapıyor, şah güvenliğe giriyor')

  const check = after.inCheck()
  const targets = forkTargets(played.fen, move.to).filter((t) => t.type !== 'k')
  if (check && targets.length > 0) {
    facts.push(`Şah çekiyor ve ${PIECE_WORDS[targets[0].type].dat} de saldırıyor (çatal)`)
  } else if (check) {
    facts.push('Şah çekiyor')
  } else if (targets.length >= 2) {
    facts.push(`Aynı anda ${joinTurkish(targets.slice(0, 2).map((t) => PIECE_WORDS[t.type].dat))} saldırıyor (çatal)`)
  } else if (targets.length === 1 && !captured) {
    facts.push(`${PIECE_WORDS[targets[0].type].dat} saldırıyor`)
  }

  // A piece that could have been won before the move and no longer can.
  const hangingBefore = findHangingPieces(fen, mover, 1)
  if (hangingBefore.length > 0) {
    const stillHanging = new Set(findHangingPieces(played.fen, mover, 1).map((p) => p.square))
    const movedAway = hangingBefore.find((p) => p.square === move.from && !stillHanging.has(move.to))
    const covered = hangingBefore.find((p) => p.square !== move.from && !stillHanging.has(p.square))
    if (movedAway) facts.push(`Tehlikedeki ${PIECE_WORDS[movedAway.type].acc} kurtarıyor`)
    else if (covered) facts.push(`Tehlikedeki ${PIECE_WORDS[covered.type].acc} koruyor`)
  }

  const moveNumber = Number(fen.split(' ')[5] ?? 1)
  if (facts.length === 0 && moveNumber <= 12) {
    const homeRank = mover === 'w' ? '1' : '8'
    if ((move.piece === 'n' || move.piece === 'b') && move.from[1] === homeRank) {
      facts.push(`${PIECE_WORDS[move.piece].acc} oyuna sokuyor`)
    } else if (move.piece === 'p' && CENTRE.has(move.to)) {
      facts.push('Merkezi tutuyor')
    }
  }

  // Material put where the other side can win it: worth noting as a sacrifice when it is a good move.
  const offered = staticExchange(played.fen, move.to, enemy) - (captured ? PIECE_VALUE[captured] : 0)
  const sacrifice = offered >= 2 && !move.promotion
  // Natural moves: taking a piece worth at least as much as the taker (often taking back), the king
  // taking a piece, or getting out of check.
  const obvious =
    before.inCheck() || (!!captured && (move.piece === 'k' || PIECE_VALUE[captured] >= PIECE_VALUE[move.piece]))

  return { text: factsSentence(facts), forced, sacrifice, obvious }
}

/** Opening while most pieces are still on and it is early; endgame once six pieces or fewer (pawns and kings aside) are left. */
export function chessPhase(fen: string): GamePhase {
  const [board, , , , , fullmove] = fen.split(' ')
  const pieces = (board.match(/[nbrqNBRQ]/g) ?? []).length
  if (pieces <= 6) return 'endgame'
  if (Number(fullmove ?? 1) <= 10 && pieces >= 12) return 'opening'
  return 'middlegame'
}
