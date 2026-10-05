import { describe, expect, it } from 'vitest'
import { formatCode, generateCode, isValidCode, normalizeCode } from './code'

describe('sync code', () => {
  it('makes valid, readable codes', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/)
      expect(isValidCode(code)).toBe(true)
    }
  })

  it('forgives dashes, lowercase and look-alike letters', () => {
    const code = generateCode(() => new Uint8Array([0, 1, 24, 3, 4, 5, 6, 7, 8]))
    const typed = formatCode(code).toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l')
    expect(normalizeCode(typed)).toBe(code)
    expect(isValidCode(typed)).toBe(true)
  })

  it('catches typos', () => {
    const code = generateCode()
    const swapped = code[1] + code[0] + code.slice(2)
    const changed = (code[0] === 'A' ? 'B' : 'A') + code.slice(1)
    expect(isValidCode(changed)).toBe(false)
    if (swapped !== code) expect(isValidCode(swapped)).toBe(false)
    expect(isValidCode(code.slice(0, 9))).toBe(false)
  })

  it('formats as XXXX-XXXX-XX', () => {
    expect(formatCode('k7qm4xtdp9')).toBe('K7QM-4XTD-P9')
  })
})
