import { describe, expect, it } from 'vitest'
import { boardPower, entersTapped, fromScryfall, manaAbility, parseCost } from './cards'
import { FIXTURE_CARDS } from './scryfall.fixture'

const card = (name: string) => fromScryfall(FIXTURE_CARDS.find((c) => c.name === name)!)

describe('parseCost', () => {
  it('separates generic and green mana', () => {
    expect(parseCost('{10}{G}{G}')).toEqual({ generic: 10, green: 2, otherColors: 0, hasX: false })
    expect(parseCost('{X}{G}')).toMatchObject({ green: 1, hasX: true })
    expect(parseCost('{2}{W}{G/U}')).toMatchObject({ generic: 2, green: 1, otherColors: 1 })
  })
})

describe('manaAbility', () => {
  it('recognizes Forests, elves, Sol Ring and Llanowar Tribe', () => {
    expect(manaAbility(card('Forest'))).toEqual({ amount: 1, ferociousAmount: 1, green: true })
    expect(manaAbility(card('Llanowar Elves'))).toMatchObject({ amount: 1, green: true })
    expect(manaAbility(card('Sol Ring'))).toMatchObject({ amount: 2, green: false })
    expect(manaAbility(card('Llanowar Tribe'))).toMatchObject({ amount: 3, green: true })
    expect(manaAbility(card("Rogue's Passage"))).toMatchObject({ amount: 1, green: false })
    expect(manaAbility(card("Commander's Sphere"))).toMatchObject({ amount: 1, green: true })
  })

  it('knows the ferocious bonus (creature with power 4+)', () => {
    expect(manaAbility(card('Ilysian Caryatid'))).toEqual({ amount: 1, ferociousAmount: 2, green: true })
    expect(manaAbility(card('Whisperer of the Wilds'))).toEqual({ amount: 1, ferociousAmount: 2, green: true })
  })

  it('returns null for cards without a mana ability', () => {
    expect(manaAbility(card('Steel Leaf Champion'))).toBeNull()
    expect(manaAbility(card('Harmonize'))).toBeNull()
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
