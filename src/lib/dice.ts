import type { Rng } from './sim/rng'

/** Dice that show up in Magic: coin flips, the usual polyhedral dice and the Planechase planar die. */
export type DieId = 'coin' | 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'planar'

export interface Die {
  id: DieId
  label: string
  sides: number
  /** Numbered dice add up; coins and the planar die are counted per face instead. */
  numeric: boolean
}

export const DICE: Die[] = [
  { id: 'd20', label: 'd20', sides: 20, numeric: true },
  { id: 'd6', label: 'd6', sides: 6, numeric: true },
  { id: 'coin', label: 'Coin', sides: 2, numeric: false },
  { id: 'd4', label: 'd4', sides: 4, numeric: true },
  { id: 'd8', label: 'd8', sides: 8, numeric: true },
  { id: 'd10', label: 'd10', sides: 10, numeric: true },
  { id: 'd12', label: 'd12', sides: 12, numeric: true },
  { id: 'planar', label: 'Planar', sides: 6, numeric: false },
]

export const DIE_BY_ID = Object.fromEntries(DICE.map((d) => [d.id, d])) as Record<DieId, Die>

export const MIN_COUNT = 1
export const MAX_COUNT = 30

export interface DiceRoll {
  die: DieId
  /** Face per die, 1..sides. Coin: 1 heads, 2 tails. Planar: 1 planeswalk, 2 chaos, 3–6 blank. */
  values: number[]
}

export const clampCount = (count: number) => Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.round(count) || MIN_COUNT))

export function rollDice(die: DieId, count: number, rng: Rng): DiceRoll {
  const { sides } = DIE_BY_ID[die]
  const values = Array.from({ length: clampCount(count) }, () => Math.floor(rng() * sides) + 1)
  return { die, values }
}

/** Fair randomness for the real table; tests pass a seeded `mulberry32` instead. */
export const cryptoRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

export type PlanarFace = 'planeswalk' | 'chaos' | 'blank'

export const planarFace = (value: number): PlanarFace => (value === 1 ? 'planeswalk' : value === 2 ? 'chaos' : 'blank')

export function faceLabel(die: DieId, value: number): string {
  if (die === 'coin') return value === 1 ? 'Heads' : 'Tails'
  if (die === 'planar') return { planeswalk: 'Planeswalk', chaos: 'Chaos', blank: 'Blank' }[planarFace(value)]
  return String(value)
}

export interface SummaryItem {
  label: string
  value: number
}

/** Totals worth reading at a glance: sum, highest and lowest, or how often each face came up. */
export function summarize({ die, values }: DiceRoll): SummaryItem[] {
  if (die === 'coin') {
    const heads = values.filter((v) => v === 1).length
    return [
      { label: 'Heads', value: heads },
      { label: 'Tails', value: values.length - heads },
    ]
  }
  if (die === 'planar') {
    const faces = values.map(planarFace)
    return [
      { label: 'Planeswalk', value: faces.filter((f) => f === 'planeswalk').length },
      { label: 'Chaos', value: faces.filter((f) => f === 'chaos').length },
    ]
  }
  if (values.length < 2) return []
  return [
    { label: 'Total', value: values.reduce((a, b) => a + b, 0) },
    { label: 'Highest', value: Math.max(...values) },
    { label: 'Lowest', value: Math.min(...values) },
  ]
}

/** Short one-liner for the roll history, e.g. "5 × d20 · Total 52". */
export function describeRoll(roll: DiceRoll): string {
  const die = DIE_BY_ID[roll.die]
  const name = die.numeric ? die.label : die.id === 'coin' ? 'coin' : 'planar die'
  const head = roll.values.length === 1 ? `1 ${name}` : `${roll.values.length} × ${name}`
  const summary = summarize(roll)
  if (summary.length === 0) return `${head} · ${faceLabel(roll.die, roll.values[0])}`
  if (die.numeric) return `${head} · Total ${summary[0].value}`
  if (roll.values.length === 1) return `${head} · ${faceLabel(roll.die, roll.values[0])}`
  return `${head} · ${summary.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}`
}
