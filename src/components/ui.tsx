import { useId, useState, type ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

/** Beschriftetes Eingabefeld (input, textarea). */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </label>
  )
}

/** Beschriftete Gruppe für Button-Eingaben (Choice, Stepper, ChipInput). */
export function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span className="field-label" id={id}>
        {label}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </div>
  )
}

/** Auswahl als große Buttons statt Dropdown: auf dem Handy schneller zu treffen. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  allowNone = false,
  columns,
}: {
  options: { id: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
  /** Erneutes Tippen hebt die Auswahl auf. */
  allowNone?: boolean
  columns?: number
}) {
  return (
    <div
      className="choice"
      role="radiogroup"
      style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'selected' : ''}
          onClick={() => onChange(allowNone && value === o.id ? null : o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  label: string
}) {
  const current = value ?? min
  return (
    <div className="stepper" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} verringern`}
        onClick={() => onChange(value === null || value <= min ? null : value - 1)}
      >
        −
      </button>
      <output>{value ?? '–'}</output>
      <button
        type="button"
        aria-label={`${label} erhöhen`}
        onClick={() => onChange(value === null ? min : Math.min(max, current + 1))}
      >
        +
      </button>
    </div>
  )
}

/** Liste von Kartennamen mit Vorschlägen aus bisherigen Einträgen. */
export function ChipInput({
  values,
  onChange,
  suggestions,
  placeholder,
}: {
  values: string[]
  onChange: (values: string[]) => void
  suggestions: string[]
  placeholder: string
}) {
  const [text, setText] = useState('')
  const listId = useId()

  const add = (raw: string) => {
    const name = raw.trim()
    if (name && !values.some((v) => v.toLowerCase() === name.toLowerCase())) {
      onChange([...values, name])
    }
    setText('')
  }

  return (
    <div className="chips">
      {values.length > 0 && (
        <ul>
          {values.map((v) => (
            <li key={v}>
              {v}
              <button
                type="button"
                aria-label={`${v} entfernen`}
                onClick={() => onChange(values.filter((x) => x !== v))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="chips-add">
        <input
          value={text}
          list={listId}
          placeholder={placeholder}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            }
          }}
          onBlur={() => add(text)}
        />
        <button type="button" className="secondary" onClick={() => add(text)}>
          +
        </button>
      </div>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}

export function Collapsible({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="collapsible" open={open}>
      <summary>{title}</summary>
      <div className="collapsible-body">{children}</div>
    </details>
  )
}

export function ResultBadge({ result }: { result: 'win' | 'loss' }) {
  return <span className={`badge ${result}`}>{result === 'win' ? 'Sieg' : 'Niederlage'}</span>
}
