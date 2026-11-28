import type { CaptureInfo, Side } from '../../../core/types'

type Kind = 'p' | 'n' | 'b' | 'r' | 'q'

const KINDS: Kind[] = ['p', 'n', 'b', 'r', 'q']
const START: Record<Kind, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
const VALUE: Record<Kind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const NAME: Record<Kind, string> = { p: 'piyon', n: 'at', b: 'fil', r: 'kale', q: 'vezir' }
/** The filled chess symbols, coloured by the page; U+FE0E keeps phones from drawing the pawn as an emoji. */
const GLYPH: Record<Kind, string> = { p: '♟︎', n: '♞︎', b: '♝︎', r: '♜︎', q: '♛︎' }

type Counts = Record<Kind, number>

function countPieces(fen: string): Record<Side, Counts> {
  const counts: Record<Side, Counts> = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } }
  for (const ch of fen.split(' ')[0] ?? '') {
    const kind = ch.toLowerCase() as Kind
    if (kind in START) counts[ch === kind ? 'b' : 'w'][kind]++
  }
  return counts
}

/** The pieces a side has lost. A promoted piece came from a pawn, so that pawn was not taken. */
function lost(counts: Counts): Counts {
  let promoted = 0
  for (const kind of KINDS) if (kind !== 'p') promoted += Math.max(0, counts[kind] - START[kind])
  const missing = { p: Math.max(0, START.p - counts.p - promoted) } as Counts
  for (const kind of KINDS) if (kind !== 'p') missing[kind] = Math.max(0, START[kind] - counts[kind])
  return missing
}

const material = (counts: Counts) => KINDS.reduce((sum, kind) => sum + counts[kind] * VALUE[kind], 0)

/**
 * The pieces each side has taken (the other side's missing pieces) and who is ahead in material,
 * counting a pawn 1, a knight or bishop 3, a rook 5 and a queen 9, as players usually do.
 */
export function chessCaptures(fen: string): Record<Side, CaptureInfo> {
  const counts = countPieces(fen)
  const diff = material(counts.w) - material(counts.b)
  const takenBy = (side: Side): CaptureInfo => {
    const missing = lost(counts[side === 'w' ? 'b' : 'w'])
    return {
      pieces: KINDS.filter((kind) => missing[kind] > 0).map((kind) => ({ glyph: GLYPH[kind], name: NAME[kind], count: missing[kind] })),
      color: side === 'w' ? 'b' : 'w',
      lead: Math.max(0, side === 'w' ? diff : -diff),
    }
  }
  return { w: takenBy('w'), b: takenBy('b') }
}
