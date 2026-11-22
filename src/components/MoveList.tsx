import { useEffect, useRef, type ReactNode } from 'react'
import type { Side } from '../core/types'

export interface MoveItem {
  label: string
  side?: Side
  /** Optional badge, e.g. a classification symbol. */
  badge?: { text: string; className: string; title?: string }
}

interface MoveListProps {
  moves: MoveItem[]
  /** 'pairs' = two moves per numbered row (chess), 'list' = one move per row (games with extra turns). */
  layout?: 'pairs' | 'list'
  /** Index of the highlighted ply, or -1 for none. */
  current?: number
  onSelect?: (ply: number) => void
  emptyText?: string
}

export default function MoveList({
  moves,
  layout = 'pairs',
  current = -1,
  onSelect,
  emptyText = 'Henüz hamle yok.',
}: MoveListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>('.move.active')
    if (active) {
      // .move-list is position: relative, so offsetTop is measured from the list itself.
      const top = active.offsetTop
      if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - active.offsetHeight) {
        list.scrollTop = top - list.clientHeight / 2
      }
    } else if (current < 0) {
      list.scrollTop = list.scrollHeight
    }
  }, [moves.length, current])

  if (moves.length === 0) return <div className="move-list empty">{emptyText}</div>

  const moveButton = (ply: number): ReactNode => {
    const move = moves[ply]
    return (
      <button
        key={ply}
        type="button"
        className={`move${ply === current ? ' active' : ''}${onSelect ? '' : ' static'}`}
        onClick={onSelect ? () => onSelect(ply) : undefined}
        tabIndex={onSelect ? 0 : -1}
      >
        {layout === 'list' && move.side && <span className="player-dot small-dot" data-color={move.side} />}
        {move.label}
        {move.badge && (
          <span className={`badge ${move.badge.className}`} title={move.badge.title}>
            {move.badge.text}
          </span>
        )}
      </button>
    )
  }

  const rows: ReactNode[] = []
  if (layout === 'list') {
    moves.forEach((_, ply) => {
      rows.push(
        <div className="move-row list" key={ply}>
          <span className="move-number">{ply + 1}.</span>
          {moveButton(ply)}
        </div>,
      )
    })
  } else {
    for (let i = 0; i < moves.length; i += 2) {
      rows.push(
        <div className="move-row" key={i}>
          <span className="move-number">{i / 2 + 1}.</span>
          {moveButton(i)}
          {i + 1 < moves.length ? moveButton(i + 1) : <span className="move placeholder" />}
        </div>,
      )
    }
  }

  return (
    <div className="move-list" ref={listRef}>
      {rows}
    </div>
  )
}
