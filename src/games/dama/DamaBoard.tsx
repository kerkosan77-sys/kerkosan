import { useEffect, useMemo, useState } from 'react'
import type { BoardMark, BoardProps } from '../../core/types'
import { KING, SIZE, colOf, decode, initialPosition, legalMoves, moveCode, rowOf, squareIndex, type DamaMove, type DamaPosition } from './rules'

const CELL = 50
const LEFT = 24
const TOP = 6
const BOTTOM = 24
const RIGHT = 6
const WIDTH = LEFT + SIZE * CELL + RIGHT
const HEIGHT = TOP + SIZE * CELL + BOTTOM

const ARROW_COLORS: Partial<Record<BoardMark['kind'], string>> = { played: '#d03a2c', best: '#2ea043' }
const RING_COLORS: Partial<Record<BoardMark['kind'], string>> = { threat: '#e67e22', danger: '#d03a2c' }

function safeDecode(position: string): DamaPosition {
  try {
    return decode(position)
  } catch {
    return initialPosition()
  }
}

/** Squares of a move code ("c3-c4", "c3xc5xe5"). */
function squaresOf(code: string | null | undefined): number[] {
  if (!code) return []
  return code
    .split(/[-x]/)
    .map((s) => squareIndex(s))
    .filter((s): s is number => s !== null)
}

function Crown({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      className="dama-crown"
      transform={`translate(${cx} ${cy})`}
      d="M -11 6 L -11 -5 L -5.5 0 L 0 -9 L 5.5 0 L 11 -5 L 11 6 Z"
    />
  )
}

