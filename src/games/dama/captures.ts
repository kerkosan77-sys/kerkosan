import type { CaptureInfo, Side } from '../../core/types'

/** Each side starts with 16 men. */
const START = 16

/**
 * Pieces each side has taken (16 minus what the other side still has on the board) and who has
 * more pieces left. Position text: "w <8 rows with . w W b B> <quiet>".
 */
export function damaCaptures(position: string): Record<Side, CaptureInfo> {
  const rows = position.split(' ')[1] ?? ''
  const left: Record<Side, number> = { w: 0, b: 0 }
  for (const ch of rows) {
    if (ch === 'w' || ch === 'W') left.w++
    else if (ch === 'b' || ch === 'B') left.b++
  }
  const info = (side: Side): CaptureInfo => {
    const other: Side = side === 'w' ? 'b' : 'w'
    const taken = Math.max(0, START - left[other])
    return {
      pieces: taken > 0 ? [{ glyph: '●', name: 'taş', count: taken }] : [],
      color: other,
      lead: Math.max(0, left[side] - left[other]),
      compact: true,
    }
  }
  return { w: info('w'), b: info('b') }
}
