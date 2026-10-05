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

/** Each skill has a fixed icon and a fixed colour (colours in styles.css, checked for colour vision deficiency). */
export const SKILL_ICON: Record<SkillId, Icon> = {
  mulligan: CardsIcon,
  sequencing: ListNumbersIcon,
  threat: CrosshairIcon,
  combat: SwordIcon,
  wipe: BroomIcon,
  removal: LightningIcon,
  politics: HandshakeIcon,
}

/** CSS variables for the skill colour: --c (surface) and --c-ink (icon/text on top). */
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
