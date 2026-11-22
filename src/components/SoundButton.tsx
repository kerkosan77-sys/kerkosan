import { setSoundOn, useSoundOn } from '../core/sound'

/** Switches the sounds on and off. */
export default function SoundButton() {
  const on = useSoundOn()
  const label = on ? 'Sesi kapat' : 'Sesi aç'
  return (
    <button type="button" className="btn fullscreen-btn compact" onClick={() => setSoundOn(!on)} title={label} aria-label={label} aria-pressed={on}>
      <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
    </button>
  )
}
