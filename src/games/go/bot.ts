import { pickHumanMove } from '../../core/humanize'
import type { EngineLine } from '../../core/types'
import { BLACK, EMPTY, FastBoard, PASS, type Rng } from './fastboard'
import type { GoLevel } from './levels'
import {
  PASS_MOVE,
  applyMove,
  coordOf,
  decode,
  finalScore,
  hasContestedPoints,
  toFast,
  type GoPosition,
} from './rules'
import { search, type ChildStats } from './search'

export interface GoAnalysis {
  lines: EngineLine[]
  /** Average owner of every point (+1 black, -1 white). */
  ownership: number[]
}

/**
 * Random games cost more on bigger boards (about 2× on 13×13 and 4.3× on 19×19), so the computer
 * plays fewer of them there and answers about as quickly as on 9×9. (Moves are only analysed on
 * 9×9: on the big boards random games misjudge the opening badly, measured at 3-23 points for
 * ordinary first moves, so their judgments would teach wrong things.)
 */
const MOVE_SHARE: Record<number, number> = { 9: 1, 13: 0.5, 19: 0.2 }
export function playoutsFor(playouts: number, size: number): number {
  return Math.max(100, Math.round(playouts * (MOVE_SHARE[size] ?? 1)))
}

function moveCode(fast: FastBoard, move: number): string {
  return move === PASS ? PASS_MOVE : coordOf(fast.plain(move), fast.size)
}

/** If the opponent just passed: the final margin (black - white - komi) should the side to move pass too. */
function passEndsMargin(position: GoPosition): number | undefined {
  if (position.passes === 0) return undefined
  const after = applyMove(position, PASS_MOVE)
  return after ? finalScore(after.position).margin : undefined
}

function toLine(fast: FastBoard, child: ChildStats): EngineLine {
  return { score: { kind: 'cp', value: Math.round(child.lead * 100) }, pv: child.pv.map((m) => moveCode(fast, m)) }
}

/**
 * Best moves for the side to move. Scores are the expected final margin in centi-points.
 * Once every area is walled in, the result is the exact count and passing is the best move:
 * random playouts would only add noise there.
 */
export function analyzeGo(positionText: string, options: { playouts: number; multiPV: number }, rng: Rng = Math.random): GoAnalysis {
  const position = decode(positionText)
  if (position.passes >= 2) return { lines: [], ownership: [] }
  if (!hasContestedPoints(position)) {
    const score = finalScore(position)
    const sign = position.turn === 'w' ? 1 : -1
    return {
      lines: [{ score: { kind: 'cp', value: Math.round(score.margin * sign * 100) }, pv: [PASS_MOVE, PASS_MOVE] }],
      ownership: Array.from(score.owner, (o) => (o === BLACK ? 1 : o === EMPTY ? 0 : -1)),
    }
  }
  const fast = toFast(position)
  const result = search(fast, { playouts: options.playouts, rng, passEndsMargin: passEndsMargin(position) })
  const top = result.children[0]?.visits ?? 0
  const lines = result.children
    .filter((child, i) => i === 0 || child.visits >= top * 0.05)
    .slice(0, Math.max(1, options.multiPV))
    .map((child) => toLine(fast, child))
  return { lines, ownership: Array.from(result.ownership) }
}

/** The computer's move at a level: "D4" or "pass". */
export function chooseGoMove(positionText: string, level: GoLevel, rng: Rng = Math.random): string {
  const position = decode(positionText)
  if (position.passes >= 2) return PASS_MOVE
  const fast = toFast(position)
  const color = fast.turn
  const sensible: string[] = []
  for (let i = 0; i < fast.nEmpty; i++) {
    const p = fast.empties[i]
    if (!fast.isEyeLike(p, color) && fast.isLegal(p, color)) sensible.push(moveCode(fast, p))
  }
  if (sensible.length === 0) return PASS_MOVE

  const passMargin = passEndsMargin(position)
  const sign = color === BLACK ? 1 : -1
  // The opponent passed and the count already favours the computer: accept the end of the game.
  if (passMargin !== undefined && passMargin * sign > 0) return PASS_MOVE

  // Nothing left to fight over: pass instead of filling in territory.
  if (!hasContestedPoints(position)) return PASS_MOVE

  const result = search(fast, { playouts: playoutsFor(level.playouts, position.size), rng, passEndsMargin: passMargin })
  // While something is open, a move is never worse than passing under area scoring
  // (the search may still rank "pass" first when every move looks equally won or lost).
  const top = result.children.find((child) => child.move !== PASS)
  if (!top) return PASS_MOVE

  if (level.humanize) {
    const lines = result.children
      .filter((child) => child.move !== PASS)
      .slice(0, level.humanize.multiPV)
      .map((child) => toLine(fast, child))
    // Random moves never fill the computer's own eyes or pass.
    return pickHumanMove(lines, sensible, level.humanize, rng) ?? moveCode(fast, top.move)
  }
  return moveCode(fast, top.move)
}
