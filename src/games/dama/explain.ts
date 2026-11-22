import type { ExplainInput, Explanation, Score, Side } from '../../core/types'
import {
  KING,
  applyMove,
  decode,
  opponentOf,
  statusOf,
  type DamaMove,
  type DamaPosition,
} from './rules'

/**
 * Plain-Turkish explanations for Dama mistakes, built from the engine's lines and the rules:
 * pieces the opponent can take next, traps that use the compulsory capture rule, damas allowed
 * or missed, and forced results. Falls back to "Daha iyisi şuydu: …".
 */

export type DamaErrorType =
  | 'allowed_capture'
  | 'allowed_trap'
  | 'missed_combination'
  | 'allowed_promotion'
  | 'missed_promotion'
  | 'endgame'
  | 'other'

export interface Step {
  mover: Side
  code: string
  move: DamaMove
  /** Position before the move. */
  before: DamaPosition
  after: DamaPosition
}

/** "c3-c4", "c3×c5×e5", "d7-d8 (dama)" */
export function labelFor(code: string, move: DamaMove): string {
  const label = code.replace(/x/g, '×')
  return move.promotes ? `${label} (dama)` : label
}

/** Plays a line of move codes, stopping at an illegal move or the end of the game. */
export function simulate(position: DamaPosition, codes: string[], limit: number): Step[] {
  const steps: Step[] = []
  let current = position
  for (const code of codes.slice(0, limit)) {
    if (statusOf(current)) break
    const result = applyMove(current, code)
    if (!result) break
    steps.push({ mover: current.turn, code, move: result.move, before: current, after: result.position })
    current = result.position
  }
  return steps
}

/** Value of the pieces a move takes, in men (a dama counts 3). */
export function captureValue(step: Pick<Step, 'move' | 'before'>): number {
  return step.move.captured.reduce((sum, s) => sum + (Math.abs(step.before.board[s]) === KING ? 3 : 1), 0)
}

/** Material won by `side` over a line (pieces taken minus pieces lost, a dama counting 3, promotions 2). */
export function swing(steps: Step[], side: Side): number {
  return steps.reduce((sum, step) => {
    const gain = captureValue(step) + (step.move.promotes ? 2 : 0)
    return sum + (step.mover === side ? gain : -gain)
  }, 0)
}

/** "1 taşını", "3 taşını (biri dama)" */
export function piecesText(step: Pick<Step, 'move' | 'before'>): string {
  const kings = step.move.captured.filter((s) => Math.abs(step.before.board[s]) === KING).length
  const n = step.move.captured.length
  if (kings === 0) return `${n} taşını`
  if (n === 1) return 'damanı'
  return kings === n ? `${n} damanı` : `${n} taşını (${kings === 1 ? 'biri' : `${kings} tanesi`} dama)`
}

/** A forced loss from the user's point of view, given who is to move. */
function isForcedLoss(score: Score, toMove: Side, user: Side): boolean {
  if (score.kind !== 'mate') return false
  return toMove === user ? score.value < 0 : score.value > 0
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('tr-TR') + text.slice(1)
}

/** The opponent's trap: a quiet move that offers a piece, the forced capture, then a bigger capture. */
function trapIn(steps: Step[], attacker: Side): { offer: Step; take: Step } | null {
  const [offer, forced, take] = steps
  if (!offer || !forced || !take) return null
  if (offer.mover !== attacker || offer.move.captured.length > 0) return null
  if (forced.move.captured.length === 0 || take.mover !== attacker) return null
  return captureValue(take) > captureValue(forced) ? { offer, take } : null
}

