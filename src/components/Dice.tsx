import {
  CoinIcon,
  DiamondIcon,
  DiceFiveIcon,
  DiceSixIcon,
  HexagonIcon,
  PentagonIcon,
  PlanetIcon,
  OctagonIcon,
  TriangleIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useCallback, useRef, useState } from 'react'
import {
  clampCount,
  cryptoRng,
  DICE,
  DIE_BY_ID,
  describeRoll,
  faceLabel,
  MAX_COUNT,
  MIN_COUNT,
  rollDice,
  summarize,
  type DiceRoll,
  type DieId,
} from '../lib/dice'
import { haptic } from '../lib/haptics'
import { BottomSheet, Button, Choice, Group, Stepper } from './ui'

const ICONS: Record<DieId, Icon> = {
  coin: CoinIcon,
  d4: TriangleIcon,
  d6: DiceSixIcon,
  d8: DiamondIcon,
  d10: PentagonIcon,
  d12: HexagonIcon,
  d20: OctagonIcon,
  planar: PlanetIcon,
}

const PRESETS = [1, 2, 3, 5, 10]
const HISTORY = 6

interface Rolled extends DiceRoll {
  key: number
}

/** Floating dice button plus its sheet; mounted once in the app shell so it is there on every screen. */
export function DiceButton({ flow }: { flow: boolean }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <button
        type="button"
        className={`dice-fab ${flow ? 'flow' : ''}`}
        aria-label="Roll dice"
        aria-haspopup="dialog"
        onClick={() => {
          haptic()
          setOpen(true)
        }}
      >
        <DiceFiveIcon weight="fill" aria-hidden="true" />
      </button>
      <BottomSheet open={open} onClose={close} title="Dice">
        <DicePanel />
      </BottomSheet>
    </>
  )
}

// Choice and count survive closing the sheet while the app is open; nothing goes to storage.
let lastDie: DieId = 'd20'
let lastCount = 1
let lastRolls: Rolled[] = []

function DicePanel() {
  const [die, setDie] = useState<DieId>(lastDie)
  const [count, setCount] = useState(lastCount)
  const [rolls, setRolls] = useState<Rolled[]>(lastRolls)
  const nextKey = useRef(lastRolls[0]?.key ?? 0)

  const pickDie = (d: DieId) => {
    lastDie = d
    setDie(d)
  }
  const pickCount = (n: number) => {
    lastCount = clampCount(n)
    setCount(lastCount)
  }
  const roll = () => {
    haptic([10, 40, 10])
    nextKey.current += 1
    const rolled = { ...rollDice(die, count, cryptoRng), key: nextKey.current }
    lastRolls = [rolled, ...rolls].slice(0, HISTORY + 1)
    setRolls(lastRolls)
  }

  const [current, ...earlier] = rolls
  const label = DIE_BY_ID[die].numeric ? DIE_BY_ID[die].label : die === 'coin' ? 'coin' : 'planar die'

  return (
    <>
      <RollResult roll={current} />

      <Group label="Die">
        <div className="dice-picker">
          <Choice
            columns={4}
            options={DICE.map((d) => ({ id: d.id, label: d.label, icon: ICONS[d.id] }))}
            value={die}
            onChange={(d) => d && pickDie(d)}
          />
        </div>
      </Group>

      <Group label="How many">
        <div className="dice-count">
          <Stepper label="number of dice" value={count} min={MIN_COUNT} max={MAX_COUNT} onChange={(n) => pickCount(n ?? MIN_COUNT)} />
          <div className="dice-presets">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip ${count === n ? 'selected' : ''}`}
                aria-pressed={count === n}
                onClick={() => {
                  haptic()
                  pickCount(n)
                }}
              >
                ×{n}
              </button>
            ))}
          </div>
        </div>
      </Group>

      {/* Stays in reach even when many results push the controls down. */}
      <div className="dice-roll">
        <Button block icon={DiceFiveIcon} onClick={roll}>
          {count === 1 ? `Roll ${label}` : `Roll ${count} × ${label}`}
        </Button>
      </div>

      {earlier.length > 0 && (
        <div className="dice-history">
          <span className="eyebrow">Earlier</span>
          <ol>
            {earlier.map((r) => (
              <li key={r.key}>{describeRoll(r)}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}

function RollResult({ roll }: { roll: Rolled | undefined }) {
  return (
    <div className={`dice-result ${roll ? '' : 'empty'}`} aria-live="polite" aria-atomic="true">
      {roll ? <Faces roll={roll} /> : <p className="muted">Pick a die, choose how many, and roll.</p>}
    </div>
  )
}

function Faces({ roll }: { roll: Rolled }) {
  const { sides, numeric } = DIE_BY_ID[roll.die]
  const summary = summarize(roll)
  const single = roll.values.length === 1
  return (
    <>
      <ul key={roll.key} className={`dice-faces ${single ? 'single' : ''} ${numeric ? '' : 'words'}`} aria-label={describeRoll(roll)}>
        {roll.values.map((v, i) => {
          const tone = numeric && sides > 2 ? (v === sides ? 'max' : v === 1 ? 'min' : '') : ''
          return (
            <li key={i} className={`dice-face ${tone}`} style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
              {faceLabel(roll.die, v)}
            </li>
          )
        })}
      </ul>
      {summary.length > 0 && (
        <dl className="dice-summary">
          {summary.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
}
