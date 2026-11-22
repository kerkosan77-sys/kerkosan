import type { Chess } from 'chess.js'
import { lossResult, resignation } from '../../../core/records'
import type { GameEnd, Side as Color } from '../../../core/types'

export type { GameEnd }
export { resignation }

function draw(detail: string): GameEnd {
  return { result: '1/2-1/2', outcome: 'draw', title: 'Berabere', detail }
}

/** Returns how the game ended, or null if it is still going. */
export function detectGameEnd(game: Chess, userColor: Color): GameEnd | null {
  if (game.isCheckmate()) {
    const loser = game.turn()
    return loser === userColor
      ? { result: lossResult(loser), outcome: 'loss', title: 'Mat oldun', detail: 'Bu sefer olmadı. Analizde nerede işlerin ters gittiğine bakalım.' }
      : { result: lossResult(loser), outcome: 'win', title: 'Kazandın!', detail: 'Rakibini mat ettin. Tebrikler!' }
  }
  if (game.isStalemate()) return draw('Pat: sırası gelen tarafın yasal hamlesi yok ama şahı tehdit altında değil.')
  if (game.isInsufficientMaterial()) return draw('Tahtada mat etmeye yetecek taş kalmadı.')
  if (game.isThreefoldRepetition()) return draw('Aynı pozisyon üç kez tekrarlandı.')
  if (game.isDrawByFiftyMoves()) return draw('50 hamle boyunca taş alınmadı ve piyon oynanmadı.')
  return null
}

/** PGN date format: "2026.11.18" */
export function pgnDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}
