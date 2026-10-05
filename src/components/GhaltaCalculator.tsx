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
        <button type="button" aria-label={`${label} verringern`} onClick={() => change(-1)}>
          <MinusIcon weight="bold" />
        </button>
        <output>{value}</output>
        <button type="button" aria-label={`${label} erhöhen`} onClick={() => change(1)}>
          <PlusIcon weight="bold" />
        </button>
      </div>
    </div>
  )
}

export function GhaltaCalculator() {
  const [power, setPower] = useState(0)
  const [casts, setCasts] = useState(0)
  const cost = ghaltaCost(power, casts)
  const ready = cost.generic === 0

  return (
    <section className={`ghalta ${ready ? 'ready' : ''}`} aria-label="Ghalta-Rechner">
      <div className="ghalta-head">
        <span className="ghalta-eyebrow">Ghalta kostet</span>
        <strong className="ghalta-cost" aria-live="polite">
          {cost.label}
        </strong>
        <span className="ghalta-sub">{ready ? 'Nur noch GG. Los!' : `Noch ${cost.missingPowerForGG} Stärke bis GG`}</span>
      </div>
      <div className="ghalta-counters">
        <Counter label="Stärke auf dem Feld" value={power} onChange={setPower} max={99} />
        <Counter label="Schon gecastet" value={casts} onChange={setCasts} max={10} />
      </div>
    </section>
  )
}