/** Dama board drawn as SVG. Tap a piece, then where it should go (or each stop of a capture in turn). */
export default function DamaBoard({ position, perspective, interactive, onMove, lastMove, marks = [], id }: BoardProps) {
  const pos = useMemo(() => safeDecode(position), [position])
  const moves = useMemo(() => (interactive ? legalMoves(pos) : []), [interactive, pos])
  const [selected, setSelected] = useState<number | null>(null)
  const [prefix, setPrefix] = useState<number[]>([])
  const [ambiguous, setAmbiguous] = useState(false)

  useEffect(() => {
    setSelected(null)
    setPrefix([])
    setAmbiguous(false)
  }, [position, interactive])

  const flip = perspective === 'b'
  const at = (i: number) => {
    const r = flip ? SIZE - 1 - rowOf(i) : rowOf(i)
    const c = flip ? SIZE - 1 - colOf(i) : colOf(i)
    return { x: LEFT + c * CELL, y: TOP + r * CELL, cx: LEFT + c * CELL + CELL / 2, cy: TOP + r * CELL + CELL / 2 }
  }

  const movable = new Set(moves.map((m) => m.from))
  const mustCapture = moves.length > 0 && moves[0].captured.length > 0
  const candidates: DamaMove[] =
    selected === null ? [] : moves.filter((m) => m.from === selected && prefix.every((s, k) => m.path[k] === s))
  const finals = new Set(candidates.map((m) => m.path[m.path.length - 1]))
  const stops = new Set(candidates.filter((m) => m.path.length > prefix.length + 1).map((m) => m.path[prefix.length]))

  function clear() {
    setSelected(null)
    setPrefix([])
    setAmbiguous(false)
  }

  function play(move: DamaMove) {
    clear()
    onMove?.(moveCode(move))
  }

  function handleClick(square: number) {
    if (!interactive) return
    if (selected !== null) {
      const ending = candidates.filter((m) => m.path.length > prefix.length && m.path[m.path.length - 1] === square)
      if (ending.length === 1) return play(ending[0])
      const next = candidates.filter((m) => m.path[prefix.length] === square)
      if (next.length > 0) {
        const nextPrefix = [...prefix, square]
        const done = next.filter((m) => m.path.length === nextPrefix.length)
        if (next.length === 1 && done.length === 1) return play(done[0])
        setPrefix(nextPrefix)
        setAmbiguous(false)
        return
      }
      if (ending.length > 1) {
        setAmbiguous(true)
        return
      }
    }
    if (movable.has(square)) {
      setSelected(square === selected ? null : square)
      setPrefix([])
      setAmbiguous(false)
      return
    }
    clear()
  }

  const last = new Set(squaresOf(lastMove))
  const hints = new Set<number>()
  const rings: { index: number; color: string }[] = []
  const arrows: { points: number[]; color: string; kind: string }[] = []
  for (const mark of marks) {
    if (mark.move) {
      const color = ARROW_COLORS[mark.kind]
      const points = squaresOf(mark.move)
      if (color && points.length > 1) arrows.push({ points, color, kind: mark.kind })
      continue
    }
    const index = mark.square ? squareIndex(mark.square) : null
    if (index === null) continue
    if (mark.kind === 'hint') hints.add(index)
    else if (RING_COLORS[mark.kind]) rings.push({ index, color: RING_COLORS[mark.kind]! })
  }

  const files = Array.from({ length: SIZE }, (_, c) => 'abcdefgh'[flip ? SIZE - 1 - c : c])
  const ranks = Array.from({ length: SIZE }, (_, r) => (flip ? r + 1 : SIZE - r))

  return (
    <div className={`dama-board${interactive ? ' my-turn' : ''}`} id={id}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Dama tahtası">
        <defs>
          <radialGradient id="dama-white" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d9d2c3" />
          </radialGradient>
          <radialGradient id="dama-black" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#6b6b6b" />
            <stop offset="100%" stopColor="#151515" />
          </radialGradient>
          {Object.entries(ARROW_COLORS).map(([kind, color]) => (
            <marker key={kind} id={`dama-arrow-${kind}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
        </defs>
        <rect className="dama-frame" x={0} y={0} width={WIDTH} height={HEIGHT} rx={10} />
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const { x, y } = at(i)
          const dark = (rowOf(i) + colOf(i)) % 2 === 1
          const classes = ['dama-square', dark ? 'dark' : 'light']
          if (last.has(i)) classes.push('last')
          if (hints.has(i)) classes.push('hint')
          return <rect key={i} className={classes.join(' ')} x={x} y={y} width={CELL} height={CELL} />
        })}
        {files.map((f, c) => (
          <text key={`f${f}`} className="dama-coord" x={LEFT + c * CELL + CELL / 2} y={HEIGHT - 7}>
            {f}
          </text>
        ))}
        {ranks.map((r, k) => (
          <text key={`r${r}`} className="dama-coord" x={12} y={TOP + k * CELL + CELL / 2 + 4}>
            {r}
          </text>
        ))}

        {Array.from(pos.board, (piece, i) => {
          if (piece === 0) return null
          const { cx, cy } = at(i)
          const white = piece > 0
          const isSelected = selected === i
          const mustMove = mustCapture && movable.has(i) && selected === null
          return (
            <g key={`p${i}`} className={`dama-piece${isSelected ? ' selected' : ''}${mustMove ? ' must' : ''}`}>
              <circle cx={cx} cy={cy + 2} r={19} className="dama-shadow" />
              <circle cx={cx} cy={cy} r={19} fill={`url(#dama-${white ? 'white' : 'black'})`} className={white ? 'white' : 'black'} />
              <circle cx={cx} cy={cy} r={13} className={`dama-inner ${white ? 'white' : 'black'}`} />
              {Math.abs(piece) === KING && <Crown cx={cx} cy={cy} />}
            </g>
          )
        })}

        {rings.map(({ index, color }, k) => {
          const { cx, cy } = at(index)
          return <circle key={`ring${k}`} cx={cx} cy={cy} r={23} fill="none" stroke={color} strokeWidth={3.5} strokeDasharray="6 4" />
        })}
        {arrows.map(({ points, color, kind }, k) => (
          <polyline
            key={`arrow${k}`}
            points={points.map((p) => `${at(p).cx},${at(p).cy}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={7}
            strokeOpacity={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#dama-arrow-${kind})`}
          />
        ))}
        {[...stops].map((s) => {
          const { cx, cy } = at(s)
          return <circle key={`stop${s}`} cx={cx} cy={cy} r={10} className="dama-stop" />
        })}
        {[...finals].map((s) => {
          const { cx, cy } = at(s)
          return <circle key={`final${s}`} cx={cx} cy={cy} r={9} className="dama-target" />
        })}

        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const { x, y } = at(i)
          const clickable = interactive && (movable.has(i) || finals.has(i) || stops.has(i))
          return (
            <rect
              key={`hit${i}`}
              className={`dama-hit${clickable ? ' clickable' : ''}`}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              onClick={() => handleClick(i)}
            />
          )
        })}
      </svg>
      {ambiguous && <p className="board-note">Bu kareye birden fazla yoldan gidilebiliyor: önce ara durağa dokun.</p>}
    </div>
  )
}
