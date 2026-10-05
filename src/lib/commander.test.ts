import { describe, expect, it } from 'vitest'
import { isGhalta, shortName } from './commander'

describe('commander helpers', () => {
  it('shortens commander names for buttons and notes', () => {
    expect(shortName('Ghalta, Primal Hunger')).toBe('Ghalta')
    expect(shortName('The First Sliver')).toBe('The First Sliver')
    expect(shortName('Esika, God of the Tree // The Prismatic Bridge')).toBe('Esika')
  })

  it('recognizes Ghalta regardless of case', () => {
    expect(isGhalta(' ghalta, primal hunger')).toBe(true)
    expect(isGhalta('Ghalta, Stampede Tyrant')).toBe(false)
  })
})
