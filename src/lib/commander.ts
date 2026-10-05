import { cardKey } from './cards'

// Helpers around the commander of the active deck. Some tools (the Ghalta calculator,
// the Ghalta lessons) only make sense for one specific commander.

/** "Ghalta, Primal Hunger" → "Ghalta"; for double-faced cards the front face counts. */
export function shortName(commander: string): string {
  const front = commander.split(' // ')[0].trim()
  return front.split(',')[0].trim() || front
}

export const GHALTA = 'Ghalta, Primal Hunger'

/** Is this deck led by Ghalta, Primal Hunger (cost reduction by power)? */
export const isGhalta = (commander: string) => cardKey(commander) === cardKey(GHALTA)
