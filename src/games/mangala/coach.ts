import type { CoachWarning, Side } from '../../core/types'
import { STORE, applyMove, legalMoves, pitNumber, winner, type MoveResult, type Position } from './rules'

/**
 * Mangala coach: warns before a move that lets the opponent take many stones on
 * their next turn (when a safer move exists) and turns the reminder questions into
 * concrete nudges for the current position, without naming the answer.
 */

/** Net stone loss that triggers a warning, and how much worse than the safest move it must be. */
const WARN_AT = 3
const MARGIN = 2
const LOSING = 99

export interface Threat {
  stones: number
  kind: 'even' | 'empty' | 'sweep'
  /** The attacker's first pit of the turn. */
  firstMove: number
  /** The pit the stones are taken from (null for a sweep). */
  pit: number | null
  viaExtraTurn: boolean
}

const other = (side: Side): Side => (side === 'w' ? 'b' : 'w')

function netCapture(result: MoveResult): number {
  const capture = result.capture
  if (!capture) return 0
  return capture.kind === 'empty' ? capture.stones - 1 : capture.stones
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('tr-TR') + text.slice(1)
}

/** The most stones the side to move can take during its turn (extra turns included, a few moves deep). */
export function opponentThreat(position: Position, depth = 3, first: number | null = null, via = false): Threat | null {
  const attacker = position.turn
  let worst: Threat | null = null
  const consider = (threat: Threat) => {
    if (threat.stones <= 0) return
    // On equal stones, name the simpler threat (one move rather than a chain of extra turns).
    const simpler = worst !== null && threat.stones === worst.stones && worst.viaExtraTurn && !threat.viaExtraTurn
    if (!worst || threat.stones > worst.stones || simpler) worst = threat
  }
  for (const move of legalMoves(position)) {
    const result = applyMove(position, move)
    if (!result) continue
    const start = first ?? move
    const sweep = result.sweep?.to === attacker ? result.sweep.stones : 0
    if (sweep > 0) {
      consider({ stones: sweep + netCapture(result), kind: 'sweep', firstMove: start, pit: null, viaExtraTurn: via })
    } else if (result.capture) {
      consider({ stones: netCapture(result), kind: result.capture.kind, firstMove: start, pit: result.capture.pit, viaExtraTurn: via })
    }
    if (depth > 1 && result.extraTurn) {
      const deeper = opponentThreat(result.position, depth - 1, start, true)
      if (deeper) consider(deeper)
    }
  }
  return worst
}

/**
 * Net stones the mover loses on the opponent's next turn after `move`
 * (stones the opponent takes minus stones the move took). Extra turns look one move further.
 */
function netLoss(position: Position, move: number, depth: number): number {
  const result = applyMove(position, move)
  if (!result) return LOSING
  const gained = netCapture(result) + (result.sweep?.to === position.turn ? result.sweep.stones : 0)
  if (result.over) return winner(result.position.pits) === other(position.turn) ? LOSING : -gained
  if (result.extraTurn) {
    if (depth <= 1) return -gained
    return Math.min(...legalMoves(result.position).map((next) => netLoss(result.position, next, depth - 1))) - gained
  }
  return (opponentThreat(result.position)?.stones ?? 0) - gained
}

/** The smallest net loss among all moves (the safest move). */
export function safestLoss(position: Position): number {
  const moves = legalMoves(position)
  if (moves.length === 0) return 0
  return Math.min(...moves.map((move) => netLoss(position, move, 2)))
}

