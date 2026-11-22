import type { ExplainInput, Explanation, Side } from '../../core/types'
import { opposite } from '../../core/types'
import { BLACK, EMPTY } from './fastboard'
import {
  PASS_MOVE,
  allGroups,
  applyMove,
  colorOf,
  coordOf,
  decode,
  estimateDead,
  groupAt,
  labelFor,
  ownershipOf,
  settledOwnerAt,
  type GoMoveResult,
  type GoPosition,
  type Group,
} from './rules'

/**
 * Plain-Turkish explanations for Go mistakes, built from the engine's lines and the board:
 * stones put into atari or left in atari, captures allowed or missed, groups that became weak
 * (from random-playout ownership), passing too early and small moves. Falls back to
 * "Daha iyisi şuydu: …".
 */

export type GoErrorType = 'lost_group' | 'self_atari' | 'missed_capture' | 'early_pass' | 'small_move' | 'other'

export interface Step {
  mover: Side
  move: string
  result: GoMoveResult
}

/** Plays a line of moves, stopping at an illegal move or the end of the game. */
export function simulate(position: GoPosition, moves: string[], limit: number): Step[] {
  const steps: Step[] = []
  let current = position
  for (const move of moves.slice(0, limit)) {
    const result = applyMove(current, move)
    if (!result) break
    steps.push({ mover: current.turn, move, result })
    current = result.position
    if (result.over) break
  }
  return steps
}

/** Stones `side` takes off the board in a line, and the move that takes the most. */
function capturesBy(steps: Step[], side: Side): { total: number; biggest: Step | null } {
  let total = 0
  let biggest: Step | null = null
  for (const step of steps) {
    if (step.mover !== side || step.result.captured.length === 0) continue
    total += step.result.captured.length
    if (!biggest || step.result.captured.length > biggest.result.captured.length) biggest = step
  }
  return { total, biggest }
}

