import type { Classification } from '../classify'

/** Short sentences for moves that are not the user's errors (those get the game's own explanation). */

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase('tr-TR') + text.slice(1)
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' ')

const VERDICT: Partial<Record<Classification, string>> = {
  brilliant: 'Parlak! Taş veriyor ama doğru devam bu.',
  great: 'Harika! Tek iyi hamle buydu.',
  best: 'En iyi hamle.',
  excellent: 'Çok iyi hamle.',
  good: 'İyi hamle.',
  forced: 'Başka yasal hamle yoktu.',
}

/**
 * "En iyi hamle. Atı alıyor." / "İyi hamle. Merkezi tutuyor. Daha iyisi ♘f3 idi."
 * `facts` says what the move does; `betterLabel` is the engine's choice when it was not played.
 */
export function goodMoveText(classification: Classification, facts: string | null, betterLabel: string | null): string {
  const verdict = VERDICT[classification] ?? ''
  let better: string | null = null
  if (betterLabel && classification === 'excellent') better = `En iyisi ${betterLabel} idi.`
  if (betterLabel && classification === 'good') better = `Daha iyisi ${betterLabel} idi.`
  return join(verdict, facts, better)
}

const OPPONENT_ERROR: Partial<Record<Classification, string>> = {
  inaccuracy: 'Rakibin küçük bir yanlışlığı.',
  mistake: 'Rakip hata yaptı.',
  blunder: 'Rakip büyük bir hata yaptı.',
}

export interface BestReply {
  label: string
  /** What the reply does ("Atı alıyor."), if anything notable. */
  facts: string | null
  /** The user did play it. */
  found: boolean
}

/**
 * "Rakip hata yaptı. Şimdi en iyi cevap ♘xe5: atı alıyor. Sen de bunu buldun!"
 * Without a reply of the user's (the opponent moves again), the better move is named instead.
 */
export function opponentErrorText(classification: Classification, reply: BestReply | null, betterLabel: string | null): string {
  const verdict = OPPONENT_ERROR[classification] ?? ''
  if (!reply) return join(verdict, betterLabel ? `Daha iyisi ${betterLabel} idi.` : null)
  // Facts that have their own colon read better as a sentence of their own.
  const what = !reply.facts ? '.' : /[:;]/.test(reply.facts) ? `. ${reply.facts}` : `: ${lowerFirst(reply.facts)}`
  return join(verdict, `Şimdi en iyi cevap ${reply.label}${what}`, reply.found ? 'Sen de bunu buldun!' : null)
}

/**
 * During a game: the opponent went wrong, but the coach does not give away the answer.
 * "Rakip hata yaptı. Senin için bir fırsat doğdu: bulabilir misin?"
 */
export function liveOpponentErrorText(classification: Classification, userReplies: boolean): string {
  const verdict = OPPONENT_ERROR[classification] ?? ''
  if (!userReplies) return verdict
  return join(verdict, classification === 'inaccuracy' ? 'Durumun biraz iyileşti.' : 'Senin için bir fırsat doğdu: bulabilir misin?')
}

const upperFirst = (text: string) => text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1)
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

/**
 * ["Atı alıyor", "şah çekiyor"] -> "Atı alıyor ve şah çekiyor." (at most two facts). Facts with their own
 * punctuation ("Atari yapıyor: …") stay separate sentences.
 */
export function factsSentence(facts: string[]): string | null {
  const used = facts.filter(Boolean).slice(0, 2)
  if (used.length === 0) return null
  if (used.length === 2 && used.some((fact) => /[,;:!]/.test(fact))) return used.map((fact) => sentence(upperFirst(fact))).join(' ')
  return sentence(used.map((fact, i) => (i === 0 ? upperFirst(fact) : lowerFirst(fact))).join(' ve '))
}
