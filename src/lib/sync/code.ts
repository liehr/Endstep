// A sync code connects devices: whoever knows it shares the same (encrypted) cloud copy.
// 9 random characters (45 bits) plus one check character, written XXXX-XXXX-XX.
// Crockford's base32 leaves out I, L, O and U, so nothing can be misread.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const RANDOM_LENGTH = 9

function checkChar(body: string): string {
  let sum = 0
  // Odd weights: any single wrong character changes the check character.
  for (let i = 0; i < body.length; i++) sum += ALPHABET.indexOf(body[i]) * (2 * i + 1)
  return ALPHABET[sum % 32]
}

export function generateCode(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(RANDOM_LENGTH))
  const body = [...bytes].map((b) => ALPHABET[b % 32]).join('')
  return body + checkChar(body)
}

/** Uppercase, without dashes or spaces; O, I and L are read as 0 and 1. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

export function isValidCode(input: string): boolean {
  const code = normalizeCode(input)
  if (code.length !== RANDOM_LENGTH + 1 || [...code].some((c) => !ALPHABET.includes(c))) return false
  return checkChar(code.slice(0, RANDOM_LENGTH)) === code[RANDOM_LENGTH]
}

/** K7QM-4XTD-P9 */
export function formatCode(input: string): string {
  const code = normalizeCode(input)
  return [code.slice(0, 4), code.slice(4, 8), code.slice(8)].filter(Boolean).join('-')
}
