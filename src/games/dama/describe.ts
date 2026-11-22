import { factsSentence } from '../../core/analysis/moveText'
import type { GamePhase, MoveFacts } from '../../core/types'
import { isSacrifice } from './hints'
import { KING, applyMove, decode, legalMoves, squareName, type DamaPosition } from './rules'

/** What a Dama move does, in words true for either player: captures, promotion, giving a piece on purpose. */
export function describeDamaMove(position: string, code: string): MoveFacts | null {
  let start: DamaPosition
  try {
    start = decode(position)
  } catch {
    return null
  }
  const forced = legalMoves(start).length === 1
  const result = applyMove(start, code)
  if (!result) return null
  const { move } = result

  const facts: string[] = []
  const taken = move.captured.length
  if (taken > 0) {
    const kings = move.captured.filter((s) => Math.abs(start.board[s]) === KING).length
    if (kings === 0) facts.push(`${taken} taş alıyor`)
    else if (taken === 1) facts.push('Bir damayı alıyor')
    else facts.push(`${taken} taş alıyor, ${kings === 1 ? 'biri' : `${kings} tanesi`} dama`)
  }
  if (move.promotes) facts.push('Dama oluyor')
  const sacrifice = isSacrifice(start, code)
  if (sacrifice) facts.push('Taş verip karşı tarafı zorunlu almaya sokuyor')

  if (facts.length === 0 && Math.abs(start.board[move.from]) === 1) {
    // A man two rows or less from the last row.
    const rank = Number(squareName(move.path[move.path.length - 1]).slice(1))
    if ((start.turn === 'w' && rank >= 6) || (start.turn === 'b' && rank <= 3)) facts.push('Dama olmaya yaklaşıyor')
  }
  return { text: factsSentence(facts), forced, sacrifice }
}

/** Opening while 28 or more of the 32 pieces are on the board; endgame at 12 pieces or fewer. */
export function damaPhase(position: string): GamePhase {
  try {
    const pieces = decode(position).board.reduce((sum, piece) => (piece === 0 ? sum : sum + 1), 0)
    if (pieces <= 12) return 'endgame'
    if (pieces >= 28) return 'opening'
  } catch {
    // fall through
  }
  return 'middlegame'
}
