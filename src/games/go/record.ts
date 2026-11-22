import type { MoveRecord, MoverResult, ReadGame, Side } from '../../core/types'
import { BLACK, DEFAULT_KOMI, WHITE } from './fastboard'
import {
  applyMove,
  encode,
  finalScore,
  initialPosition,
  labelFor,
  winnerOf,
  type AreaScore,
  type GoMoveResult,
  type GoPosition,
} from './rules'
import { parseSgf, type SgfGame } from './sgf'

export interface GoState {
  /** Position before the first move (with any handicap stones). */
  start: GoPosition
  position: GoPosition
  moves: MoveRecord[]
  /** Stones the user marked dead after the game (null = use the estimate). */
  dead: number[] | null
}

export function moveRecord(before: GoPosition, move: string, result: GoMoveResult): MoveRecord {
  return { code: move, label: labelFor(result), side: result.mover, before: encode(before), after: encode(result.position) }
}

export function newState(): GoState {
  const start = initialPosition()
  return { start, position: start, moves: [], dead: null }
}

export function resultForMover(score: AreaScore, mover: Side): MoverResult {
  const winner = winnerOf(score)
  return winner === 'draw' ? 'draw' : winner === mover ? 'win' : 'loss'
}

/** Replays an SGF game (main line). Throws a Turkish message for files that cannot be read. */
export function replay(record: string): { state: GoState; terminal: ReadGame['terminal']; sgf: SgfGame | null } {
  if (!record.trim()) return { state: newState(), terminal: [null], sgf: null }
  const sgf = parseSgf(record)
  let position = initialPosition(sgf.size, sgf.komi ?? DEFAULT_KOMI)
  for (const p of sgf.setup.black) position.board[p] = BLACK
  for (const p of sgf.setup.white) position.board[p] = WHITE
  const handicap = sgf.setup.black.length > 0 && sgf.setup.white.length === 0
  position.turn = sgf.firstPlayer ?? sgf.moves[0]?.side ?? (handicap ? 'b' : 'w')
  const start = position
  const moves: MoveRecord[] = []
  sgf.moves.forEach(({ side, move }, k) => {
    // Be forgiving with files where the same colour moves twice or play resumed after two passes.
    if (side !== position.turn || position.passes >= 2) position = { ...position, turn: side, ko: side !== position.turn ? -1 : position.ko, passes: 0 }
    const result = applyMove(position, move)
    if (!result) throw new Error(`Geçersiz Go hamlesi: ${k + 1}. hamle (${move})`)
    moves.push(moveRecord(position, move, result))
    position = result.position
  })
  const dead = sgf.dead
  const terminal: ReadGame['terminal'] = moves.map(() => null)
  terminal.push(null)
  if (position.passes >= 2 && moves.length > 0) {
    terminal[moves.length] = resultForMover(finalScore(position, dead ?? undefined), moves[moves.length - 1].side)
  }
  return { state: { start, position, moves, dead }, terminal, sgf }
}
