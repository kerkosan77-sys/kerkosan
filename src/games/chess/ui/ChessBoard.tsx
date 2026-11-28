import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, type Arrow, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'
import type { Side as Color } from '../../../core/types'

export interface BoardMove {
  from: string
  to: string
  promotion?: string
}

interface BoardProps {
  fen: string
  orientation: 'white' | 'black'
  /** Which color the user may move right now. null = board is read-only. */
  movableColor?: Color | null
  onMove?: (move: BoardMove) => boolean
  lastMove?: { from: string; to: string } | null
  arrows?: Arrow[]
  squareStyles?: Record<string, CSSProperties>
  id?: string
}

const LAST_MOVE_COLOR = 'rgba(255, 214, 10, 0.42)'
const SELECTED_COLOR = 'rgba(255, 214, 10, 0.7)'
const DOT = 'radial-gradient(circle, rgba(20, 30, 20, 0.28) 22%, transparent 24%)'
const RING = 'radial-gradient(circle, transparent 72%, rgba(20, 30, 20, 0.3) 74%)'
const CHECK = 'radial-gradient(circle, rgba(230, 40, 40, 0.95) 0%, rgba(230, 40, 40, 0.55) 45%, transparent 75%)'

/**
 * A drag starts only after the finger or mouse moves this far. The library starts at 1 pixel, and a
 * finger almost always moves a little while tapping, so on phones a tap often became a tiny drag and
 * the piece was not selected.
 */
const DRAG_START_PX =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 12 : 5

const PROMOTION_PIECES = [
  { piece: 'q', name: 'Vezir', w: '♕', b: '♛' },
  { piece: 'r', name: 'Kale', w: '♖', b: '♜' },
  { piece: 'b', name: 'Fil', w: '♗', b: '♝' },
  { piece: 'n', name: 'At', w: '♘', b: '♞' },
] as const

function findKing(chess: Chess, color: Color): string | null {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === color) return cell.square
    }
  }
  return null
}

/** Drawn again only when one of its props changes (the play screen redraws often while the coach works). */
export default memo(Board)

function Board({
  fen,
  orientation,
  movableColor = null,
  onMove,
  lastMove,
  arrows,
  squareStyles,
  id = 'board',
}: BoardProps) {
  const chess = useMemo(() => new Chess(fen), [fen])
  const [selected, setSelected] = useState<string | null>(null)
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null)

  useEffect(() => {
    setSelected(null)
    setPromotion(null)
  }, [fen, movableColor])

  const over = useMemo(() => chess.isGameOver(), [chess])
  const canMove = movableColor !== null && chess.turn() === movableColor && !over

  const targets = useMemo(() => {
    if (!selected || !canMove) return []
    return chess.moves({ square: selected as Square, verbose: true }).map((move) => move.to as string)
  }, [chess, selected, canMove])

  function tryMove(from: string, to: string): boolean {
    const candidates = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to)
    if (candidates.length === 0) return false
    if (candidates.some((m) => m.promotion)) {
      setPromotion({ from, to })
      return false
    }
    return onMove?.({ from, to }) ?? false
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    // Dropped back on its own square: that was a tap, so the piece stays selected for a tap-move.
    if (!targetSquare || sourceSquare === targetSquare) {
      setSelected(canMove ? sourceSquare : null)
      return false
    }
    setSelected(null)
    if (!canMove) return false
    return tryMove(sourceSquare, targetSquare)
  }

  function handleSquareClick({ piece, square }: SquareHandlerArgs) {
    if (!canMove) return
    if (selected && targets.includes(square)) {
      tryMove(selected, square)
      setSelected(null)
      return
    }
    if (piece && piece.pieceType[0] === movableColor) {
      setSelected(selected === square ? null : square)
      return
    }
    setSelected(null)
  }

  function choosePromotion(piece: string) {
    if (!promotion) return
    const move = { ...promotion, promotion: piece }
    setPromotion(null)
    onMove?.(move)
  }

  const styles = useMemo(() => {
    const result: Record<string, CSSProperties> = {}
    const add = (square: string, style: CSSProperties) => {
      result[square] = { ...result[square], ...style }
    }
    if (lastMove) {
      add(lastMove.from, { backgroundColor: LAST_MOVE_COLOR })
      add(lastMove.to, { backgroundColor: LAST_MOVE_COLOR })
    }
    if (chess.inCheck()) {
      const king = findKing(chess, chess.turn())
      if (king) add(king, { backgroundImage: CHECK })
    }
    if (selected) add(selected, { backgroundColor: SELECTED_COLOR })
    for (const square of targets) {
      add(square, { backgroundImage: chess.get(square as Square) ? RING : DOT, cursor: 'pointer' })
    }
    if (squareStyles) {
      for (const [square, style] of Object.entries(squareStyles)) add(square, style)
    }
    return result
  }, [chess, lastMove, selected, targets, squareStyles])

  return (
    <div className="board">
      <Chessboard
        options={{
          id,
          position: fen,
          boardOrientation: orientation,
          allowDragging: canMove,
          dragActivationDistance: DRAG_START_PX,
          canDragPiece: ({ piece }) => canMove && piece.pieceType[0] === movableColor,
          onPieceDrag: ({ square }) => {
            if (canMove && square) setSelected(square)
          },
          onPieceDrop: handleDrop,
          onSquareClick: handleSquareClick,
          squareStyles: styles,
          arrows: arrows ?? [],
          darkSquareStyle: { backgroundColor: '#779556' },
          lightSquareStyle: { backgroundColor: '#ebecd0' },
          animationDurationInMs: 180,
          boardStyle: { borderRadius: '6px', overflow: 'hidden' },
        }}
      />
      {promotion && (
        <div className="promotion-overlay" onClick={() => setPromotion(null)}>
          <div className="promotion-box" onClick={(e) => e.stopPropagation()}>
            <p>Piyonun neye dönüşsün?</p>
            <div className="promotion-choices">
              {PROMOTION_PIECES.map((p) => (
                <button key={p.piece} type="button" onClick={() => choosePromotion(p.piece)}>
                  <span className="promotion-glyph">{movableColor === 'b' ? p.b : p.w}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
