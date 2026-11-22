import type { BoardMark, CoachWarning } from '../../core/types'
import { opposite } from '../../core/types'
import { capturableNow, stonesPhrase } from './explain'
import {
  allGroups,
  applyMove,
  colorOf,
  coordOf,
  finalScore,
  formatPoints,
  groupAt,
  hasContestedPoints,
  neighbours,
  openPoints,
  winnerOf,
  type GoMoveResult,
  type GoPosition,
  type Group,
} from './rules'

/**
 * Go coach: warns before a move that puts the user's own stones into atari, leaves a group in
 * atari that could still be saved, or passes while points are still open; and turns the reminder
 * questions into nudges for the current position, without naming the move.
 */

/** Open points are marked on the board only when there are few enough to be a useful pointer. */
const MAX_MARKED_POINTS = 20

function ring(stones: number[], size: number, kind: 'danger' | 'threat'): BoardMark[] {
  return stones.map((s) => ({ kind, square: coordOf(s, size) }))
}

/** Whether a group in atari can get out of it: by extending, or by capturing a neighbour in atari. */
export function canEscape(position: GoPosition, group: Group): boolean {
  const { size } = position
  const extended = applyMove(position, coordOf(group.liberties[0], size))
  if (extended) {
    const after = groupAt(extended.position.board, size, group.liberties[0])
    if (after && after.liberties.length >= 2) return true
  }
  const seen = new Set<number>()
  for (const stone of group.stones) {
    for (const n of neighbours(stone, size)) {
      if (position.board[n] === 0 || position.board[n] === group.color || seen.has(n)) continue
      const enemy = groupAt(position.board, size, n)!
      for (const s of enemy.stones) seen.add(s)
      if (capturableNow(position, enemy)) return true
    }
  }
  return false
}

function passWarning(position: GoPosition, result: GoMoveResult): CoachWarning | null {
  const open = openPoints(position)
  if (open.length === 0 && !hasContestedPoints(position)) return null
  const { size } = position
  const marks: BoardMark[] =
    open.length > 0 && open.length <= MAX_MARKED_POINTS ? open.map((p) => ({ kind: 'hint', square: coordOf(p, size) })) : []
  const where = marks.length > 0 ? ' (yeşil kareler)' : ''
  const note = marks.length > 0 ? 'Yeşil kareler henüz kimseye ait olmayan noktaları gösteriyor.' : undefined

  if (result.over) {
    // Ending a game the user wins is fine; warn only when the count goes against them.
    const score = finalScore(result.position)
    const winner = winnerOf(score)
    if (winner === position.turn) return null
    const text =
      winner === 'draw'
        ? `Sen de pas geçersen oyun biter ve şu anki sayıma göre berabere kalırsın. Tahtada hâlâ alan kazanabileceğin yerler var${where}.`
        : `Sen de pas geçersen oyun biter ve şu anki sayıma göre ${formatPoints(Math.abs(score.margin))} farkla kaybedersin. Tahtada hâlâ alan kazanabileceğin yerler var${where}.`
    return { text, marks, note }
  }
  return {
    text: `Tahtada hâlâ sahibi belli olmayan yerler var${where}. Pas geçersen rakibin oralara oynayıp alan kazanabilir.`,
    marks,
    note,
  }
}

