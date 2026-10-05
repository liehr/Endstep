import qrcode from 'qrcode-generator'
import { describe, expect, it } from 'vitest'
import { makeSigil, ORB_COLORS, syncLink } from './sigil'

describe('sync sigil', () => {
  const link = syncLink('K7QM-4XTD-P9', 'https://liehr.github.io/Endstep/#/mehr/sync')

  it('links to the join page with the plain code', () => {
    expect(link).toBe('https://liehr.github.io/Endstep/#/sync/K7QM4XTDP9')
  })

  it('draws exactly the dark modules of the QR code, so it still scans', () => {
    const sigil = makeSigil(link)
    const qr = qrcode(0, 'Q')
    qr.addData(link)
    qr.make()
    const dark = new Set<string>()
    for (let y = 0; y < sigil.size; y++) for (let x = 0; x < sigil.size; x++) if (qr.isDark(y, x)) dark.add(`${x},${y}`)
    const drawn = new Set(sigil.orbs.map((o) => `${o.x},${o.y}`))
    for (const m of sigil.markers) for (let y = m.y; y < m.y + 7; y++) for (let x = m.x; x < m.x + 7; x++) if (dark.has(`${x},${y}`)) drawn.add(`${x},${y}`)
    expect(drawn).toEqual(dark)
  })

  it('uses every orb color', () => {
    const colors = new Set(makeSigil(link).orbs.map((o) => o.color))
    expect(colors.size).toBe(ORB_COLORS)
  })
})
