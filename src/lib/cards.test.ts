import { describe, expect, it } from 'vitest'
import { boardPower, costColors, entersTapped, fetchesLand, fromScryfall, manaAbility, parseCost, rampsLand } from './cards'
import { ANY, C, G, payFrom, R, U, W } from './mana'
import { FIXTURE_CARDS } from './scryfall.fixture'

const card = (name: string) => fromScryfall(FIXTURE_CARDS.find((c) => c.name === name)!)

describe('parseCost', () => {
  it('separates generic mana and colored symbols', () => {
    expect(parseCost('{10}{G}{G}')).toEqual({ generic: 10, pips: [G, G], hasX: false })
    expect(parseCost('{X}{G}')).toMatchObject({ pips: [G], hasX: true })
    expect(parseCost('{2}{W}{G/U}')).toMatchObject({ generic: 2, pips: [W, G | U] })
    expect(parseCost('{C}{U/P}{2/R}')).toMatchObject({ generic: 2, pips: [C, U] })
    expect(costColors(parseCost('{U}{U}{U}{R}{R}{R}'))).toBe(U | R)
  })
})

describe('manaAbility', () => {
  it('recognizes Forests, elves, Sol Ring and Llanowar Tribe', () => {
    expect(manaAbility(card('Forest'))).toEqual({ amount: 1, ferociousAmount: 1, mask: G })
    expect(manaAbility(card('Llanowar Elves'))).toMatchObject({ amount: 1, mask: G })
    expect(manaAbility(card('Sol Ring'))).toMatchObject({ amount: 2, mask: C })
    expect(manaAbility(card('Llanowar Tribe'))).toMatchObject({ amount: 3, mask: G })
    expect(manaAbility(card("Rogue's Passage"))).toMatchObject({ amount: 1, mask: C })
    expect(manaAbility(card("Commander's Sphere"))).toMatchObject({ amount: 1, mask: ANY })
  })

  it('reads lands and rocks of other colors', () => {
    expect(manaAbility(card('Island'))).toMatchObject({ amount: 1, mask: U })
    expect(manaAbility(card('Spirebluff Canal'))).toMatchObject({ amount: 1, mask: U | R })
    expect(manaAbility(card('Command Tower'))).toMatchObject({ amount: 1, mask: ANY })
    expect(manaAbility(card('Arcane Signet'))).toMatchObject({ amount: 1, mask: ANY })
  })

  it('knows the ferocious bonus (creature with power 4+)', () => {
    expect(manaAbility(card('Ilysian Caryatid'))).toEqual({ amount: 1, ferociousAmount: 2, mask: ANY })
    expect(manaAbility(card('Whisperer of the Wilds'))).toEqual({ amount: 1, ferociousAmount: 2, mask: G })
  })

  it('returns null for cards without a mana ability', () => {
    expect(manaAbility(card('Steel Leaf Champion'))).toBeNull()
    expect(manaAbility(card('Harmonize'))).toBeNull()
    expect(manaAbility(card('Evolving Wilds'))).toBeNull()
  })

  it('knows lands and spells that fetch a land', () => {
    expect(fetchesLand(card('Evolving Wilds'))).toBe(true)
    expect(fetchesLand(card('Forest'))).toBe(false)
    expect(rampsLand(card('Cultivate'))).toEqual({ tapped: true })
    expect(rampsLand(card('Harmonize'))).toBeNull()
  })
})

describe('payFrom', () => {
  it('pays colored symbols with the right sources and generic with the rest', () => {
    expect(payFrom([U, U, R, C], 1, [U, U, R])).toEqual([])
    expect(payFrom([U, R], 0, [U, U])).toBeNull()
    // The "any color" source is saved for the symbol only it can pay.
    expect(payFrom([ANY, R, U], 0, [U | R, G])).toEqual([U])
    // Colorless {C} only from colorless sources.
    expect(payFrom([G, G], 0, [C])).toBeNull()
    expect(payFrom([G, ANY, C], 1, [G])).toEqual([ANY])
  })
})

describe('reading cards', () => {
  it('converts power, type and images', () => {
    const ghalta = card('Ghalta, Primal Hunger')
    expect(ghalta).toMatchObject({ power: 12, cmc: 12, typeLine: 'Legendary Creature — Elder Dinosaur' })
    expect(ghalta.image).toContain('cards.scryfall.io/small')
  })

  it("computes Dungrove Elder's * power from the Forests", () => {
    expect(boardPower(card('Dungrove Elder'), 5)).toBe(5)
    expect(boardPower(card('Steel Leaf Champion'), 5)).toBe(5)
  })

  it('recognizes lands that enter tapped', () => {
    expect(entersTapped(card('Tranquil Thicket'))).toBe(true)
    expect(entersTapped(card('Forest'))).toBe(false)
  })

  it('takes the front face of double-faced cards', () => {
    const c = fromScryfall({
      name: 'Front // Back',
      cmc: 3,
      card_faces: [
        { name: 'Front', type_line: 'Creature — Wolf', mana_cost: '{2}{G}', power: '4', toughness: '4', image_uris: { small: 's.jpg' } },
        { name: 'Back', type_line: 'Land' },
      ],
    })
    expect(c).toMatchObject({ power: 4, typeLine: 'Creature — Wolf', manaCost: '{2}{G}', image: 's.jpg' })
  })
})
