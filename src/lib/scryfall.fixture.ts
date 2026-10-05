import type { ScryfallCard } from './cards'
import type { Ruling } from './scryfall'

// Fake Scryfall responses for tests (fields as in the real API).

const creature = (
  name: string,
  mana_cost: string,
  cmc: number,
  power: string,
  toughness: string,
  oracle_text: string,
  type_line = 'Creature — Dinosaur',
  produced_mana?: string[],
): ScryfallCard => ({
  name,
  mana_cost,
  cmc,
  power,
  toughness,
  oracle_text,
  type_line,
  produced_mana,
  image_uris: { small: `https://cards.scryfall.io/small/${encodeURIComponent(name)}.jpg`, normal: `https://cards.scryfall.io/normal/${encodeURIComponent(name)}.jpg` },
  scryfall_uri: `https://scryfall.com/card/${encodeURIComponent(name)}`,
  set: 'fdc',
  set_name: 'Foundations Commander',
  collector_number: String(name.length),
})

const dork = (name: string, cost: string, cmc: number, p: string, t: string, text: string, type = 'Creature — Elf Druid', produced = ['G']) =>
  creature(name, cost, cmc, p, t, text, type, produced)

export const FIXTURE_CARDS: ScryfallCard[] = [
  { name: 'Forest', type_line: 'Basic Land — Forest', mana_cost: '', cmc: 0, oracle_text: '({T}: Add {G}.)', produced_mana: ['G'] },
  { name: 'Rogue\'s Passage', type_line: 'Land', mana_cost: '', cmc: 0, oracle_text: '{T}: Add {C}.\n{4}, {T}: Target creature can\'t be blocked this turn.', produced_mana: ['C'] },
  { name: 'Tranquil Thicket', type_line: 'Land', mana_cost: '', cmc: 0, oracle_text: 'This land enters tapped.\n{T}: Add {G}.\nCycling {G}', produced_mana: ['G'] },
  dork('Llanowar Elves', '{G}', 1, '1', '1', '{T}: Add {G}.'),
  dork('Elvish Mystic', '{G}', 1, '1', '1', '{T}: Add {G}.'),
  dork('Birds of Paradise', '{G}', 1, '0', '1', 'Flying\n{T}: Add one mana of any color.', 'Creature — Bird', ['W', 'U', 'B', 'R', 'G']),
  dork('Llanowar Tribe', '{G}{G}{G}', 3, '3', '3', '{T}: Add {G}{G}{G}.'),
  dork('Ilysian Caryatid', '{1}{G}', 2, '0', '1', '{T}: Add one mana of any color. If you control a creature with power 4 or greater, add two mana of any one color instead.', 'Creature — Plant', ['W', 'U', 'B', 'R', 'G']),
  dork('Whisperer of the Wilds', '{1}{G}', 2, '2', '1', '{T}: Add {G}.\nFerocious — {T}: Add {G}{G}. Activate only if you control a creature with power 4 or greater.', 'Creature — Human Shaman'),
  creature('Steel Leaf Champion', '{G}{G}{G}', 3, '5', '4', 'Steel Leaf Champion can\'t be blocked by creatures with power 2 or less.', 'Creature — Elf Knight'),
  creature('Pugnacious Hammerskull', '{2}{G}', 3, '6', '6', 'Whenever Pugnacious Hammerskull attacks while you don\'t control another Dinosaur, put a stun counter on it.'),
  creature('Gigantosaurus', '{G}{G}{G}{G}{G}', 5, '10', '10', ''),
  creature('Dungrove Elder', '{2}{G}', 3, '*', '*', 'Hexproof\nDungrove Elder\'s power and toughness are each equal to the number of Forests you control.', 'Creature — Treefolk'),
  creature('Carnage Tyrant', '{4}{G}{G}', 6, '7', '6', 'This spell can\'t be countered.\nTrample, hexproof'),
  creature('Ghalta, Primal Hunger', '{10}{G}{G}', 12, '12', '12', 'This spell costs {X} less to cast, where X is the total power of creatures you control.\nTrample', 'Legendary Creature — Elder Dinosaur'),
  { name: 'Sol Ring', type_line: 'Artifact', mana_cost: '{1}', cmc: 1, oracle_text: '{T}: Add {C}{C}.', produced_mana: ['C'] },
  { name: 'Commander\'s Sphere', type_line: 'Artifact', mana_cost: '{3}', cmc: 3, oracle_text: '{T}: Add one mana of any color in your commander\'s color identity.\nSacrifice Commander\'s Sphere: Draw a card.', produced_mana: ['W', 'U', 'B', 'R', 'G'] },
  { name: 'Harmonize', type_line: 'Sorcery', mana_cost: '{2}{G}{G}', cmc: 4, oracle_text: 'Draw three cards.' },
  {
    name: 'Kenrith\'s Transformation',
    type_line: 'Enchantment — Aura',
    mana_cost: '{1}{G}',
    cmc: 2,
    oracle_text: 'Enchant creature\nWhen this Aura enters, draw a card.\nEnchanted creature loses all abilities and is a green Elk creature with base power and toughness 3/3.',
  },
]

/** Real rulings (from Scryfall) for some fixture cards; key = card name in lower case. */
export const FIXTURE_RULINGS: Record<string, Ruling[]> = {
  'ghalta, primal hunger': [
    { date: '2018-01-19', text: "Ghalta's first ability can't reduce its cost below {G}{G}." },
    {
      date: '2018-01-19',
      text: 'The total cost to cast Ghalta is locked in before you pay that cost. For example, if you control three 2/2 creatures, including one you can sacrifice to add {C}, the total cost of Ghalta is {4}{G}{G}.',
    },
  ],
  'steel leaf champion': [
    {
      date: '2018-04-27',
      text: 'Once a creature with power 3 or greater has blocked this creature, changing the power of the blocking creature won’t cause this creature to become unblocked.',
    },
  ],
  'dungrove elder': [
    {
      date: '2011-09-22',
      text: 'Dungrove Elder’s power and toughness are each equal to the number of lands you control with the land type Forest, not necessarily lands named Forest.',
    },
    { date: '2011-09-22', text: 'Dungrove Elder’s power and toughness will change as the number of Forests you control changes.' },
  ],
  'ilysian caryatid': [
    { date: '2020-01-24', text: 'Ilysian Caryatid’s activated ability is a mana ability. It doesn’t use the stack and can’t be responded to.' },
  ],
  'pugnacious hammerskull': [
    {
      date: '2023-11-10',
      text: "If you didn't control another Dinosaur when you declared Pugnacious Hammerskull as an attacker, it doesn't matter whether or not you control one as its ability resolves.",
    },
  ],
  'sol ring': [],
}
