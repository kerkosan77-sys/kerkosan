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
      <a className="back-link" href={`#/${backTo}`}>
        <span aria-hidden="true">←</span> {backLabel}
      </a>
      <h1>{title}</h1>
      <span className="top-bar-tools">
        <SoundButton />
        <FullscreenButton compact />
      </span>
    </header>
  )
}