function joinTr(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

/**
 * Names a group of stones with a case ending: "D4 taşını", "D4 ve D5 taşlarını",
 * "E5 çevresindeki 4 taşını" (accusative) or "…taşının / taşlarının" (genitive).
 */
export function stonesPhrase(stones: number[], size: number, form: 'acc' | 'gen'): string {
  const sorted = [...stones].sort((a, b) => a - b)
  const ending = form === 'acc' ? 'ı' : 'ın'
  if (sorted.length === 1) return `${coordOf(sorted[0], size)} taşın${ending}`
  if (sorted.length <= 3) return `${joinTr(sorted.map((s) => coordOf(s, size)))} taşların${ending}`
  return `${coordOf(centreStone(sorted, size), size)} çevresindeki ${sorted.length} taşın${ending}`
}

/** The stone closest to the middle of a group: a good name for "the stones around X". */
function centreStone(stones: number[], size: number): number {
  const xs = stones.map((s) => s % size)
  const ys = stones.map((s) => Math.floor(s / size))
  const cx = xs.reduce((a, b) => a + b, 0) / stones.length
  const cy = ys.reduce((a, b) => a + b, 0) / stones.length
  let best = stones[0]
  let bestDistance = Infinity
  stones.forEach((s, i) => {
    const d = (xs[i] - cx) ** 2 + (ys[i] - cy) ** 2
    if (d < bestDistance) {
      best = s
      bestDistance = d
    }
  })
  return best
}

/** Centi-points behind a winning chance (inverse of goWinPercent), or null at the extremes. */
function cpOf(win: number): number | null {
  if (!(win > 0.01 && win < 99.99)) return null
  return -800 * Math.log(100 / win - 1)
}

/** Points the move gave away according to the winning chances before and after it. */
export function pointsLost(winBefore: number, winAfter: number): number {
  const before = cpOf(winBefore)
  const after = cpOf(winAfter)
  if (before === null || after === null) return 0
  return Math.max(0, Math.round((before - after) / 100))
}

/** 1 = edge line, 2 = second line, … */
function lineOf(index: number, size: number): number {
  const x = index % size
  const y = Math.floor(index / size)
  return Math.min(x, y, size - 1 - x, size - 1 - y) + 1
}

function distance(a: number, b: number, size: number): number {
  return Math.abs((a % size) - (b % size)) + Math.abs(Math.floor(a / size) - Math.floor(b / size))
}

function stoneCount(position: GoPosition): number {
  let count = 0
  for (const stone of position.board) if (stone !== EMPTY) count++
  return count
}

/** Whether the side to move can take the group right away. */
export function capturableNow(position: GoPosition, group: Group): boolean {
  if (group.liberties.length !== 1) return false
  const capture = applyMove(position, coordOf(group.liberties[0], position.size))
  return !!capture && capture.captured.includes(group.stones[0])
}

/** Average ownership of some stones for `side` (+1 = surely theirs, -1 = surely the opponent's). */
function averageOwnership(ownership: Float32Array, stones: number[], side: Side): number {
  const sign = colorOf(side) === BLACK ? 1 : -1
  return (stones.reduce((sum, s) => sum + ownership[s], 0) / stones.length) * sign
}

/** A group counts as weak below this ownership and as healthy above the other one. */
const WEAK = -0.3
const HEALTHY = 0.3

export function explainGoMove(input: ExplainInput): Explanation & { type: GoErrorType } {
  let before: GoPosition
  try {
    before = decode(input.before)
  } catch {
    return { text: 'Daha iyi bir hamle vardı.', type: 'other' }
  }
  const user = input.userSide
  const opponent = opposite(user)
  const size = before.size
  const bestMove = input.best?.pv[0]
  const bestResult = bestMove ? applyMove(before, bestMove) : null
  const better = !bestMove
    ? ''
    : bestMove === PASS_MOVE
      ? ' Burada pas geçmek daha iyiydi.'
      : ` Daha iyisi ${bestResult ? labelFor(bestResult) : bestMove} idi.`
  const lost = pointsLost(input.winBefore, input.winAfter)
  const lostText = lost >= 2 ? ` Yaklaşık ${lost} alan kaybettirdi.` : ''

  const played = applyMove(before, input.move)
  if (!played) return { text: `Daha iyi bir hamle vardı.${better}`, type: 'other' }

  // The opponent's answer and the user's next move; the engine's best line from the same position.
  // Deeper parts of a search line have few visits, so only the first moves are trusted.
  const replySteps = simulate(played.position, input.reply?.pv ?? [], 3)
  const bestSteps = input.best ? simulate(before, input.best.pv, 4) : []
  const opponentReply = replySteps[0]?.mover === opponent ? replySteps[0] : null

  // 1. Passing while there was still something to play for.
  if (played.pass) {
    if (opponentReply && opponentReply.result.captured.length >= 2) {
      return {
        text: `Pas geçince rakip ${opponentReply.move} ile senin ${stonesPhrase(opponentReply.result.captured, size, 'acc')} yakalayabiliyor.${better}`,
        type: 'early_pass',
      }
    }
    const text = played.over
      ? 'Rakibin pas geçtikten sonra sen de pas geçtin ve oyun bitti. Oysa tahtada hâlâ alan kazanabileceğin yerler vardı.'
      : 'Pas geçmek için erkendi: tahtada hâlâ sahibi belli olmayan değerli yerler vardı.'
    return { text: text + lostText + better, type: 'early_pass' }
  }

  const point = played.point
  const after = played.position
  const myColor = colorOf(user)

  // 2. The played stone's own group is left with one liberty and can be taken right away.
  const ownGroup = groupAt(after.board, size, point)
  if (ownGroup && capturableNow(after, ownGroup)) {
    const liberty = coordOf(ownGroup.liberties[0], size)
    if (ownGroup.stones.length >= 2 || opponentReply?.move === liberty) {
      const text =
        ownGroup.stones.length === 1
          ? `Bu taşı tek nefesi kalacak bir yere koydun (atari): rakip ${liberty} noktasına oynayıp hemen yakalayabiliyor.`
          : `Bu hamle kendi ${ownGroup.stones.length} taşını atariye soktu: tek nefesleri ${liberty} kaldı ve rakip oraya oynayıp hepsini yakalayabiliyor.`
      return { text: text + better, type: 'self_atari' }
    }
  }

  // 3. A group was already in atari and the move did not save it.
  let ignored: { group: Group; liberty: string } | null = null
  for (const group of allGroups(before.board, size)) {
    if (group.color !== myColor || group.liberties.length !== 1) continue
    const now = groupAt(after.board, size, group.stones[0])
    if (!now || !capturableNow(after, now)) continue
    const liberty = coordOf(now.liberties[0], size)
    if (now.stones.length < 2 && opponentReply?.move !== liberty) continue
    if (!ignored || now.stones.length > ignored.group.stones.length) ignored = { group: now, liberty }
  }
  if (ignored) {
    const { group, liberty } = ignored
    let advice = better
    if (bestMove === coordOf(group.liberties[0], size)) advice = ` Daha iyisi ${bestMove} ile taşlarını kaçırmaktı.`
    else if (bestResult && bestResult.captured.length > 0) advice = ` Daha iyisi ${labelFor(bestResult)} ile sıkıştıran taşları yakalamaktı.`
    return {
      text: `Senin ${stonesPhrase(group.stones, size, 'gen')} tek nefesi kalmıştı (atari) ama başka yere oynadın: rakip ${liberty} noktasına oynayıp onları yakalayabiliyor.${advice}`,
      type: 'lost_group',
    }
  }

  // 4. The opponent takes stones in the next moves, more than after the best move.
  const lostInLine = capturesBy(replySteps, opponent)
  const lostAfterBest = capturesBy(bestSteps, opponent).total
  if (lostInLine.biggest) {
    const step = lostInLine.biggest
    const immediate = step === opponentReply
    const extra = lostInLine.total - lostAfterBest
    if ((immediate && extra >= 1) || extra >= 2) {
      const stones = stonesPhrase(step.result.captured, size, 'acc')
      const text = immediate
        ? `Bu hamleden sonra rakip ${step.move} ile senin ${stones} yakalayabiliyor.`
        : `Bu hamleden sonra rakip ${replySteps[0].move} ile başlayıp birkaç hamlede senin ${stones} yakalayabiliyor.`
      return { text: text + better, type: 'lost_group' }
    }
  }

  // 5. The best move (or the best line) took stones and the played move did not.
  const takenInLine = played.captured.length + capturesBy(replySteps, user).total
  if (bestResult && bestResult.captured.length > played.captured.length) {
    const target = groupAt(before.board, size, bestResult.captured[0])
    const stones = target ? target.stones : bestResult.captured
    return {
      text: `Rakibin ${stonesPhrase(stones, size, 'gen')} tek nefesi kalmıştı (atari). ${bestMove} noktasına oynayıp onları yakalayabilirdin.`,
      type: 'missed_capture',
    }
  }
  const bestTaken = capturesBy(bestSteps, user)
  if (bestTaken.biggest && bestTaken.total - takenInLine >= 2) {
    return {
      text: `Burada ${bestMove} ile rakibin ${stonesPhrase(bestTaken.biggest.result.captured, size, 'acc')} sıkıştırıp birkaç hamlede yakalayabilirdin.`,
      type: 'missed_capture',
    }
  }

  // 6. Groups that became weak (or stayed alive) because of the move, from random-playout ownership.
  if (bestResult && !bestResult.pass) {
    const ownAfterPlayed = ownershipOf(after)
    const ownAfterBest = ownershipOf(bestResult.position)
    let weakened: Group | null = null
    let escaped: Group | null = null
    for (const group of allGroups(after.board, size)) {
      if (group.stones.length < 2) continue
      // The group's stones must be on the board after the best move too.
      if (group.stones.some((s) => bestResult.position.board[s] !== group.color)) continue
      const side: Side = group.color === myColor ? user : opponent
      const ifPlayed = averageOwnership(ownAfterPlayed, group.stones, side)
      const ifBest = averageOwnership(ownAfterBest, group.stones, side)
      if (side === user && ifPlayed <= WEAK && ifBest >= HEALTHY) {
        if (!weakened || group.stones.length > weakened.stones.length) weakened = group
      } else if (side === opponent && ifBest <= WEAK && ifPlayed >= HEALTHY) {
        if (!escaped || group.stones.length > escaped.stones.length) escaped = group
      }
    }
    if (weakened) {
      const near = weakened.stones.some((s) => distance(s, bestResult.point, size) <= 2)
      const advice = near ? ` Daha iyisi ${bestMove} ile bu taşları güçlendirmekti.` : better
      return {
        text: `Bu hamleden sonra senin ${stonesPhrase(weakened.stones, size, 'acc')} kurtarmak çok zorlaştı: rakip onları çevirip yakalayabilir.${advice}`,
        type: 'lost_group',
      }
    }
    if (escaped) {
      return {
        text: `Burada ${bestMove} ile rakibin ${stonesPhrase(escaped.stones, size, 'acc')} çevirip yakalama şansın vardı. Bu hamleden sonra kurtulabiliyorlar.`,
        type: 'missed_capture',
      }
    }
  }

  // 7. Small moves: too close to the edge early on, inside settled areas, or far from the big point.
  const settled = settledOwnerAt(before, point)
  const bestPoint = bestResult && !bestResult.pass ? bestResult.point : null
  if (bestPoint !== null && stoneCount(before) < 14 && lineOf(point, size) <= 2 && lineOf(bestPoint, size) >= 3) {
    return {
      text: `Oyunun başında kenara bu kadar yakın oynamak az alan getirir. ${bestMove} ortaya daha yakın ve daha çok alan çevirir.${lostText}`,
      type: 'small_move',
    }
  }
  if (settled === myColor) {
    return {
      text: `Bu nokta zaten senin alanındaydı; buraya oynamak sana yeni alan kazandırmadı.${lostText}${better}`,
      type: 'small_move',
    }
  }
  if (settled !== EMPTY && settled !== myColor && estimateDead(after).includes(point)) {
    return {
      text: `Bu taş rakibinin sağlam alanının içinde kaldı; orada yaşaması çok zor.${lostText}${better}`,
      type: 'small_move',
    }
  }
  if (bestPoint !== null && distance(point, bestPoint, size) >= 5) {
    return {
      text: `Bu hamle küçük kaldı: tahtanın başka bir yerinde daha büyük bir yer vardı.${lostText}${better}`,
      type: 'small_move',
    }
  }

  // 8. Nothing specific found.
  let text: string
  if (input.winBefore >= 60 && input.winAfter < 55) text = 'Bu hamleyle elindeki üstünlüğü kaybettin.'
  else if (input.winBefore >= 40 && input.winAfter < 35) text = 'Bu hamleden sonra durumun zorlaştı.'
  else text = 'Bu hamleden sonra rakibin durumu güçlendi.'
  return { text: text + lostText + better, type: 'other' }
}
