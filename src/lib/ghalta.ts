/** Generic part of Ghalta's mana cost (10 generic + GG). */
export const GHALTA_GENERIC = 10

export interface GhaltaCost {
  /** Generic mana left after tax and reduction. */
  generic: number
  /** Total cost including GG. */
  total: number
  /** Cost in card notation, e.g. "4GG" or "GG". */
  label: string
  /** How much power is still missing until Ghalta costs only GG. */
  missingPowerForGG: number
}

/**
 * Commander tax (+2 per earlier cast from the command zone) is added first,
 * then the total power of your creatures reduces the generic part.
 */
export function ghaltaCost(power: number, previousCasts: number): GhaltaCost {
  const genericBeforeReduction = GHALTA_GENERIC + 2 * Math.max(0, previousCasts)
  const generic = Math.max(0, genericBeforeReduction - Math.max(0, power))
  return {
    generic,
    total: generic + 2,
    label: generic > 0 ? `${generic}GG` : 'GG',
    missingPowerForGG: generic,
  }
}
