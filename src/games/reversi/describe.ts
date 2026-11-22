import { factsSentence } from '../../core/analysis/moveText'
import type { GamePhase, MoveFacts } from '../../core/types'
import { CORNERS, applyMove, decode, discCount, legalMoves, type ReversiPosition } from './rules'

/** What a Reversi move does, in words true for either player: corners, discs turned, moves left to the other side. */
export function describeReversiMove(position: string, code: string): MoveFacts | null {
  let start: ReversiPosition
  try {
    start = decode(position)
  } catch {
    return null
  }
  const forced = legalMoves(start).length === 1
  const result = applyMove(start, code)
  if (!result) return null

  const facts: string[] = []
  if (CORNERS.includes(result.move.square)) facts.push('Köşeyi alıyor, bu taş bir daha çevrilemez')
  if (result.over) {
    facts.push('Oyunu bitiriyor')
  } else if (result.opponentPassed) {
    facts.push('Karşı tarafın oynayacak yeri kalmıyor, pas geçmek zorunda')
  } else {
    const replies = legalMoves(result.position).length
    if (replies <= 2) facts.push(`Karşı tarafa yalnızca ${replies} oynanacak yer bırakıyor`)
  }
  facts.push(`${result.move.flips.length} taş çeviriyor`)
  return { text: factsSentence(facts), forced }
}

/** Opening up to 20 discs; endgame once 16 squares or fewer are empty. */
export function reversiPhase(position: string): GamePhase {
  try {
    const { empty } = discCount(decode(position).board)
    if (empty <= 16) return 'endgame'
    if (64 - empty <= 20) return 'opening'
  } catch {
    // fall through
  }
  return 'middlegame'
}
