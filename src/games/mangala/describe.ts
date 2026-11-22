import { factsSentence } from '../../core/analysis/moveText'
import type { GamePhase, MoveFacts } from '../../core/types'
import { STORE, applyMove, decode, legalMoves, type Position } from './rules'

/** What a Mangala move does, in words true for either player: captures, extra turns, the end of the game. */
export function describeMangalaMove(position: string, move: string): MoveFacts | null {
  let start: Position
  try {
    start = decode(position)
  } catch {
    return null
  }
  const forced = legalMoves(start).length === 1
  const result = applyMove(start, Number(move))
  if (!result) return null

  const facts: string[] = []
  const capture = result.capture
  if (capture?.kind === 'even') facts.push(`Çift kuralıyla karşıdaki ${capture.stones} taşı alıyor`)
  if (capture?.kind === 'empty' && capture.stones > 1) facts.push(`Boş kuyu kuralıyla karşıdaki ${capture.stones - 1} taşı alıyor`)
  if (result.over) {
    const sweep = result.sweep
    facts.push(sweep && sweep.to === result.mover && sweep.stones > 0 ? `Oyunu bitiriyor, kalan ${sweep.stones} taş da hazinesine gidiyor` : 'Oyunu bitiriyor')
  } else if (result.extraTurn) {
    facts.push('Son taş hazineye düşüyor, bir daha oynuyor')
  }
  if (facts.length === 0) {
    const stored = result.path.filter((index) => index === STORE[result.mover]).length
    if (stored > 0) facts.push(`Hazinesine ${stored} taş koyuyor`)
  }
  return { text: factsSentence(facts), forced }
}

/** Opening for the first moves while the pits are full; endgame once 16 stones or fewer are left in the pits. */
export function mangalaPhase(position: string, ply: number): GamePhase {
  let stones = 48
  try {
    const { pits } = decode(position)
    stones = pits.reduce((sum, count, index) => (index === STORE.w || index === STORE.b ? sum : sum + count), 0)
  } catch {
    // keep the default
  }
  if (stones <= 16) return 'endgame'
  if (ply < 10 && stones >= 36) return 'opening'
  return 'middlegame'
}
