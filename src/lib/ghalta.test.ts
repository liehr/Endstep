import { describe, expect, it } from 'vitest'
import { ghaltaCost } from './ghalta'

describe('ghaltaCost', () => {
  it('kostet ohne Kreaturen 10GG', () => {
    expect(ghaltaCost(0, 0)).toMatchObject({ generic: 10, total: 12, label: '10GG' })
  })

  it('kostet mit 10 Stärke nur GG (zwei 5/4 reichen)', () => {
    expect(ghaltaCost(10, 0)).toMatchObject({ generic: 0, total: 2, label: 'GG', missingPowerForGG: 0 })
  })

  it('reduziert nie unter GG', () => {
    expect(ghaltaCost(25, 0).label).toBe('GG')
  })

  it('addiert die Commander-Steuer vor der Reduktion', () => {
    // Nach dem ersten Tod braucht es 12 Stärke für GG, nach dem zweiten 14.
    expect(ghaltaCost(12, 1).label).toBe('GG')
    expect(ghaltaCost(12, 2)).toMatchObject({ label: '2GG', missingPowerForGG: 2 })
    expect(ghaltaCost(14, 2).label).toBe('GG')
  })
})
