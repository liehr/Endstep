import { describe, expect, it } from 'vitest'
import { ghaltaCost } from './ghalta'

describe('ghaltaCost', () => {
  it('costs 10GG without creatures', () => {
    expect(ghaltaCost(0, 0)).toMatchObject({ generic: 10, total: 12, label: '10GG' })
  })

  it('costs only GG with 10 power (two 5/4s are enough)', () => {
    expect(ghaltaCost(10, 0)).toMatchObject({ generic: 0, total: 2, label: 'GG', missingPowerForGG: 0 })
  })

  it('never reduces below GG', () => {
    expect(ghaltaCost(25, 0).label).toBe('GG')
  })

  it('adds commander tax before the reduction', () => {
    // After the first death it takes 12 power for GG, after the second 14.
    expect(ghaltaCost(12, 1).label).toBe('GG')
    expect(ghaltaCost(12, 2)).toMatchObject({ label: '2GG', missingPowerForGG: 2 })
    expect(ghaltaCost(14, 2).label).toBe('GG')
  })
})
