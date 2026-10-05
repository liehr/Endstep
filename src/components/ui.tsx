import { HeartBreakIcon, TrophyIcon, XIcon, type Icon } from '@phosphor-icons/react'
import { useEffect, useId, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'

// --- Buttons ---------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'md' | 'sm'
  block?: boolean
  icon?: Icon
}

/** Tactile 3D button: darker "lip" at the bottom, sinks in when pressed. */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  icon: IconCmp,
  className = '',
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${block ? 'btn-block' : ''} ${className}`}
      onClick={(e) => {
        haptic()
        onClick?.(e)
      }}
      {...rest}
    >
      {IconCmp && <IconCmp weight="bold" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function IconButton({ icon: IconCmp, label, onClick }: { icon: Icon; label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      <IconCmp weight="bold" />
    </button>
  )
}

// --- Surfaces --------------------------------------------------------------

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {children}
    </section>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

// --- Inputs ----------------------------------------------------------------

/** Labelled input field (input, textarea). */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </label>
  )
}

/** Labelled group for button inputs (Choice, Stepper, ChipInput). */
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

export interface ChoiceOption<T> {
  id: T
  label: string
  icon?: Icon
  /** Optional subtitle below the label. */
  hint?: string
  style?: CSSProperties
}

/** Selection as large cards (like Duolingo): quick to hit with your thumb. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  allowNone = false,
  layout = 'grid',
  columns = 2,
}: {
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
  /** Tapping again clears the selection. */
  allowNone?: boolean
  layout?: 'grid' | 'list'
  columns?: number
}) {
  return (
    <div
      className={`choice choice-${layout}`}
      role="radiogroup"
      style={layout === 'grid' ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {options.map(({ id, label, icon: IconCmp, hint, style }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={`option ${value === id ? 'selected' : ''}`}
          style={style}
          onClick={() => {
            haptic()
            onChange(allowNone && value === id ? null : id)
          }}
        >
          {IconCmp && (
            <span className="option-icon">
              <IconCmp weight="fill" aria-hidden="true" />
            </span>
          )}
          <span className="option-text">
            <span>{label}</span>
            {hint && <small>{hint}</small>}
          </span>
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
  return (
    <div className="stepper" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => {
          haptic()
          onChange(value === null || value <= min ? null : value - 1)
        }}
      >
        −
      </button>
      <output>{value ?? '–'}</output>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => {
          haptic()
          onChange(value === null ? min : Math.min(max, value + 1))
        }}
      >
        +
      </button>
    </div>
  )
}

/** Enter card names; earlier entries appear as tappable suggestions. */
export function ChipInput({
  values,
  onChange,
  suggestions,
  catalog = [],
  placeholder,
}: {
  values: string[]
  onChange: (values: string[]) => void
  /** Frequent entries: shown as suggestions when nothing is typed. */
  suggestions: string[]
  /** More names (e.g. all cards in the deck), searched while typing. */
  catalog?: string[]
  placeholder: string
}) {
  const [text, setText] = useState('')
  const has = (name: string) => values.some((v) => v.toLowerCase() === name.toLowerCase())

  const add = (raw: string) => {
    const name = raw.trim()
    if (name && !has(name)) {
      haptic()
      onChange([...values, name])
    }
    setText('')
  }

  const query = text.trim().toLowerCase()
  const pool = query ? [...new Set([...suggestions, ...catalog])] : suggestions
  const visibleSuggestions = pool.filter((s) => !has(s) && (!query || s.toLowerCase().includes(query))).slice(0, 8)

  return (
    <div className="chips">
      {values.length > 0 && (
        <ul className="chip-list">
          {values.map((v) => (
            <li key={v} className="chip selected">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                <XIcon weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="chips-add">
        <input
          value={text}
          placeholder={placeholder}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            }
          }}
        />
        <Button variant="secondary" size="sm" disabled={!text.trim()} onClick={() => add(text)}>
          Add
        </Button>
      </div>
      {visibleSuggestions.length > 0 && (
        <ul className="chip-list suggestions" aria-label="Suggestions">
          {visibleSuggestions.map((s) => (
            <li key={s}>
              <button type="button" className="chip" onClick={() => add(s)}>
                + {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// --- Bottom Sheet ----------------------------------------------------------

/** Panel that slides in from the bottom: stays within thumb reach. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('sheet-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('sheet-open')
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-header">
          {title && <h2>{title}</h2>}
          <IconButton icon={XIcon} label="Close" onClick={onClose} />
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmSheet({
  open,
  title,
  text,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  text: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <p className="muted">{text}</p>
      <div className="stack">
        <Button variant="danger" block onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" block onClick={onClose}>
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="mascot" />
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      {children}
    </div>
  )
}

/** Result as a pill: colour plus icon plus text, never colour alone. */
export function ResultPill({ result }: { result: 'win' | 'loss' }) {
  const IconCmp = result === 'win' ? TrophyIcon : HeartBreakIcon
  return (
    <span className={`result-pill ${result}`}>
      <IconCmp weight="fill" aria-hidden="true" />
      {result === 'win' ? 'Win' : 'Loss'}
    </span>
  )
}
