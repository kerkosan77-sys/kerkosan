import { useMemo, useState } from 'react'
import type { BoardMark, BoardProps } from '../../core/types'
import { BLACK, SIZE, colOf, decode, flipsFor, colorOf, initialPosition, legalMoves, rowOf, squareIndex, squareName, type ReversiPosition } from './rules'

const CELL = 50
const LEFT = 24
const TOP = 24
const RIGHT = 6
const BOTTOM = 6
const WIDTH = LEFT + SIZE * CELL + RIGHT
const HEIGHT = TOP + SIZE * CELL + BOTTOM

const RING_COLORS: Partial<Record<BoardMark['kind'], string>> = {
  played: '#d03a2c',
  best: '#2ea043',
  threat: '#e67e22',
  danger: '#d03a2c',
}

function safeDecode(position: string): ReversiPosition {
  try {
    return decode(position)
  } catch {
    return initialPosition()
  }
}

/** Reversi board drawn as SVG; playable squares show a small dot on the user's turn. Never flipped. */
export default function ReversiBoard({ position, interactive, onMove, lastMove, marks = [], id }: BoardProps) {
  const pos = useMemo(() => safeDecode(position), [position])
  const legal = useMemo(() => (interactive ? new Set(legalMoves(pos).map((m) => m.square)) : new Set<number>()), [interactive, pos])
  const [hover, setHover] = useState<number | null>(null)
  const at = (i: number) => ({ x: LEFT + colOf(i) * CELL, y: TOP + rowOf(i) * CELL, cx: LEFT + colOf(i) * CELL + CELL / 2, cy: TOP + rowOf(i) * CELL + CELL / 2 })

  const last = lastMove ? squareIndex(lastMove) : null
  const hints = new Set<number>()
  const rings: { index: number; color: string; dashed: boolean }[] = []
  for (const mark of marks) {
    const code = mark.move ?? mark.square
    const index = code ? squareIndex(code) : null
    if (index === null) continue
    if (mark.kind === 'hint') hints.add(index)
    else if (RING_COLORS[mark.kind]) rings.push({ index, color: RING_COLORS[mark.kind]!, dashed: mark.kind === 'threat' || mark.kind === 'danger' })
  }
  // Discs a move on the hovered square would turn over.
  const preview = hover !== null && legal.has(hover) ? new Set(flipsFor(pos.board, hover, colorOf(pos.turn))) : new Set<number>()

  return (
    <div className={`reversi-board${interactive ? ' my-turn' : ''}`} id={id}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Reversi tahtası" onMouseLeave={() => setHover(null)}>
        <defs>
          <radialGradient id="reversi-black" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#5a5a5a" />
            <stop offset="100%" stopColor="#0d0d0d" />
          </radialGradient>
          <radialGradient id="reversi-white" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d4d0c6" />
          </radialGradient>
        </defs>
        <rect className="reversi-frame" x={0} y={0} width={WIDTH} height={HEIGHT} rx={10} />
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const { x, y } = at(i)
          const classes = ['reversi-square']
          if (hints.has(i)) classes.push('hint')
          return <rect key={i} className={classes.join(' ')} x={x} y={y} width={CELL} height={CELL} />
        })}
        {[
          [2, 2],
          [2, 6],
          [6, 2],
          [6, 6],
        ].map(([r, c]) => (
          <circle key={`dot${r}${c}`} className="reversi-star" cx={LEFT + c * CELL} cy={TOP + r * CELL} r={3.5} />
        ))}
        {Array.from({ length: SIZE }, (_, k) => (
          <g key={`coord${k}`} className="reversi-coord">
            <text x={LEFT + k * CELL + CELL / 2} y={16}>
              {'abcdefgh'[k]}
            </text>
            <text x={12} y={TOP + k * CELL + CELL / 2 + 4}>
              {k + 1}
            </text>
          </g>
        ))}

        {Array.from(pos.board, (disc, i) => {
          if (disc === 0) return null
          const { cx, cy } = at(i)
          const black = disc === BLACK
          return (
            <g key={`d${i}-${disc}`} className={`reversi-disc${preview.has(i) ? ' flipping' : ''}`}>
              <circle cx={cx} cy={cy + 2} r={20} className="reversi-shadow" />
              <circle cx={cx} cy={cy} r={20} fill={`url(#reversi-${black ? 'black' : 'white'})`} className={black ? 'black' : 'white'} />
            </g>
          )
        })}
        {last !== null && pos.board[last] !== 0 && <circle cx={at(last).cx} cy={at(last).cy} r={5} className={`reversi-last ${pos.board[last] === BLACK ? 'on-black' : 'on-white'}`} />}
        {[...legal].map((s) => {
          const { cx, cy } = at(s)
          return <circle key={`m${s}`} cx={cx} cy={cy} r={6} className="reversi-move" />
        })}
        {hover !== null && legal.has(hover) && (
          <circle cx={at(hover).cx} cy={at(hover).cy} r={20} className={`reversi-ghost ${pos.turn === 'w' ? 'black' : 'white'}`} />
        )}
        {rings.map(({ index, color, dashed }, k) => {
          const { cx, cy } = at(index)
          return <circle key={`r${k}`} cx={cx} cy={cy} r={23} fill="none" stroke={color} strokeWidth={3.5} strokeDasharray={dashed ? '6 4' : undefined} />
        })}

        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const { x, y } = at(i)
          return (
            <rect
              key={`hit${i}`}
              className={`reversi-hit${legal.has(i) ? ' clickable' : ''}`}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              onMouseEnter={() => setHover(i)}
              onClick={() => legal.has(i) && onMove?.(squareName(i))}
            >
              <title>{squareName(i)}</title>
            </rect>
          )
        })}
      </svg>
    </div>
  )
}
