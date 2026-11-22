import type { ExplainInput, Explanation, Score, Side } from '../../core/types'
import {
  CORNERS,
  applyMove,
  cornerNear,
  countsBySide,
  decode,
  discCount,
  movesFor,
  opponentOf,
  squareName,
  type ReversiMoveResult,
  type ReversiPosition,
} from './rules'

/**
 * Plain-Turkish explanations for Reversi mistakes: corners given away or missed, the squares next
 * to an empty corner, leaving the opponent many moves, flipping too many discs early and results
 * the engine has counted to the end. Falls back to "Daha iyisi şuydu: …".
 */

export type ReversiErrorType = 'gave_corner' | 'missed_corner' | 'mobility' | 'greedy' | 'endgame' | 'other'

/** "d3 (+2)": the square and how many discs it turned over. */
export function labelFor(result: Pick<ReversiMoveResult, 'move'>): string {
  return `${squareName(result.move.square)} (+${result.move.flips.length})`
}

/** Corners the opponent of `mover` could take in this position (none if `mover` moves again). */
export function cornersFor(position: ReversiPosition, side: Side): number[] {
  if (position.turn !== side) return []
  return movesFor(position.board, side)
    .map((m) => m.square)
    .filter((s) => CORNERS.includes(s))
}

function isForcedLoss(score: Score, toMove: Side, user: Side): boolean {
  if (score.kind !== 'mate') return false
  return toMove === user ? score.value < 0 : score.value > 0
}

export function explainReversiMove(input: ExplainInput): Explanation & { type: ReversiErrorType } {
  let before: ReversiPosition
  try {
    before = decode(input.before)
  } catch {
    return { text: 'Daha iyi bir hamle vardı.', type: 'other' }
  }
  const user = input.userSide
  const opponent = opponentOf(user)
  const played = applyMove(before, input.move)
  const bestCode = input.best?.pv[0]
  const best = bestCode ? applyMove(before, bestCode) : null
  const better = best ? ` Daha iyisi ${labelFor(best)} idi.` : ''
  if (!played) return { text: `Daha iyi bir hamle vardı.${better}`, type: 'other' }
  const square = squareName(played.move.square)

  // 1. The move ended the game, or the result is already counted to the end.
  if (played.over) {
    const counts = countsBySide(played.position.board)
    if (counts[user] < counts[opponent]) {
      return { text: `Bu hamleyle oyun bitti ve ${counts[user]}-${counts[opponent]} kaybettin.${better}`, type: 'endgame' }
    }
  }
  const alreadyLost = input.best ? isForcedLoss(input.best.score, user, user) : false
  if (input.reply && !alreadyLost && isForcedLoss(input.reply.score, played.position.turn, user)) {
    return { text: `Bilgisayar oyunun sonuna kadar hesapladı: bu hamleden sonra rakip en iyi oynarsa kesin kazanıyor.${better}`, type: 'endgame' }
  }
  if (input.best?.score.kind === 'mate' && input.best.score.value > 0 && best) {
    const stillWinning = input.reply ? isForcedLoss(input.reply.score, played.position.turn, opponent) : false
    if (!stillWinning && !(played.over && countsBySide(played.position.board)[user] > countsBySide(played.position.board)[opponent])) {
      return { text: `Burada ${squareName(best.move.square)} ile oyunu kesin kazanabilirdin (bilgisayar oyunun sonuna kadar hesapladı).`, type: 'endgame' }
    }
  }

  // 2. A corner given to the opponent.
  const afterBest = best ? cornersFor(best.position, opponent) : []
  const given = cornersFor(played.position, opponent).filter((c) => !afterBest.includes(c))
  if (given.length > 0) {
    const corner = squareName(given[0])
    const near = cornerNear(played.move.square)
    const text =
      near && given.includes(near.corner)
        ? `${square} köşenin ${near.kind === 'x' ? 'çaprazındaki' : 'yanındaki'} bir kare: buraya oynayınca rakip ${corner} köşesini alabiliyor. Köşedeki taş bir daha çevrilemez.`
        : `Bu hamleden sonra rakip ${corner} köşesini alabiliyor. Köşedeki taş bir daha çevrilemez.`
    return { text: text + better, type: 'gave_corner' }
  }

  // 3. A corner the user could have taken.
  if (best && CORNERS.includes(best.move.square) && !CORNERS.includes(played.move.square)) {
    return {
      text: `Burada ${squareName(best.move.square)} köşesini alabilirdin. Köşedeki taşlar bir daha çevrilemez ve çevrelerini de güçlendirir.`,
      type: 'missed_corner',
    }
  }

  // 4. The diagonal square next to an empty corner.
  const near = cornerNear(played.move.square)
  if (near?.kind === 'x' && before.board[near.corner] === 0 && best && cornerNear(best.move.square)?.kind !== 'x') {
    return {
      text: `${square} köşenin çaprazındaki kare: buraya oynamak çoğu zaman rakibe ${squareName(near.corner)} köşesini açar.${better}`,
      type: 'gave_corner',
    }
  }

  // 5. Leaving the opponent many moves.
  const theirMoves = played.position.turn === opponent ? movesFor(played.position.board, opponent).length : 0
  const theirMovesAfterBest = best && best.position.turn === opponent ? movesFor(best.position.board, opponent).length : 0
  if (best && theirMoves >= 6 && theirMoves - theirMovesAfterBest >= 3) {
    return {
      text: `Bu hamleden sonra rakibinin ${theirMoves} oynayacak yeri var (${squareName(best.move.square)} ile ${theirMovesAfterBest} olurdu). Rakibin seçeneklerini azaltan hamleler genelde daha iyidir.`,
      type: 'mobility',
    }
  }

  // 6. Flipping many discs early.
  if (best && discCount(before.board).empty > 30 && played.move.flips.length >= best.move.flips.length + 3) {
    return {
      text: `Çok taş çevirmek oyunun başında genelde iyi değildir: rakibe oynayacak yeni yerler açar. Daha az taş çeviren ${squareName(best.move.square)} daha iyiydi.`,
      type: 'greedy',
    }
  }

  // 7. Nothing specific found.
  let text: string
  if (input.winBefore >= 60 && input.winAfter < 55) text = 'Bu hamleyle elindeki üstünlüğü kaybettin.'
  else if (input.winBefore >= 40 && input.winAfter < 35) text = 'Bu hamleden sonra durumun zorlaştı.'
  else text = 'Bu hamleden sonra rakibin durumu güçlendi.'
  return { text: text + better, type: 'other' }
}