function threatText(threat: Threat): string {
  const from = pitNumber(threat.firstMove)
  if (threat.kind === 'sweep') {
    return `Bu hamleden sonra rakip kuyularını boşaltıp oyunu bitirebilir ve senin kuyularındaki ${threat.stones} taşı alır.`
  }
  const target = pitNumber(threat.pit!)
  const opening = threat.viaExtraTurn
    ? `Bu hamleden sonra rakip ${from}. kuyusundan oynayıp tekrar oynama hakkı kazanıyor, ardından`
    : `Bu hamleden sonra rakip ${from}. kuyusundan oynayıp`
  return threat.kind === 'even'
    ? `${opening} senin ${target}. kuyundaki ${threat.stones} taşı çift kuralıyla alabilir.`
    : `${opening} boş kuyu kuralıyla senin ${target}. kuyundaki ${threat.stones} taşı alabilir.`
}

/** Warning for a move that gives stones away when a safer move exists, or null. */
export function mangalaCoachWarning(position: Position, move: number): CoachWarning | null {
  const result = applyMove(position, move)
  if (!result || result.extraTurn) return null
  const me = position.turn
  const loss = netLoss(position, move, 2)
  const safest = safestLoss(position)

  if (result.over) {
    if (loss < LOSING || safest >= LOSING) return null
    const mine = result.position.pits[STORE[me]]
    const theirs = result.position.pits[STORE[other(me)]]
    return { text: `Bu hamle oyunu bitirir ve kaybedersin: hazinende ${mine}, rakibinde ${theirs} taş olur.`, marks: [] }
  }

  if (loss < WARN_AT || loss - safest < MARGIN) return null
  const threat = opponentThreat(result.position)
  if (!threat) return null
  const gained = netCapture(result)
  const text = gained > 0 ? `${gained} taş alıyorsun ama ${lowerFirst(threatText(threat))}` : threatText(threat)
  const marks: CoachWarning['marks'] = [{ kind: 'threat', move: String(threat.firstMove) }]
  if (threat.pit !== null) marks.push({ kind: 'danger', square: String(threat.pit) })
  return { text, marks }
}

/** Reminder questions for the current position (the user is to move). Nudges, not answers. */
export function mangalaCoachQuestions(position: Position): string[] {
  const me = position.turn
  const threatNow = opponentThreat({ pits: position.pits, turn: other(me) })
  const first =
    threatNow && threatNow.stones >= 2
      ? 'Dikkat: rakip bir sonraki hamlesinde kuyularından birinden taş alabilir. Hangisi, nasıl korursun?'
      : 'Rakibin bir sonraki hamlesinde hangi kuyun tehlikeye girer? (çift kuralı ya da boş kuyu kuralı)'

  let canCapture = false
  let canMoveAgain = false
  for (const move of legalMoves(position)) {
    const result = applyMove(position, move)
    if (!result) continue
    if (netCapture(result) >= 2) canCapture = true
    if (result.extraTurn) canMoveAgain = true
  }
  const second = canCapture
    ? 'Rakipten taş alabileceğin bir hamle var. Bulabilir misin?'
    : canMoveAgain
      ? 'Son taşı hazinene düşen bir kuyun var; tekrar oynayabilirsin. Ama önce güvenli mi, düşün.'
      : 'Bu sırada taş alma ya da tekrar oynama fırsatın yok: taşlarını güvende tutan bir hamle seç.'
  return [first, second]
}

/** One short note before the user's move: the most urgent thing to look at, without naming a move. */
export function mangalaCoachTip(position: Position): string {
  const threat = opponentThreat({ pits: position.pits, turn: other(position.turn) })
  if (threat && threat.stones >= 2) return 'Dikkat: rakip bir kuyundan taş alabilir. Taşlarını koru!'
  let canCapture = false
  let canMoveAgain = false
  for (const move of legalMoves(position)) {
    const result = applyMove(position, move)
    if (!result) continue
    if (netCapture(result) >= 2) canCapture = true
    if (result.extraTurn) canMoveAgain = true
  }
  if (canCapture) return 'Rakipten taş alabileceğin bir hamle var. Bulabilir misin?'
  if (canMoveAgain) return 'Son taşı hazinene düşen bir kuyun var: tekrar oynayabilirsin.'
  return 'Taşlarını güvende tutan bir hamle seç.'
}
