import { toggleFullscreen, useFullscreen } from '../core/fullscreen'

/** Enters or leaves full screen. Hidden when the browser cannot do it. */
export default function FullscreenButton({ compact = false }: { compact?: boolean }) {
  const on = useFullscreen()
  if (on === null) return null
  const label = on ? 'Tam ekrandan çık' : 'Tam ekran'
  return (
    <button type="button" className={`btn fullscreen-btn${compact ? ' compact' : ''}`} onClick={() => void toggleFullscreen()} title={label} aria-label={label}>
      <span aria-hidden="true">{on ? '🗗' : '⛶'}</span>
      {!compact && <span className="fullscreen-label">{label}</span>}
    </button>
  )
}
