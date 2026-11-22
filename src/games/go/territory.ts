import type { BoardMark } from '../../core/types'
import { BLACK, EMPTY, WHITE } from './fastboard'
import { coordOf, estimateDead, formatPoints, ownershipOf, sideOf, type GoPosition } from './rules'

/** An empty point is marked for a side once the random playouts lean that way at least this much. */
const MARK = 0.2

export interface TerritoryView {
  marks: BoardMark[]
  /** Expected area of each side (stones and territory). */
  black: number
  white: number
  /** Black's lead after komi (negative: White leads). */
  margin: number
  text: string
}

/**
 * The likely territory during a game (like the "show territory" button of Go apps): random playouts
 * from the position say how likely each point is to end up Black's or White's. Points that lean
 * clearly to one side are marked, likely dead stones are crossed, and the expected area is counted.
 */
export function territoryView(position: GoPosition): TerritoryView {
  const total = position.board.length
  if (position.board.every((stone) => stone === EMPTY)) {
    return { marks: [], black: 0, white: 0, margin: -position.komi, text: 'Tahtada henüz taş yok: alanlar ilk hamlelerden sonra belirmeye başlar.' }
  }
  const ownership = ownershipOf(position)
  const dead = new Set(estimateDead(position))
  const marks: BoardMark[] = []
  let black = 0
  position.board.forEach((stone, point) => {
    const value = ownership[point]
    // +1 means Black surely owns it at the end, -1 White.
    black += (1 + value) / 2
    const square = coordOf(point, position.size)
    if (stone !== EMPTY) {
      if (dead.has(point)) {
        marks.push({ kind: 'dead', square })
        marks.push({ kind: 'territory', square, side: sideOf(stone === BLACK ? WHITE : BLACK) })
      }
      return
    }
    if (value >= MARK) marks.push({ kind: 'territory', square, side: sideOf(BLACK) })
    else if (value <= -MARK) marks.push({ kind: 'territory', square, side: sideOf(WHITE) })
  })
  const white = total - black
  const margin = black - white - position.komi
  const round = (n: number) => Math.round(n * 2) / 2
  const counts = `Tahmini alan: Siyah ${formatPoints(round(black))}, Beyaz ${formatPoints(round(white))} + ${formatPoints(position.komi)} komi.`
  const text =
    Math.abs(margin) < 1
      ? `${counts} Oyun başa baş.`
      : `${counts} ${margin > 0 ? 'Siyah' : 'Beyaz'} yaklaşık ${formatPoints(round(Math.abs(margin)))} önde.`
  return { marks, black, white, margin, text }
}