export function explainDamaMove(input: ExplainInput): Explanation & { type: DamaErrorType } {
  let before: DamaPosition
  try {
    before = decode(input.before)
  } catch {
    return { text: 'Daha iyi bir hamle vardı.', type: 'other' }
  }
  const user = input.userSide
  const opponent = opponentOf(user)
  const played = applyMove(before, input.move)
  const bestCode = input.best?.pv[0]
  const bestResult = bestCode ? applyMove(before, bestCode) : null
  const bestLabel = bestResult && bestCode ? labelFor(bestCode, bestResult.move) : bestCode
  const better = bestLabel ? ` Daha iyisi ${bestLabel} idi.` : ''
  if (!played) return { text: `Daha iyi bir hamle vardı.${better}`, type: 'other' }

  // The move ended the game in a draw while the user was winning.
  const status = statusOf(played.position)
  if (status?.winner === 'draw' && input.winBefore >= 65) {
    return { text: `Bu hamleden sonra oyun berabere bitti, oysa kazanma şansın yüksekti.${better}`, type: 'endgame' }
  }

  const playedStep: Step = { mover: user, code: input.move, move: played.move, before, after: played.position }
  // Deeper parts of the engine's lines are less certain, so only the next few moves are used.
  const replySteps = simulate(played.position, input.reply?.pv ?? [], 3)
  const bestSteps = input.best ? simulate(before, input.best.pv, 4) : []
  const playedNet = swing([playedStep, ...replySteps], user)
  const bestNet = swing(bestSteps, user)
  const prefix = (text: string) => {
    if (played.move.captured.length > 0 && bestResult && bestResult.move.captured.length > 0 && bestCode !== input.move) {
      return `Almak zorundaydın ama yanlış yoldan aldın: ${lowerFirst(text)}`
    }
    if (played.move.captured.length > 0) return `${played.move.captured.length} taş aldın ama ${lowerFirst(text)}`
    return text
  }

  // 1. Forced results.
  const alreadyLost = input.best ? isForcedLoss(input.best.score, user, user) : false
  if (input.reply && !alreadyLost && isForcedLoss(input.reply.score, played.position.turn, user)) {
    return { text: prefix('Bu hamleden sonra rakip oyunu zorla kazanabiliyor.') + better, type: 'endgame' }
  }
  if (input.best?.score.kind === 'mate' && input.best.score.value > 0 && bestLabel) {
    const stillWinning = input.reply ? isForcedLoss(input.reply.score, played.position.turn, opponent) : status?.winner === user
    if (!stillWinning) return { text: `Burada ${bestLabel} ile oyunu zorla kazanabilirdin.`, type: 'endgame' }
  }

  // 2. Pieces lost in the next moves, compared with the best line.
  if (bestNet - playedNet >= 1) {
    const trap = trapIn(replySteps, opponent)
    if (trap) {
      return {
        text:
          prefix(
            `Bu hamleden sonra rakip ${trap.offer.code} ile bir taş veriyor: alma zorunlu olduğu için almak zorundasın, ardından rakip ${labelFor(trap.take.code, trap.take.move)} ile ${piecesText(trap.take)} alıyor.`,
          ) + better,
        type: 'allowed_trap',
      }
    }
    const first = replySteps[0]
    if (first?.mover === opponent && first.move.captured.length > 0) {
      return {
        text: prefix(`Bu hamleden sonra rakip ${labelFor(first.code, first.move)} ile ${piecesText(first)} alabiliyor.`) + better,
        type: 'allowed_capture',
      }
    }
  }

  // 3. A dama for the opponent (before captures that only come later).
  const theirPromotion = replySteps.find((s) => s.mover === opponent && s.move.promotes)
  const theirPromotionAfterBest = bestSteps.some((s) => s.mover === opponent && s.move.promotes)
  if (theirPromotion && !theirPromotionAfterBest) {
    return {
      text: prefix(`Bu hamleden sonra rakip ${theirPromotion.code} ile taşını son sıraya çıkarıp dama yapabiliyor.`) + better,
      type: 'allowed_promotion',
    }
  }
  if (bestNet - playedNet >= 1) {
    const later = replySteps.find((s) => s.mover === opponent && s.move.captured.length > 0)
    if (later) {
      return {
        text: prefix(`Bu hamleden sonra rakip birkaç hamle içinde ${labelFor(later.code, later.move)} ile ${piecesText(later)} alabiliyor.`) + better,
        type: 'allowed_capture',
      }
    }
  }

  // 4. A combination the user missed: give a piece, the forced capture, then take more.
  const combination = trapIn(bestSteps, user)
  if (combination && bestNet - playedNet >= 1) {
    return {
      text: `Burada ${combination.offer.code} ile bir taş verip rakibi almaya zorlayabilirdin; ardından ${labelFor(combination.take.code, combination.take.move)} ile ${combination.take.move.captured.length} taş alırdın.`,
      type: 'missed_combination',
    }
  }

  // 5. A dama the user missed.
  const myPromotion = bestSteps.find((s) => s.mover === user && s.move.promotes)
  const promotedAnyway = played.move.promotes || replySteps.some((s) => s.mover === user && s.move.promotes)
  if (myPromotion && !promotedAnyway) {
    return { text: `Burada ${myPromotion.code} ile dama yapabilirdin.`, type: 'missed_promotion' }
  }

  // 6. Nothing specific found.
  let text: string
  if (input.winBefore >= 60 && input.winAfter < 55) text = 'Bu hamleyle elindeki üstünlüğü kaybettin.'
  else if (input.winBefore >= 40 && input.winAfter < 35) text = 'Bu hamleden sonra durumun zorlaştı.'
  else text = 'Bu hamleden sonra rakibin durumu güçlendi.'
  return { text: prefix(text) + better, type: 'other' }
}
