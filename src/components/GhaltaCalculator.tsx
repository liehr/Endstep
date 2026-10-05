import { useState } from 'react'
import { ghaltaCost } from '../lib/ghalta'
import { Card, Stepper } from './ui'

export function GhaltaCalculator() {
  const [power, setPower] = useState(0)
  const [casts, setCasts] = useState(0)
  const cost = ghaltaCost(power, casts)

  return (
    <Card className="ghalta">
      <h2>Ghalta-Rechner</h2>
      <div className="ghalta-cost" aria-live="polite">
        <span className="ghalta-label">Kostet jetzt</span>
        <strong>{cost.label}</strong>
        <span className="ghalta-sub">
          {cost.missingPowerForGG > 0
            ? `Noch ${cost.missingPowerForGG} Stärke bis GG`
            : 'Nur noch GG. Los!'}
        </span>
      </div>
      <div className="ghalta-inputs">
        <div>
          <span className="field-label">Stärke deiner Kreaturen</span>
          <Stepper label="Stärke" value={power} min={0} max={99} onChange={(v) => setPower(v ?? 0)} />
        </div>
        <div>
          <span className="field-label">Schon gecastet (Steuer)</span>
          <Stepper label="Casts" value={casts} min={0} max={10} onChange={(v) => setCasts(v ?? 0)} />
        </div>
      </div>
      <p className="muted small">
        Steuer (+2 je Cast) wird zuerst addiert, dann senkt die Gesamtstärke den generischen Teil.
      </p>
    </Card>
  )
}
