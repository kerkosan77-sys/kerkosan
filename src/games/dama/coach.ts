import { AlphaBeta, type RootLine, type SearchGame } from '../../core/alphabeta'
import type { BoardMark, CoachWarning } from '../../core/types'
import { labelFor, piecesText, simulate, type Step } from './explain'
import {
  KING,
  MAN,
  encode,
  legalMoves,
  opponentOf,
  promotionRow,
  rowOf,
  squareName,
  type DamaMove,
  type DamaPosition,
} from './rules'
import { damaGame } from './search'

/**
 * Dama coach: warns before a move that gives pieces away (or lets the opponent make a dama) when a
 * safer move exists, and turns the reminder questions into nudges for the current position.
 * Both use a short material-only search: 3 half-moves plus every capture that follows.
 */

/** Material only (a dama = 3 men), from the side to move: what the coach counts. */
function material(position: DamaPosition): number {
  let total = 0
  for (const p of position.board) {
    if (p === 0) continue
    const value = Math.abs(p) === KING ? 300 : 100
    total += p > 0 ? value : -value
  }
  return position.turn === 'w' ? total : -total
}

const materialGame: SearchGame<DamaPosition, DamaMove> = { ...damaGame, evaluate: material }

/** Every legal move scored by the short material search, best first. */
export function materialLines(position: DamaPosition): RootLine[] {
  const count = legalMoves(position).length
  return new AlphaBeta(materialGame).analyze(position, { depth: 3, multiPV: count, maxNodes: 200_000 })
}

/** A warning is worth showing from this much lost material (centi-men) compared with the safest move. */
const WARN_AT = 100

function ring(squares: number[], kind: 'danger' | 'threat'): BoardMark[] {
  return squares.map((s) => ({ kind, square: squareName(s) }))
}

/** Warning for a move that gives material away when a safer move exists, or null. */
export function damaCoachWarning(position: DamaPosition, code: string): CoachWarning | null {
  const lines = materialLines(position)
  const line = lines.find((l) => l.move === code)
  if (!line || lines.length < 2) return null
  const now = material(position)
  if (lines[0].value - line.value < WARN_AT || line.value > now - WARN_AT / 2) return null

  const user = position.turn
  const opponent = opponentOf(user)
  const steps = simulate(position, line.pv, 4)
  const reply = steps.slice(1)
  const [offer, forced, take] = reply
  // A trap: the opponent gives a piece, the capture is compulsory, then it takes more.
  if (offer && forced && take && offer.move.captured.length === 0 && forced.move.captured.length > 0 && take.move.captured.length > 0) {
    return {
      text: `Bu hamleden sonra rakip ${offer.code} ile bir taş verip seni almaya zorlar, ardından ${labelFor(take.code, take.move)} ile ${piecesText(take)} alır.`,
      marks: [...ring(take.move.captured, 'danger'), { kind: 'threat', square: squareName(offer.move.path[offer.move.path.length - 1]) }],
    }
  }
  const captureText = (capture: Step, when: string) => ({
    text: `${when} ${labelFor(capture.code, capture.move)} ile ${piecesText(capture)} alabilir.`,
    marks: [...ring(capture.move.captured, 'danger'), { kind: 'threat' as const, square: squareName(capture.move.from) }],
  })
  if (offer?.move.captured.length) return captureText(offer, 'Bu hamleden sonra rakip')
  const promotion = reply.find((s: Step) => s.mover === opponent && s.move.promotes)
  if (promotion) {
    return {
      text: `Bu hamleden sonra rakip ${promotion.code} ile dama yapabilir.`,
      marks: [{ kind: 'threat', square: squareName(promotion.move.from) }],
    }
  }
  const later = reply.find((s) => s.mover === opponent && s.move.captured.length > 0)
  return later ? captureText(later, 'Bu hamleden sonra rakip birkaç hamle içinde') : null
}

/** A man of `side` one or two rows from the far row. */
function nearPromotion(position: DamaPosition, side: 'w' | 'b'): boolean {
  const own = side === 'w' ? 1 : -1
  for (let i = 0; i < 64; i++) {
    if (position.board[i] === own * MAN && Math.abs(rowOf(i) - promotionRow(side)) <= 2) return true
  }
  return false
}

const questionCache = new Map<string, string[]>()

/** Reminder questions for the current position (the user is to move). Nudges, not answers. */
export function damaCoachQuestions(position: DamaPosition): string[] {
  const key = encode(position)
  const cached = questionCache.get(key)
  if (cached) return cached

  const user = position.turn
  const opponent = opponentOf(user)
  const moves = legalMoves(position)
  const mustCapture = moves.length > 0 && moves[0].captured.length > 0
  const threatened = legalMoves({ ...position, turn: opponent }).some((m) => m.captured.length > 0)

  const first = mustCapture
    ? 'Alma zorunlu: en çok taş alan yolu seçmelisin. Birden fazla yol varsa, aldıktan sonra rakip geri alabilir mi?'
    : threatened
      ? 'Dikkat: sıra rakibinde olsaydı taş alabilirdi. Hangi taşın tehlikede, nasıl korursun?'
      : 'Rakibinin son hamlesi neyi hedefliyor? Hamlenden sonra rakip taş alabilir mi?'

  const second = nearPromotion(position, user)
    ? 'Dama yapmaya yakın bir taşın var. Yolu açık mı?'
    : nearPromotion(position, opponent)
      ? 'Rakibinin dama yapmaya yakın bir taşı var. Onu durdurabilir misin?'
      : 'Taşlarını yan yana ve arka arkaya tutmak onları korur. Tek başına kalan taşın var mı?'

  // With no capture now, winning material within three half-moves against the best defence
  // means a forcing idea exists (usually giving a piece first).
  const now = material(position)
  const tactic = !mustCapture && materialLines(position).some((line) => line.value >= now + 100)
  const third = tactic
    ? 'Rakibini zorlayarak taş kazanabileceğin bir hamle var (belki bir taş vererek). Bulabilir misin?'
    : 'Bir taş verip rakibi zorunlu almaya sokarak daha çok taş alabileceğin bir hamle var mı?'

  const questions = [first, second, third]
  if (questionCache.size > 30) questionCache.delete(questionCache.keys().next().value as string)
  questionCache.set(key, questions)
  return questions
}

/** One short note before the user's move: the most urgent thing to look at, without naming a move. */
export function damaCoachTip(position: DamaPosition): string {
  const user = position.turn
  const opponent = opponentOf(user)
  const moves = legalMoves(position)
  if (moves.length > 0 && moves[0].captured.length > 0) return 'Alma zorunlu: en çok taş alan yolu seç.'
  if (legalMoves({ ...position, turn: opponent }).some((m) => m.captured.length > 0)) return 'Dikkat: bir taşın tehlikede. Onu koru.'
  if (materialLines(position).some((line) => line.value >= material(position) + 100)) return 'Zorlayarak taş kazanabileceğin bir hamle var. Bulabilir misin?'
  if (nearPromotion(position, user)) return 'Dama olmaya yakın bir taşın var. Yolu açık mı?'
  if (nearPromotion(position, opponent)) return 'Rakip dama olmaya yakın. Onu durdur!'
  return 'Taşlarını yan yana tut, tek başına taş bırakma.'
}
