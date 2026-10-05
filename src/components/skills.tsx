import {
  BroomIcon,
  CardsIcon,
  CrosshairIcon,
  HandshakeIcon,
  LightningIcon,
  ListNumbersIcon,
  SwordIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { CSSProperties } from 'react'
import type { SkillId } from '../lib/types'

/** Jeder Skill hat ein festes Icon und eine feste Farbe (Farben in styles.css, farbfehlsichtig geprüft). */
export const SKILL_ICON: Record<SkillId, Icon> = {
  mulligan: CardsIcon,
  sequencing: ListNumbersIcon,
  threat: CrosshairIcon,
  combat: SwordIcon,
  wipe: BroomIcon,
  removal: LightningIcon,
  politics: HandshakeIcon,
}

/** CSS-Variablen für die Skill-Farbe: --c (Fläche) und --c-ink (Icon/Text darauf). */
export function skillStyle(id: SkillId): CSSProperties {
  return { '--c': `var(--skill-${id})`, '--c-ink': `var(--skill-${id}-ink)` } as CSSProperties
}

export function SkillBadge({ id, size = 48, muted = false }: { id: SkillId; size?: number; muted?: boolean }) {
  const IconCmp = SKILL_ICON[id]
  return (
    <span
      className={`skill-badge ${muted ? 'muted' : ''}`}
      style={{ ...skillStyle(id), width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      <IconCmp weight="fill" />
    </span>
  )
}
