import { factsSentence } from '../../core/analysis/moveText'
import type { GamePhase, MoveFacts } from '../../core/types'
import { opposite } from '../../core/types'
import { EMPTY } from './fastboard'
import { applyMove, colorOf, decode, emptyRegions, groupAt, legalPoints, neighbours, walledOwner, type GoPosition } from './rules'

/** What a Go move does, in words true for either player: captures, saving stones in atari, atari. */
export function describeGoMove(position: string, move: string): MoveFacts | null {
  let start: GoPosition
  try {
    start = decode(position)
  } catch {
    return null
  }
  const result = applyMove(start, move)
  if (!result) return null
  // Passing is always allowed, so a move is forced only when no point can be played.
  const forced = legalPoints(start).length === 0
  if (result.pass) return { text: result.over ? 'Pas geçiyor; oyun bitiyor ve sayılıyor.' : 'Pas geçiyor.', forced }

  const { size } = start
  const own = colorOf(result.mover)
  const enemy = colorOf(opposite(result.mover))
  const near = neighbours(result.point, size)
  const facts: string[] = []
  if (result.captured.length > 0) facts.push(`${result.captured.length} taş alıyor`)

  const wasInAtari = near.some((p) => start.board[p] === own && groupAt(start.board, size, p)?.liberties.length === 1)
  const joined = groupAt(result.position.board, size, result.point)
  if (wasInAtari && joined && joined.liberties.length >= 2) facts.push('Atarideki taşlarını kurtarıyor')

  const inAtari = near
    .filter((p) => result.position.board[p] === enemy)
    .map((p) => groupAt(result.position.board, size, p))
    .find((group) => group && group.liberties.length === 1)
  if (inAtari) {
    const stones = inAtari.stones.length
    facts.push(`Atari yapıyor: karşıdaki ${stones === 1 ? 'taş' : `${stones} taş`} bir hamle sonra alınabilir`)
  }
  return { text: factsSentence(facts), forced }
}

/**
 * Opening while about a sixth of the board holds stones (14 on 9×9, 29 on 13×13, 62 on 19×19);
 * endgame once more than half of it does (44 on 9×9) or no open area is left.
 *
 * Kept quick on purpose: the player summary asks this for every move of the latest games. Whether an
 * area is still open is read from the board as it is, without guessing dead stones (that guess plays
 * hundreds of random games, about 20 ms a position, and made the summary take seconds).
 */
export function goPhase(position: string): GamePhase {
  try {
    const start = decode(position)
    const stones = start.board.reduce((sum, point) => (point === 0 ? sum : sum + 1), 0)
    const points = start.size * start.size
    if (stones <= Math.round(points * 0.172)) return 'opening'
    if (stones >= Math.round(points * 0.54)) return 'endgame'
    const { regions } = emptyRegions(start.board, start.size)
    if (!regions.some((region) => walledOwner(region) === EMPTY)) return 'endgame'
  } catch {
    // fall through
  }
  return 'middlegame'
}
