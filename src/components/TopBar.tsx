import FullscreenButton from './FullscreenButton'
import SoundButton from './SoundButton'

interface TopBarProps {
  title: string
  backTo?: string
  backLabel?: string
}

export default function TopBar({ title, backTo = '', backLabel = 'Ana ekran' }: TopBarProps) {
  return (
    <header className="top-bar">
      <a className="back-link" href={`#/${backTo}`} aria-label={backLabel}>
        <span aria-hidden="true">←</span> <span className="back-link-label">{backLabel}</span>
      </a>
      <h1>{title}</h1>
      <span className="top-bar-tools">
        <SoundButton />
        <FullscreenButton compact />
      </span>
    </header>
  )
}
