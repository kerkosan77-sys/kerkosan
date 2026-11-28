import { Chess, type Color, type Square } from 'chess.js'
import { findHangingPieces, type LeftHanging } from './hanging'
import { PIECE_WORDS } from './pieces'

/** Plain-Turkish warning for a move that would leave a piece hanging. */
export function hangingWarningText(result: LeftHanging): string {
  const { square, type, defended } = result.piece
  const words = PIECE_WORDS[type]
  if (result.isMovedPiece) {
    return defended
      ? `${square} karesinde ${words.yours} yeterince korunmuyor. Rakip onu alıp kazançlı çıkar.`
      : `Bu hamleyle ${words.yours} ${square} karesinde korumasız kalıyor. Rakip onu bedavaya alabilir.`
  }
  if (result.removedDefender) {
    return `Bu hamle ${square} karesindeki ${words.yoursGen} korumasını kaldırıyor. Rakip onu alabilir.`
  }
  if (result.wasHangingBefore) {
    return `${square} karesindeki ${words.yours} saldırı altında ve bu hamle onu kurtarmıyor.`
  }
  return `Bu hamleden sonra ${square} karesindeki ${words.yours} tehlikede: rakip onu kazançlı şekilde alabilir.`
}

/** Squares of the opponent's pieces that attack the endangered piece (for arrows). */
export function attackersOf(fenAfter: string, square: string, attacker: Color): string[] {
  try {
    return new Chess(fenAfter).attackers(square as Square, attacker)
  } catch {
    return []
  }
}

/** The two questions shown before each move in coach mode. */
export function coachQuestions(opponentLastSan: string | null): string[] {
  const questions: string[] = []
  if (opponentLastSan) questions.push(`Rakibin son hamlesi (${opponentLastSan}) neyi tehdit ediyor?`)
  questions.push('Oynayacağın hamle bir taşını korumasız bırakıyor mu?')
  return questions
}

/**
 * One short note before the user's move (the user is to move in `fen`): the most urgent thing
 * to look at, without naming a move.
 */
export function chessCoachTip(fen: string): string {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return 'Hamle yapmadan önce rakibin son hamlesine bak.'
  }
  const me = chess.turn()
  const enemy: Color = me === 'w' ? 'b' : 'w'
  if (chess.inCheck()) return 'Şah! Önce şahını kurtarmalısın.'
  // Plain move names: the detailed list is much slower in chess.js and only "#" is needed here.
  if (chess.moves().some((san) => san.endsWith('#'))) return 'Bu pozisyonda mat var! Bulabilir misin?'
  if (findHangingPieces(fen, me, 1).length > 0) return 'Bir taşın tehlikede. Önce onu kurtar ya da koru.'
  if (findHangingPieces(fen, enemy, 1).length > 0) return 'Rakibin korumasız bir taşı var. Bulabilir misin?'
  if (Number(fen.split(' ')[5] ?? 1) <= 8) return 'Taşlarını oyuna sok, merkezi tut ve rok yap.'
  return 'Rakibin son hamlesi neyi tehdit ediyor? Hamle yapmadan önce kontrol et.'
}
