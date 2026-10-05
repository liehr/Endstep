import { describe, expect, it } from 'vitest'
import { deriveKeys, open, seal } from './crypto'

describe('sync encryption', () => {
  it('round-trips and hides the content', async () => {
    const { key } = await deriveKeys('K7QM-4XTD-P9')
    const text = JSON.stringify({ winner: 'Ghalta', games: Array.from({ length: 50 }, (_, i) => ({ id: i })) })
    const blob = await seal(text, key)
    expect(blob).not.toContain('Ghalta')
    expect(await open(blob, key)).toBe(text)
  })

  it('the same code gives the same place, typed any way', async () => {
    const a = await deriveKeys('K7QM-4XTD-P9')
    const b = await deriveKeys('k7qm4xtdp9')
    expect(a.id).toBe(b.id)
    expect(a.id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('another code can’t open it', async () => {
    const blob = await seal('secret', (await deriveKeys('K7QM-4XTD-P9')).key)
    const other = await deriveKeys('A7QM-4XTD-P9')
    await expect(open(blob, other.key)).rejects.toThrow()
  })
})
