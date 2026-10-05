import { ArrowCounterClockwiseIcon, PinwheelIcon, PlayIcon } from '@phosphor-icons/react'
import { useState, type CSSProperties } from 'react'
import { SKILL_BY_ID } from '../lib/content'
import { spinWheel, WHEEL_SKILLS, wheelAngle } from '../lib/focus'
import { haptic, prefersReducedMotion } from '../lib/haptics'
import { navigate } from '../lib/route'
import { actions } from '../lib/store'
import type { SkillId } from '../lib/types'
import { SKILL_ICON, SkillBadge, skillStyle } from './skills'
import { Button } from './ui'

const SIZE = 280
const R = SIZE / 2
const COUNT = WHEEL_SKILLS.length
const SLICE = 360 / COUNT
const SPIN_MS = 4200

/** Point on the wheel: `deg` clockwise from the top, `r` from the centre. */
function point(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [R + r * Math.sin(rad), R - r * Math.cos(rad)]
}

function slicePath(index: number): string {
  const [x1, y1] = point(index * SLICE - SLICE / 2, R)
  const [x2, y2] = point(index * SLICE + SLICE / 2, R)
  return `M${R},${R} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} Z`
}

/**
 * Lucky wheel: spin it and the skill under the pointer is the focus for your next game.
 * It isn't tied to your rank, every skill is on it.
 */
export function FocusWheel({ spin, disabled }: { spin: SkillId | null; disabled: boolean }) {
  const [angle, setAngle] = useState(() => (spin ? wheelAngle(0, WHEEL_SKILLS.indexOf(spin), COUNT, 0) : 0))
  const [spinning, setSpinning] = useState(false)
  const [duration, setDuration] = useState(0)
  const result = spinning ? null : spin

  const go = () => {
    if (spinning) return
    const pick = spinWheel(Math.random)
    const reduced = prefersReducedMotion()
    setDuration(reduced ? 300 : SPIN_MS)
    setAngle((a) => wheelAngle(a, WHEEL_SKILLS.indexOf(pick), COUNT, reduced ? 1 : 5, Math.random() * 2 - 1))
    setSpinning(true)
    // Saved right away, so closing the sheet mid-spin keeps the pick.
    actions.setSpin(pick)
    haptic(12)
  }

  const stop = () => {
    if (!spinning) return
    setSpinning(false)
    haptic([12, 60, 12])
  }

  return (
    <div className="focus-wheel">
      <div className="wheel-stage">
        <span className="wheel-pointer" aria-hidden="true" />
        <svg
          className="wheel"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Wheel with ${WHEEL_SKILLS.map((id) => SKILL_BY_ID[id].name).join(', ')}`}
          style={{ transform: `rotate(${angle}deg)`, transitionDuration: `${duration}ms` }}
          onTransitionEnd={stop}
        >
          {WHEEL_SKILLS.map((id, i) => {
            const IconCmp = SKILL_ICON[id]
            const [x, y] = point(i * SLICE, R * 0.68)
            return (
              <g key={id} style={skillStyle(id)}>
                <path d={slicePath(i)} className="wheel-slice" />
                <IconCmp
                  weight="fill"
                  x={x - 18}
                  y={y - 18}
                  width={36}
                  height={36}
                  className="wheel-icon"
                  transform={`rotate(${i * SLICE} ${x} ${y})`}
                />
              </g>
            )
          })}
        </svg>
        <button type="button" className="wheel-hub" onClick={go} disabled={spinning} aria-label="Spin the wheel">
          <PinwheelIcon weight="fill" />
        </button>
      </div>

      <div className="wheel-result" aria-live="polite">
        {spinning ? (
          <p className="muted">Spinning…</p>
        ) : result ? (
          <div className="wheel-pick" style={skillStyle(result) as CSSProperties}>
            <SkillBadge id={result} size={56} />
            <div>
              <span className="eyebrow">Focus for your next game</span>
              <strong>{SKILL_BY_ID[result].name}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">Not tied to your rank: every skill is on the wheel. Whatever it lands on is your focus for the next game.</p>
        )}
      </div>

      {result && !spinning ? (
        <>
          <Button block icon={PlayIcon} disabled={disabled} onClick={() => navigate(`/runde/neu/${result}`)}>
            Play with this focus
          </Button>
          {disabled && <p className="muted small center">Finish the game in progress first.</p>}
          <Button block variant="secondary" icon={PinwheelIcon} onClick={go}>
            Spin again
          </Button>
          <Button block variant="ghost" icon={ArrowCounterClockwiseIcon} onClick={() => actions.setSpin(null)}>
            Back to the path
          </Button>
        </>
      ) : (
        <Button block icon={PinwheelIcon} onClick={go} disabled={spinning}>
          Spin
        </Button>
      )}
    </div>
  )
}
