import type { Side } from '../core/types'

interface EvalBarProps {
  /** The user's winning chances (0-100), or null while not known yet. */
  win: number | null
  /** Colour of the user's pieces (bottom part of the bar) and of the opponent's (top part). */
  userColor: Side
}

/**
 * Vertical "who is better" bar next to the board, like Chess.com's: the user's share grows from the
 * bottom. Shows winning chances rather than engine points, which mean little to a beginner.
 */
export default function EvalBar({ win, userColor }: EvalBarProps) {
  const known = win !== null
  const value = known ? Math.max(0, Math.min(100, win)) : 50
  // Keep a sliver of each colour visible so the bar never looks empty.
  const height = Math.max(3, Math.min(97, value))
  const ahead = value >= 50
  const label = known ? `%${Math.round(value)}` : '…'
  return (
    <div
      className={`eval-bar user-${userColor === 'w' ? 'light' : 'dark'}${known ? '' : ' unknown'}`}
      role="meter"
      aria-label="Kazanma şansın"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(value) : undefined}
      title={known ? `Kazanma şansın: ${label}` : 'Hesaplanıyor…'}
    >
      <div className="eval-fill" style={{ height: `${height}%` }} />
      <span className={`eval-label ${ahead ? 'bottom' : 'top'}`}>{label}</span>
    </div>
  )
}
