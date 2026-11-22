import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { BoardMark, BoardProps, Side } from '../../core/types'
import { STORE, applyMove, decode, encode, initialPosition, pitIndices, pitNumber, sideOf, type Position } from './rules'

const MARK_CLASS: Partial<Record<BoardMark['kind'], string>> = {
  played: 'mark-played',
  best: 'mark-best',
  threat: 'mark-threat',
  danger: 'mark-danger',
  hint: 'mark-hint',
}

const STONE_COLORS = ['#e8d9b5', '#7fb3d5', '#e59866', '#a9cce3', '#f7dc6f', '#c39bd3', '#82e0aa', '#f1948a']

/** Fixed spots inside a pit (percent of its size) so stones do not jump around between renders. */
const PIT_SPOTS = [
  [50, 50], [35, 40], [64, 40], [40, 64], [62, 63], [50, 28], [27, 55], [73, 55], [50, 74], [32, 26],
  [69, 27], [22, 39], [78, 41], [29, 72], [71, 73], [50, 41], [41, 52], [59, 52], [50, 60], [50, 15],
]
const STORE_SPOTS = Array.from({ length: 36 }, (_, i) => [28 + ((i * 37) % 45), 12 + ((i * 53) % 76)])

const other = (side: Side): Side => (side === 'w' ? 'b' : 'w')

function safeDecode(position: string): Position {
  try {
    return decode(position)
  } catch {
    return initialPosition()
  }
}

/** Frames for animating `move` from `before` (null if it does not lead to `after`). */
function sowingFrames(before: string, move: string, after: string): { pits: number[]; at: number }[] | null {
  try {
    const start = decode(before)
    const result = applyMove(start, Number(move))
    if (!result || encode(result.position) !== after) return null
    const pits = start.pits.slice()
    const origin = Number(move)
    pits[origin] = 0
    const frames = [{ pits: pits.slice(), at: origin }]
    for (const index of result.path) {
      pits[index]++
      frames.push({ pits: pits.slice(), at: index })
    }
    return frames
  } catch {
    return null
  }
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function Stones({ count, spots, offset }: { count: number; spots: number[][]; offset: number }) {
  const visible = Math.min(count, spots.length)
  return (
    <>
      {Array.from({ length: visible }, (_, i) => (
        <span
          key={i}
          className="m-stone"
          style={
            {
              left: `${spots[i][0]}%`,
              top: `${spots[i][1]}%`,
              '--stone': STONE_COLORS[(i + offset) % STONE_COLORS.length],
            } as CSSProperties
          }
        />
      ))}
    </>
  )
}

/** Mangala board. Move codes are absolute pit indices ("0"-"5" first player, "7"-"12" second player). */
export default function MangalaBoard({ position, perspective, interactive, onMove, lastMove, marks = [], id }: BoardProps) {
  const target = useMemo(() => safeDecode(position), [position])
  const [shown, setShown] = useState(target.pits)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const previous = useRef(position)

  useEffect(() => {
    const before = previous.current
    previous.current = position
    const frames = before !== position && lastMove ? sowingFrames(before, lastMove, position) : null
    if (!frames || reducedMotion()) {
      setShown(target.pits)
      setDropAt(null)
      setAnimating(false)
      return
    }
    const step = Math.min(170, Math.max(60, 1500 / frames.length))
    const timers: number[] = []
    setAnimating(true)
    frames.forEach((frame, k) =>
      timers.push(
        window.setTimeout(() => {
          setShown(frame.pits)
          setDropAt(frame.at)
        }, k * step),
      ),
    )
    // Captures and the end-of-game sweep appear after the last stone lands.
    timers.push(
      window.setTimeout(() => {
        setShown(target.pits)
        setDropAt(null)
        setAnimating(false)
      }, frames.length * step + 220),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [position, lastMove, target])

  const me = perspective
  const opp = other(me)
  const bottom = pitIndices(me)
  const top = pitIndices(opp).slice().reverse()

  const classes = new Map<number, string[]>()
  const addClass = (index: number, name: string) => classes.set(index, [...(classes.get(index) ?? []), name])
  for (const mark of marks) {
    const value = mark.move ?? mark.square
    const name = MARK_CLASS[mark.kind]
    if (name && value !== undefined && /^\d+$/.test(value)) addClass(Number(value), name)
  }
  if (lastMove && /^\d+$/.test(lastMove)) addClass(Number(lastMove), 'last')
  if (dropAt !== null) addClass(dropAt, 'drop')

  const canClick = (index: number) =>
    interactive && !animating && target.turn === me && sideOf(index) === me && shown[index] > 0

  const pit = (index: number, row: 'top' | 'bottom') => {
    const clickable = canClick(index)
    return (
      <button
        key={index}
        type="button"
        className={`m-pit ${row}${clickable ? ' clickable' : ''} ${(classes.get(index) ?? []).join(' ')}`}
        disabled={!clickable}
        onClick={() => clickable && onMove?.(String(index))}
        aria-label={`${row === 'bottom' ? 'Senin' : 'Rakibin'} ${pitNumber(index)}. kuyusu, ${shown[index]} taş`}
      >
        <Stones count={shown[index]} spots={PIT_SPOTS} offset={index} />
        <span className="m-count">{shown[index]}</span>
        <span className="m-num">{pitNumber(index)}</span>
      </button>
    )
  }

  const store = (side: Side, place: 'left' | 'right') => {
    const index = STORE[side]
    return (
      <div
        className={`m-store ${place} ${(classes.get(index) ?? []).join(' ')}`}
        aria-label={`${side === me ? 'Senin' : 'Rakibin'} hazinen: ${shown[index]} taş`}
      >
        <Stones count={shown[index]} spots={STORE_SPOTS} offset={index} />
        <span className="m-store-count">{shown[index]}</span>
        <span className="m-store-label">{side === me ? 'Senin' : 'Rakip'}</span>
      </div>
    )
  }

  return (
    <div className={`mangala-board${target.turn === me ? ' my-turn' : ''}`} id={id}>
      {store(opp, 'left')}
      {top.map((index) => pit(index, 'top'))}
      {bottom.map((index) => pit(index, 'bottom'))}
      {store(me, 'right')}
    </div>
  )
}
