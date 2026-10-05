import { MinusIcon, PlusIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { haptic } from '../lib/haptics'
import { ghaltaCost } from '../lib/ghalta'

function Counter({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  const change = (delta: number) => {
    haptic()
    onChange(Math.max(0, Math.min(max, value + delta)))
  }
  return (
    <div className="counter">
      <span className="counter-label">{label}</span>
      <div className="counter-row">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => change(-1)}>
          <MinusIcon weight="bold" />
        </button>
        <output>{value}</output>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => change(1)}>
          <PlusIcon weight="bold" />
        </button>
      </div>
    </div>
  )
}

export interface GhaltaValue {
  power: number
  casts: number
}

/** Ghalta calculator. Without value/onChange it keeps track of the values itself. */
export function GhaltaCalculator({ value, onChange }: { value?: GhaltaValue; onChange?: (v: GhaltaValue) => void }) {
  const [local, setLocal] = useState<GhaltaValue>({ power: 0, casts: 0 })
  const current = value ?? local
  const update = onChange ?? setLocal
  const cost = ghaltaCost(current.power, current.casts)
  const ready = cost.generic === 0

  return (
    <section className={`ghalta ${ready ? 'ready' : ''}`} aria-label="Ghalta calculator">
      <div className="ghalta-head">
        <span className="ghalta-eyebrow">Ghalta costs</span>
        <strong className="ghalta-cost" aria-live="polite">
          {cost.label}
        </strong>
        <span className="ghalta-sub">{ready ? 'Just GG. Go!' : `${cost.missingPowerForGG} more power to GG`}</span>
      </div>
      <div className="ghalta-counters">
        <Counter label="Power on the battlefield" value={current.power} onChange={(power) => update({ ...current, power })} max={99} />
        <Counter label="Already cast" value={current.casts} onChange={(casts) => update({ ...current, casts })} max={10} />
      </div>
    </section>
  )
}
