import type { CaptureInfo, MoveRecord, Side } from '../../core/types'

/** How many times `stone` appears on the board part of a position ("x ..x./.o.. - 0 7.5"). */
function stonesOf(position: string, stone: string): number {
  const rows = position.split(' ')[1] ?? ''
  let n = 0
  for (let i = 0; i < rows.length; i++) if (rows[i] === stone) n++
  return n
}

/**
 * Stones each player has taken: every move counts the other colour's stones that left the board.
 * Black (x) moves first, so black is side 'w' and takes white (o) stones.
 */
export function goCaptures(history: Pick<MoveRecord, 'side' | 'before' | 'after'>[]): Record<Side, CaptureInfo> {
  const taken: Record<Side, number> = { w: 0, b: 0 }
  for (const move of history) {
    const victim = move.side === 'w' ? 'o' : 'x'
    taken[move.side] += Math.max(0, stonesOf(move.before, victim) - stonesOf(move.after, victim))
  }
  const info = (side: Side): CaptureInfo => ({
    pieces: taken[side] > 0 ? [{ glyph: '●', name: 'taş', count: taken[side] }] : [],
    // The colour of the taken stones: black (side 'w') takes white ones.
    color: side === 'w' ? 'w' : 'b',
    lead: 0,
    compact: true,
  })
  return { w: info('w'), b: info('b') }
}
