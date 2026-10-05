import { describe, expect, it } from 'vitest'
import { clampCount, DICE, describeRoll, faceLabel, MAX_COUNT, rollDice, summarize } from './dice'
import { mulberry32 } from './sim/rng'

describe('rollDice', () => {
  it('rolls the requested number of dice, each within its sides, across many seeds', () => {
    for (const die of DICE) {
      for (let seed = 0; seed < 200; seed++) {
        const roll = rollDice(die.id, 5, mulberry32(seed))
        expect(roll.values).toHaveLength(5)
        for (const v of roll.values) {
          expect(Number.isInteger(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(1)
          expect(v).toBeLessThanOrEqual(die.sides)
        }
      }
    }
  })

  it('reaches every face', () => {
    for (const die of DICE) {
      const seen = new Set(rollDice(die.id, MAX_COUNT, mulberry32(7)).values)
      for (let seed = 8; seen.size < die.sides && seed < 100; seed++) {
        rollDice(die.id, MAX_COUNT, mulberry32(seed)).values.forEach((v) => seen.add(v))
      }
      expect(seen.size).toBe(die.sides)
    }
  })

  it('is reproducible with the same seed', () => {
    expect(rollDice('d20', 5, mulberry32(42))).toEqual(rollDice('d20', 5, mulberry32(42)))
  })

  it('keeps the count within bounds', () => {
    expect(clampCount(0)).toBe(1)
    expect(clampCount(-3)).toBe(1)
    expect(clampCount(Number.NaN)).toBe(1)
    expect(clampCount(500)).toBe(MAX_COUNT)
    expect(rollDice('d6', 500, mulberry32(1)).values).toHaveLength(MAX_COUNT)
  })
})

describe('summarize', () => {
  it('adds up numbered dice', () => {
    expect(summarize({ die: 'd20', values: [3, 17, 9, 20, 1] })).toEqual([
      { label: 'Total', value: 50 },
      { label: 'Highest', value: 20 },
      { label: 'Lowest', value: 1 },
    ])
  })

  it('has nothing to add for a single numbered die', () => {
    expect(summarize({ die: 'd20', values: [14] })).toEqual([])
  })

  it('counts coin faces', () => {
    expect(summarize({ die: 'coin', values: [1, 2, 1] })).toEqual([
      { label: 'Heads', value: 2 },
      { label: 'Tails', value: 1 },
    ])
  })

  it('counts planar faces', () => {
    expect(summarize({ die: 'planar', values: [1, 2, 3, 6, 2] })).toEqual([
      { label: 'Planeswalk', value: 1 },
      { label: 'Chaos', value: 2 },
    ])
  })
})

describe('labels', () => {
  it('names faces', () => {
    expect(faceLabel('coin', 1)).toBe('Heads')
    expect(faceLabel('coin', 2)).toBe('Tails')
    expect(faceLabel('planar', 1)).toBe('Planeswalk')
    expect(faceLabel('planar', 2)).toBe('Chaos')
    expect(faceLabel('planar', 5)).toBe('Blank')
    expect(faceLabel('d12', 11)).toBe('11')
  })

  it('describes rolls for the history', () => {
    expect(describeRoll({ die: 'd20', values: [3, 17, 9, 20, 1] })).toBe('5 × d20 · Total 50')
    expect(describeRoll({ die: 'd20', values: [14] })).toBe('1 d20 · 14')
    expect(describeRoll({ die: 'coin', values: [2] })).toBe('1 coin · Tails')
    expect(describeRoll({ die: 'coin', values: [1, 2, 1] })).toBe('3 × coin · 2 heads, 1 tails')
    expect(describeRoll({ die: 'planar', values: [2] })).toBe('1 planar die · Chaos')
  })
})
