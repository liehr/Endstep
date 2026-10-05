// Colors of mana as bit masks, so a source that makes "one mana of any color" or
// "{R} or {G}" and a hybrid symbol like {G/U} can all be described the same way.

export const W = 1
export const U = 2
export const B = 4
export const R = 8
export const G = 16
/** Colorless mana ({C}): only sources that make colorless can pay it. */
export const C = 32
/** Any of the five colors. */
export const ANY = W | U | B | R | G

export const COLOR_LETTERS = ['W', 'U', 'B', 'R', 'G'] as const
export type ColorLetter = (typeof COLOR_LETTERS)[number]

const BY_LETTER: Record<string, number> = { W, U, B, R, G, C }

export const maskOf = (letter: string): number => BY_LETTER[letter.toUpperCase()] ?? 0

/** Number of colors in a mask (how flexible a source or symbol is). */
export function bits(mask: number): number {
  let n = 0
  for (let m = mask; m; m &= m - 1) n++
  return n
}

/** Color letters of a mask in WUBRG order (without C). */
export const lettersOf = (mask: number): ColorLetter[] => COLOR_LETTERS.filter((l) => mask & BY_LETTER[l])

/**
 * Pay a cost from a pool of mana units (one mask per unit: which colors it can be).
 * Colored symbols are paid first, the pickiest symbol with the least flexible unit, then
 * the generic part from what is left, again starting with the least flexible units.
 * Returns the units left over, or null if the pool can't pay.
 */
export function payFrom(pool: number[], generic: number, pips: number[]): number[] | null {
  const left = [...pool]
  for (const pip of [...pips].sort((a, b) => bits(a) - bits(b))) {
    let best = -1
    left.forEach((unit, i) => {
      if (unit & pip && (best < 0 || bits(unit) < bits(left[best]))) best = i
    })
    if (best < 0) return null
    left.splice(best, 1)
  }
  if (left.length < generic) return null
  // Colorless first, then single colors, "any color" sources last.
  left.sort((a, b) => (a === C ? 0 : bits(a)) - (b === C ? 0 : bits(b)))
  return left.slice(generic)
}
