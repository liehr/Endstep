/** Generischer Anteil von Ghaltas Manakosten (10 generisch + GG). */
export const GHALTA_GENERIC = 10

export interface GhaltaCost {
  /** Generisches Mana, das nach Steuer und Reduktion übrig bleibt. */
  generic: number
  /** Gesamtkosten inklusive GG. */
  total: number
  /** Kosten in Kartenschreibweise, z. B. „4GG“ oder „GG“. */
  label: string
  /** Wie viel Stärke noch fehlt, bis Ghalta nur noch GG kostet. */
  missingPowerForGG: number
}

/**
 * Commander-Steuer (+2 je früherem Cast aus der Command Zone) wird zuerst addiert,
 * danach senkt die Gesamtstärke deiner Kreaturen den generischen Anteil.
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
