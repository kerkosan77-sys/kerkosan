import type { CaptureInfo } from '../core/types'

/**
 * The pieces a player has taken, next to the player's name: every taken chessman (least valuable
 * first) and "+3" on the side ahead in material; in Go and Dama one stone with "×5".
 */
export default function Captures({ info, you }: { info: CaptureInfo | undefined; you: boolean }) {
  if (!info) return null
  const total = info.pieces.reduce((sum, piece) => sum + piece.count, 0)
  if (total === 0 && info.lead === 0) return null
  const list = info.pieces.map((piece) => `${piece.count} ${piece.name}`).join(', ')
  const lead = info.lead > 0 ? (info.compact ? `${info.lead} taş fazla` : `${info.lead} puan önde`) : ''
  const title = [total > 0 && `${you ? 'Aldıkların' : 'Aldıkları'}: ${list}`, lead].filter(Boolean).join(' · ')

  return (
    <span className="captures" title={title} aria-label={title} role="img">
      {info.compact
        ? total > 0 && (
            <span className="cap-group">
              <span className="cap-stone" data-color={info.color} />×{total}
            </span>
          )
        : info.pieces.map((piece) => (
            <span key={piece.name} className="cap-group cap-pieces" data-color={info.color}>
              {piece.glyph.repeat(piece.count)}
            </span>
          ))}
      {info.lead > 0 && <span className="cap-lead">+{info.lead}</span>}
    </span>
  )
}
