import type { CSSProperties } from 'react'
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
  const turn = (position.split(' ')[1] === 'b' ? 'b' : 'w') as Side

  return (
    <ChessBoard
      id={id}
      fen={position}
      orientation={perspective === 'w' ? 'white' : 'black'}
      movableColor={interactive ? turn : null}
      onMove={(move) => onMove?.(`${move.from}${move.to}${move.promotion ?? ''}`) ?? false}
      lastMove={lastMove ? squaresOf(lastMove) : null}
      arrows={arrows}
      squareStyles={squareStyles}
    />
  )
}
