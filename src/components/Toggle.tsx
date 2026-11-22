interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

export default function Toggle({ label, description, checked, disabled, onChange }: ToggleProps) {
  return (
    <label className={`toggle${disabled ? ' disabled' : ''}`}>
      <span className="toggle-text">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </label>
  )
}
