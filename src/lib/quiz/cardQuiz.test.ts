import { describe, expect, it } from 'vitest'
import { fromScryfall, type ScryfallCard } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { mulberry32 } from '../sim/rng'
import { classify, costVariants, findGap, frameOf, GAP, hideSelfName, ptVariants } from './cardQuiz'

const card = (name: string) => fromScryfall(FIXTURE_CARDS.find((c) => c.name === name)!)
const make = (raw: Partial<ScryfallCard> & { name: string }) => fromScryfall({ cmc: 0, mana_cost: '', type_line: 'Instant', oracle_text: '', ...raw })

describe('classify (role in the gameplan)', () => {
  it('recognizes lands, ramp and big creatures', () => {
    expect(classify(card('Forest'))).toMatchObject({ role: 'land', confident: true })
    expect(classify(card('Llanowar Elves'))).toMatchObject({ role: 'ramp', confident: true })
    expect(classify(card('Sol Ring'))).toMatchObject({ role: 'ramp', confident: true })
    expect(classify(card('Steel Leaf Champion'))).toMatchObject({ role: 'big', confident: true })
    expect(classify(card('Gigantosaurus'))).toMatchObject({ role: 'big', confident: true })
  })

  it('recognizes card advantage, interaction, protection and finishers', () => {
    expect(classify(card('Harmonize'))).toMatchObject({ role: 'draw', confident: true })
    expect(classify(make({ name: 'Beast Within', oracle_text: 'Destroy target permanent. Its controller creates a 3/3 green Beast creature token.' }))).toMatchObject({ role: 'removal', confident: true })
    expect(classify(make({ name: "Tamiyo's Safekeeping", oracle_text: 'Target permanent you control gains hexproof and indestructible until end of turn. You gain 2 life.' }))).toMatchObject({ role: 'protection', confident: true })
    expect(classify(make({ name: 'Overwhelming Stampede', type_line: 'Sorcery', oracle_text: 'Until end of turn, creatures you control gain trample and get +X/+X, where X is the greatest power among creatures you control.' }))).toMatchObject({ role: 'finisher', confident: true })
  })

  it('is not confident when several roles fit', () => {
    // Kenrith's Transformation: interaction and card advantage.
    expect(classify(card("Kenrith's Transformation")).confident).toBe(false)
  })
})

describe('findGap', () => {
  const rng = () => mulberry32(3)

  it('hides a number word and offers neighboring ones', () => {
    const gap = findGap('Draw three cards.', rng())!
    expect(gap.text).toBe(`Draw ${GAP} cards.`)
    expect(gap.answer).toBe('three')
    expect(gap.wrong).not.toContain('three')
  })

  it('hides mana in “Add {G}{G}{G}”', () => {
    const gap = findGap('{T}: Add {G}{G}{G}.', rng())!
    expect(gap.answer).toBe('{G}{G}{G}')
    expect(gap.text).toBe(`{T}: Add ${GAP}.`)
  })

  it('hides keywords and only offers other ones', () => {
    const gap = findGap('Trample', rng())!
    expect(gap.answer).toBe('Trample')
    expect(gap.wrong).not.toContain('Trample')
  })

  it('returns null when there is nothing meaningful', () => {
    expect(findGap('', rng())).toBeNull()
  })
})

describe('Variants', () => {
  it('creates plausible, different mana costs', () => {
    const v = costVariants('{2}{G}{G}')
    expect(v).not.toContain('{2}{G}{G}')
    expect(v).toContain('{3}{G}{G}')
    expect(v.length).toBeGreaterThanOrEqual(3)
    expect(costVariants('{G}')).not.toContain('')
  })

  it('works for other colors and offers the wrong color as a trap', () => {
    const v = costVariants('{2}{U}{U}')
    expect(v).toContain('{3}{U}{U}')
    expect(v).toContain('{2}{U}{U}{U}')
    expect(v).toContain('{2}{B}{B}')
    expect(costVariants('{U}{R}')).toContain('{1}{R}')
    expect(costVariants('{X}{R}')).toContain('{X}{1}{R}')
  })

  it('draws the frame in the card’s color', () => {
    expect(frameOf(card('Counterspell'))).toBe('blue')
    expect(frameOf(card('Lightning Bolt'))).toBe('red')
    expect(frameOf(card('Izzet Charm'))).toBe('multi')
    expect(frameOf(card('Sol Ring'))).toBe('artifact')
    expect(frameOf(card('Island'))).toBe('land')
    expect(frameOf(card('Harmonize'))).toBe('green')
  })

  it('creates different power/toughness values', () => {
    const v = ptVariants('5/4')
    expect(v).toContain('4/5')
    expect(v).not.toContain('5/4')
  })

  it('hides the card name and its short form in the text', () => {
    expect(hideSelfName("Rhonas can't attack unless …", 'Rhonas the Indomitable')).toBe("~ can't attack unless …")
    expect(hideSelfName('Dungrove Elder has hexproof.', 'Dungrove Elder')).toBe('~ has hexproof.')
  })
})
