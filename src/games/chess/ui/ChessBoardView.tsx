import { useCallback, useMemo, useRef, type CSSProperties } from 'react'
import type { Arrow } from 'react-chessboard'
import type { BoardMark, BoardProps, Side } from '../../../core/types'
import ChessBoard from './ChessBoard'

const ARROW_COLORS: Partial<Record<BoardMark['kind'], string>> = {
  played: 'rgba(208, 58, 44, 0.85)',
  threat: 'rgba(208, 58, 44, 0.85)',
  best: 'rgba(46, 160, 67, 0.9)',
}

const SQUARE_STYLES: Partial<Record<BoardMark['kind'], CSSProperties>> = {
  danger: { boxShadow: 'inset 0 0 0 4px rgba(208, 58, 44, 0.95)', backgroundColor: 'rgba(208, 58, 44, 0.25)' },
  hint: { boxShadow: 'inset 0 0 0 4px rgba(46, 160, 67, 0.95)' },
}

const squaresOf = (uci: string) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) })

/** The chess board behind the shared board interface (move codes are UCI). */
export default function ChessBoardView({ position, perspective, interactive, onMove, lastMove, marks = [], id }: BoardProps) {
  // Props that stay the same from one redraw to the next, so the board itself is not drawn again.
  const marksKey = JSON.stringify(marks)
  const { arrows, squareStyles } = useMemo(() => {
    const arrows: Arrow[] = []
    const squareStyles: Record<string, CSSProperties> = {}
    for (const mark of marks) {
      const color = ARROW_COLORS[mark.kind]
      if (mark.move && color) {
        const { from, to } = squaresOf(mark.move)
        arrows.push({ startSquare: from, endSquare: to, color })
      }
      const style = SQUARE_STYLES[mark.kind]
      if (mark.square && style) squareStyles[mark.square] = { ...squareStyles[mark.square], ...style }
    }
    return { arrows, squareStyles }
    // marksKey stands for the marks' content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marksKey])
  const last = useMemo(() => (lastMove ? squaresOf(lastMove) : null), [lastMove])
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  const handleMove = useCallback(
    (move: { from: string; to: string; promotion?: string }) => onMoveRef.current?.(`${move.from}${move.to}${move.promotion ?? ''}`) ?? false,
    [],
  )
  const turn = (position.split(' ')[1] === 'b' ? 'b' : 'w') as Side

  return (
    <ChessBoard
      id={id}
      fen={position}
      orientation={perspective === 'w' ? 'white' : 'black'}
      movableColor={interactive ? turn : null}
      onMove={handleMove}
      lastMove={last}
      arrows={arrows}
      squareStyles={squareStyles}
    />
  )
}
