import { useMemo, useState } from 'react'
import type { BoardMark, BoardProps } from '../../core/types'
import { BLACK, EMPTY, WHITE } from './fastboard'
import { COLUMNS, PASS_MOVE, colorOf, decode, indexOf, initialPosition, legalPoints, type GoPosition } from './rules'

const CELL = 40
const MARGIN = 34

const STAR_POINTS: Record<number, [number, number][]> = {
  9: [
    [2, 2],
    [6, 2],
    [4, 4],
    [2, 6],
    [6, 6],
  ],
  13: [
    [3, 3],
    [9, 3],
    [6, 6],
    [3, 9],
    [9, 9],
  ],
  19: [3, 9, 15].flatMap((y) => [3, 9, 15].map((x) => [x, y] as [number, number])),
}

function safeDecode(position: string): GoPosition {
  try {
    return decode(position)
  } catch {
    return initialPosition()
  }
}

const RING_COLORS: Partial<Record<BoardMark['kind'], string>> = {
  played: '#d03a2c',
  best: '#2ea043',
  threat: '#e67e22',
  danger: '#d03a2c',
}

/** Go board drawn as SVG. Move codes are points like "D4"; the board is never flipped. */
export default function GoBoard({ position, interactive, onMove, onMark, lastMove, marks = [], id }: BoardProps) {
  const pos = useMemo(() => safeDecode(position), [position])
  const { size, board } = pos
  const [hover, setHover] = useState<number | null>(null)
  const legal = useMemo(() => (interactive ? new Set(legalPoints(pos)) : new Set<number>()), [interactive, pos])
  const extent = MARGIN * 2 + (size - 1) * CELL
  const at = (i: number) => {
    const x = i % size
    const y = (i - x) / size
    return { cx: MARGIN + x * CELL, cy: MARGIN + y * CELL }
  }

  const point = (mark: BoardMark) => {
    const code = mark.move ?? mark.square
    return code && code !== PASS_MOVE ? indexOf(code, size) : null
  }

  const dead = new Set<number>()
  const territory: { index: number; color: number }[] = []
  const rings: { index: number; color: string; dashed: boolean }[] = []
  const hints: number[] = []
  for (const mark of marks) {
    const index = point(mark)
    if (index === null) continue
    if (mark.kind === 'dead') dead.add(index)
    else if (mark.kind === 'territory') territory.push({ index, color: colorOf(mark.side ?? 'w') })
    else if (mark.kind === 'hint') hints.push(index)
    else {
      const color = RING_COLORS[mark.kind]
      if (color) rings.push({ index, color, dashed: mark.kind === 'danger' || mark.kind === 'threat' })
    }
  }

  const last = lastMove && lastMove !== PASS_MOVE ? indexOf(lastMove, size) : null
  const myColor = colorOf(pos.turn)
  const clickable = (i: number) => (onMark ? board[i] !== EMPTY : interactive && legal.has(i))

  const handleClick = (i: number) => {
    const code = `${COLUMNS[i % size]}${size - Math.floor(i / size)}`
    if (onMark) {
      if (board[i] !== EMPTY) onMark(code)
    } else if (interactive && legal.has(i)) {
      onMove?.(code)
    }
  }

  const stars = STAR_POINTS[size] ?? []
  const lines = Array.from({ length: size }, (_, k) => MARGIN + k * CELL)

  return (
    <div className={`go-board${interactive ? ' my-turn' : ''}${onMark ? ' marking' : ''}`} id={id}>
      <svg viewBox={`0 0 ${extent} ${extent}`} role="img" aria-label="Go tahtası" onMouseLeave={() => setHover(null)}>
        <defs>
          <radialGradient id="go-black" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#666" />
            <stop offset="100%" stopColor="#111" />
          </radialGradient>
          <radialGradient id="go-white" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cfcabf" />
          </radialGradient>
        </defs>
        <rect className="go-wood" x={0} y={0} width={extent} height={extent} rx={10} />
        {hints.map((i) => {
          const { cx, cy } = at(i)
          return <rect key={`h${i}`} className="go-hint" x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL} />
        })}
        {lines.map((v, k) => (
          <g key={k} className="go-line">
            <line x1={MARGIN} y1={v} x2={extent - MARGIN} y2={v} />
            <line x1={v} y1={MARGIN} x2={v} y2={extent - MARGIN} />
          </g>
        ))}
        {stars.map(([x, y]) => (
          <circle key={`s${x}-${y}`} className="go-star" cx={MARGIN + x * CELL} cy={MARGIN + y * CELL} r={3.5} />
        ))}
        {lines.map((v, k) => (
          <g key={`c${k}`} className="go-coord">
            <text x={v} y={extent - 9}>
              {COLUMNS[k]}
            </text>
            <text x={12} y={v + 4}>
              {size - k}
            </text>
          </g>
        ))}

        {territory.map(({ index, color }) => {
          const { cx, cy } = at(index)
          const s = CELL * 0.32
          return (
            <rect
              key={`t${index}`}
              className={`go-area ${color === BLACK ? 'black' : 'white'}`}
              x={cx - s / 2}
              y={cy - s / 2}
              width={s}
              height={s}
            />
          )
        })}

        {Array.from(board, (stone, i) => {
          if (stone === EMPTY) return null
          const { cx, cy } = at(i)
          const isDead = dead.has(i)
          return (
            <g key={`${i}-${stone}`} className={`go-stone${i === last ? ' last' : ''}${isDead ? ' dead' : ''}`}>
              <circle cx={cx} cy={cy} r={CELL * 0.47} fill={stone === BLACK ? 'url(#go-black)' : 'url(#go-white)'} className={stone === WHITE ? 'white' : 'black'} />
              {i === last && !isDead && <circle cx={cx} cy={cy} r={CELL * 0.16} className={`go-last ${stone === BLACK ? 'on-black' : 'on-white'}`} />}
              {isDead && (
                <path
                  className={`go-dead-x ${stone === BLACK ? 'on-black' : 'on-white'}`}
                  d={`M${cx - 7} ${cy - 7} L${cx + 7} ${cy + 7} M${cx + 7} ${cy - 7} L${cx - 7} ${cy + 7}`}
                />
              )}
            </g>
          )
        })}

        {rings.map(({ index, color, dashed }, k) => {
          const { cx, cy } = at(index)
          return (
            <circle
              key={`r${k}`}
              cx={cx}
              cy={cy}
              r={board[index] === EMPTY ? CELL * 0.3 : CELL * 0.52}
              fill={board[index] === EMPTY ? color : 'none'}
              fillOpacity={board[index] === EMPTY ? 0.35 : 0}
              stroke={color}
              strokeWidth={4}
              strokeDasharray={dashed ? '6 4' : undefined}
              className="go-ring"
            />
          )
        })}

        {hover !== null && !onMark && interactive && legal.has(hover) && (
          <circle
            cx={at(hover).cx}
            cy={at(hover).cy}
            r={CELL * 0.47}
            className={`go-ghost ${myColor === BLACK ? 'black' : 'white'}`}
            pointerEvents="none"
          />
        )}

        {Array.from({ length: size * size }, (_, i) => {
          if (!clickable(i)) return null
          const { cx, cy } = at(i)
          return (
            <rect
              key={`p${i}`}
              className="go-hit"
              x={cx - CELL / 2}
              y={cy - CELL / 2}
              width={CELL}
              height={CELL}
              onMouseEnter={() => setHover(i)}
              onClick={() => handleClick(i)}
            />
          )
        })}
      </svg>
    </div>
  )
}