/** Warning for a move that gives stones away (or passes too early), or null. */
export function goCoachWarning(position: GoPosition, move: string): CoachWarning | null {
  const result = applyMove(position, move)
  if (!result) return null
  if (result.pass) return passWarning(position, result)

  const { size } = position
  const after = result.position
  const myColor = colorOf(position.turn)

  // The new stone's group is left with one liberty and can be taken right away.
  const own = groupAt(after.board, size, result.point)
  if (own && capturableNow(after, own) && (own.stones.length >= 2 || result.captured.length === 0)) {
    const liberty = own.liberties[0]
    const text =
      own.stones.length === 1
        ? `Bu taşın tek nefesi kalır (atari): rakip ${coordOf(liberty, size)} noktasına oynayıp hemen yakalayabilir.`
        : `Bu hamle ${own.stones.length} taşını atariye sokar: tek nefesleri ${coordOf(liberty, size)} kalır ve rakip oraya oynayıp hepsini yakalayabilir.`
    return { text, marks: [...ring(own.stones, size, 'danger'), { kind: 'threat', square: coordOf(liberty, size) }] }
  }

  // A group of two or more stones was in atari, could still escape, and the move leaves it there.
  let left: Group | null = null
  for (const group of allGroups(position.board, size)) {
    if (group.color !== myColor || group.stones.length < 2 || group.liberties.length !== 1) continue
    const now = groupAt(after.board, size, group.stones[0])
    if (!now || !capturableNow(after, now) || !canEscape(position, group)) continue
    if (!left || now.stones.length > left.stones.length) left = now
  }
  if (left) {
    const liberty = coordOf(left.liberties[0], size)
    return {
      text: `Senin ${stonesPhrase(left.stones, size, 'gen')} tek nefesi kaldı (atari). Bu hamleden sonra rakip ${liberty} noktasına oynayıp onları yakalayabilir.`,
      marks: [...ring(left.stones, size, 'danger'), { kind: 'threat', square: liberty }],
    }
  }
  return null
}

/** Reminder questions for the current position (the user is to move). Nudges, not answers. */
export function goCoachQuestions(position: GoPosition): string[] {
  const { size } = position
  const mine = colorOf(position.turn)
  const theirs = colorOf(opposite(position.turn))
  const groups = allGroups(position.board, size)
  const myGroups = groups.filter((g) => g.color === mine)
  const theirGroups = groups.filter((g) => g.color === theirs)

  let danger: string
  if (myGroups.some((g) => g.liberties.length === 1)) {
    danger = 'Dikkat: tek nefesi kalan (atari) taşların var. Onları kurtarabilir misin, yoksa başka yerde daha büyük bir hamle mi var?'
  } else if (myGroups.some((g) => g.stones.length >= 2 && g.liberties.length === 2)) {
    danger = 'İki nefesi kalan bir grubun var. Rakip onu sıkıştırırsa ne olur?'
  } else {
    danger = 'Rakibinin son hamlesi neyi hedefliyor? Taşlarından birinin nefesini azaltıyor mu?'
  }

  let chance: string
  if (theirGroups.some((g) => capturableNow(position, g))) {
    chance = 'Rakibinin tek nefesi kalan (atari) taşları var. Yakalayabilir misin?'
  } else if (theirGroups.some((g) => g.stones.length >= 2 && g.liberties.length === 2)) {
    chance = 'Rakibinin iki nefesi kalan bir grubu var. Onu atariye sokabilir misin, sıkıştırmak işine yarar mı?'
  } else {
    chance = 'Tahtada henüz kimsenin olmayan en büyük boş bölge nerede?'
  }

  const last = hasContestedPoints(position)
    ? 'Bu hamle kendi taşlarının nefesini azaltıyor mu?'
    : 'Bütün alanlar kapanmış görünüyor. Oynayacak işe yarar yer kalmadıysa pas geçebilirsin.'
  return [danger, chance, last]
}

/** One short note before the user's move: the most urgent thing to look at, without naming a move. */
export function goCoachTip(position: GoPosition): string {
  const { size } = position
  const mine = colorOf(position.turn)
  const theirs = colorOf(opposite(position.turn))
  const groups = allGroups(position.board, size)
  if (groups.some((g) => g.color === mine && g.liberties.length === 1)) return 'Atarideki taşların var: kurtar ya da daha büyük bir yere oyna.'
  if (groups.some((g) => g.color === theirs && capturableNow(position, g))) return 'Rakibin atarideki taşları var. Yakalayabilir misin?'
  if (!hasContestedPoints(position)) return 'Alanlar kapandı. Yapacak hamle kalmadıysa pas geç.'
  if (groups.some((g) => g.color === mine && g.stones.length >= 2 && g.liberties.length === 2)) return 'İki nefesi kalan bir grubun var. Ona dikkat et.'
  return 'En büyük boş bölge nerede? Oraya yerleş.'
}
