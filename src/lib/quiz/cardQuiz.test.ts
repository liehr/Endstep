import { describe, expect, it } from 'vitest'
import { fromScryfall, type ScryfallCard } from '../cards'
import { FIXTURE_CARDS } from '../scryfall.fixture'
import { mulberry32 } from '../sim/rng'
import { classify, costVariants, findGap, GAP, hideSelfName, ptVariants } from './cardQuiz'

const card = (name: string) => fromScryfall(FIXTURE_CARDS.find((c) => c.name === name)!)
const make = (raw: Partial<ScryfallCard> & { name: string }) => fromScryfall({ cmc: 0, mana_cost: '', type_line: 'Instant', oracle_text: '', ...raw })

describe('classify (Rolle im Gameplan)', () => {
  it('erkennt Länder, Ramp und dicke Kreaturen', () => {
    expect(classify(card('Forest'))).toMatchObject({ role: 'land', confident: true })
    expect(classify(card('Llanowar Elves'))).toMatchObject({ role: 'ramp', confident: true })
    expect(classify(card('Sol Ring'))).toMatchObject({ role: 'ramp', confident: true })
    expect(classify(card('Steel Leaf Champion'))).toMatchObject({ role: 'big', confident: true })
    expect(classify(card('Gigantosaurus'))).toMatchObject({ role: 'big', confident: true })
  })

  it('erkennt Kartenvorteil, Interaktion, Schutz und Finisher', () => {
    expect(classify(card('Harmonize'))).toMatchObject({ role: 'draw', confident: true })
    expect(classify(make({ name: 'Beast Within', oracle_text: 'Destroy target permanent. Its controller creates a 3/3 green Beast creature token.' }))).toMatchObject({ role: 'removal', confident: true })
    expect(classify(make({ name: "Tamiyo's Safekeeping", oracle_text: 'Target permanent you control gains hexproof and indestructible until end of turn. You gain 2 life.' }))).toMatchObject({ role: 'protection', confident: true })
    expect(classify(make({ name: 'Overwhelming Stampede', type_line: 'Sorcery', oracle_text: 'Until end of turn, creatures you control gain trample and get +X/+X, where X is the greatest power among creatures you control.' }))).toMatchObject({ role: 'finisher', confident: true })
  })

  it('ist unsicher, wenn mehrere Rollen passen', () => {
    // Kenrith's Transformation: Interaktion und Kartenvorteil.
    expect(classify(card("Kenrith's Transformation")).confident).toBe(false)
  })
})

describe('findGap', () => {
  const rng = () => mulberry32(3)

  it('versteckt ein Zahlwort und bietet benachbarte an', () => {
    const gap = findGap('Draw three cards.', rng())!
    expect(gap.text).toBe(`Draw ${GAP} cards.`)
    expect(gap.answer).toBe('three')
    expect(gap.wrong).not.toContain('three')
  })

  it('versteckt Mana in „Add {G}{G}{G}“', () => {
    const gap = findGap('{T}: Add {G}{G}{G}.', rng())!
    expect(gap.answer).toBe('{G}{G}{G}')
    expect(gap.text).toBe(`{T}: Add ${GAP}.`)
  })

  it('versteckt Schlüsselwörter und bietet nur andere an', () => {
    const gap = findGap('Trample', rng())!
    expect(gap.answer).toBe('Trample')
    expect(gap.wrong).not.toContain('Trample')
  })

  it('liefert null, wenn es nichts Sinnvolles gibt', () => {
    expect(findGap('', rng())).toBeNull()
  })
})

describe('Varianten', () => {
  it('erzeugt plausible, andere Manakosten', () => {
    const v = costVariants('{2}{G}{G}')
    expect(v).not.toContain('{2}{G}{G}')
    expect(v).toContain('{3}{G}{G}')
    expect(v.length).toBeGreaterThanOrEqual(3)
    expect(costVariants('{G}')).not.toContain('')
  })

  it('erzeugt andere Stärke/Widerstand-Werte', () => {
    const v = ptVariants('5/4')
    expect(v).toContain('4/5')
    expect(v).not.toContain('5/4')
  })

  it('versteckt den Kartennamen und seine Kurzform im Text', () => {
    expect(hideSelfName("Rhonas can't attack unless …", 'Rhonas the Indomitable')).toBe("~ can't attack unless …")
    expect(hideSelfName('Dungrove Elder has hexproof.', 'Dungrove Elder')).toBe('~ has hexproof.')
  })
})
