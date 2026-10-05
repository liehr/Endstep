import { isCreature } from '../cards'
import { isGhalta } from '../commander'
import { ghaltaCost, GHALTA_GENERIC } from '../ghalta'
import { shuffle, type Rng } from '../sim/rng'
import { choice, int, ordered, pick, type Question, type QuizContext } from './question'

/** “an 8/8”, “an 11/11”, “a 3/3”. */
const an = (n: number) => (n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90) ? 'an' : 'a')

// More Ghalta Math: many small question types around the cost reduction, commander tax
// and timing. Built from the creatures in your deck; made-up creatures if there are too few.

interface Body {
  /** Card name, or e.g. “a 3/3 creature” for a made-up one. */
  name: string
  power: number
  pt: string
  cmc: number
  real: boolean
  /** Fine as “a creature you cast from your hand” (no X, no own cost reduction). */
  castable: boolean
}

interface Kit {
  rng: Rng
  /** Creatures from your deck; empty when there are too few with data. */
  deck: Body[]
}

const costLabel = (power: number, casts: number) => ghaltaCost(power, casts).label
const genericOf = (power: number, casts: number) => ghaltaCost(power, casts).generic
const beforeReduction = (casts: number) => GHALTA_GENERIC + 2 * casts
const sum = (board: Body[]) => board.reduce((s, b) => s + b.power, 0)
const capital = (s: string) => s[0].toUpperCase() + s.slice(1)
const join = (...parts: string[]) => parts.filter(Boolean).join(' ')
const pickCasts = (rng: Rng) => pick([0, 0, 0, 1, 1, 2, 3], rng)
const nums = (values: number[]) => values.filter((v) => v >= 0).map(String)

function castLine(casts: number): string {
  if (casts === 0) return 'Ghalta hasn’t been cast from the command zone yet.'
  if (casts === 1) return 'Ghalta has been cast from the command zone once before.'
  return `Ghalta has been cast from the command zone ${casts} times before.`
}

/** “10 + 4 tax = 14, minus 9 power → 5GG” */
function mathText(power: number, casts: number): string {
  const before = beforeReduction(casts)
  const start = casts ? `10 + ${2 * casts} tax = ${before}` : '10 generic'
  const capped = power > before ? ' (it can’t go below GG)' : ''
  return `${start}, minus ${power} power → ${costLabel(power, casts)}${capped}`
}

function deckBodies(ctx: QuizContext): Body[] {
  const seen = new Set<string>()
  const out: Body[] = []
  for (const e of ctx.decklist) {
    const c = ctx.lookup(e.name)
    if (!c || !isCreature(c) || c.power === null || seen.has(c.name) || isGhalta(c.name)) continue
    seen.add(c.name)
    const castable = c.cmc > 0 && !/\{X\}/.test(c.manaCost) && !/less to cast|convoke|affinity|improvise|delve/i.test(c.oracleText)
    out.push({ name: c.name, power: c.power, pt: `${c.powerText}/${c.toughness ?? '?'}`, cmc: c.cmc, real: true, castable })
  }
  return out
}

function fake(rng: Rng): Body {
  const p = int(1, 6, rng)
  const t = p + pick([0, 0, 1, 2], rng)
  const cmc = Math.max(1, Math.min(7, p + pick([-2, -1, 0, 0, 1, 2], rng)))
  return { name: `${an(p)} ${p}/${t} creature`, power: p, pt: `${p}/${t}`, cmc, real: false, castable: true }
}

/** Your board: min..max creatures from the deck (or made up). */
function draw(kit: Kit, min: number, max: number, exclude: Body[] = []): Body[] {
  const n = int(min, max, kit.rng)
  const free = kit.deck.filter((b) => !exclude.includes(b))
  if (free.length >= n) return shuffle(free, kit.rng).slice(0, n)
  return Array.from({ length: n }, () => fake(kit.rng))
}

/** Creatures in your hand with distinct labels. */
function drawHand(kit: Kit, n: number, exclude: Body[]): Body[] {
  const free = kit.deck.filter((b) => b.castable && !exclude.includes(b))
  if (free.length >= n) return shuffle(free, kit.rng).slice(0, n)
  const out: Body[] = []
  while (out.length < n) {
    const b = fake(kit.rng)
    if (!out.some((o) => handLabel(o) === handLabel(b))) out.push(b)
  }
  return out
}

const handLabel = (b: Body) => (b.real ? `${b.name} (${b.cmc} mana, ${b.pt})` : `${b.name} (${b.cmc} mana)`)
/** How a creature is named inside a sentence: “Llanowar Elves” or “your 3/3 creature”. */
const refer = (b: Body) => (b.real ? b.name : `your ${b.pt} creature`)

/** Real creatures as cards; made-up ones as a sentence in the context. */
function show(board: Body[], label = 'Your creatures on the battlefield') {
  if (board.every((b) => b.real)) {
    return { text: '', view: { cardsLabel: label, cards: board.map((b) => ({ name: b.name, caption: b.pt })) } }
  }
  return { text: `On your battlefield: ${board.map((b) => b.name).join(', ')}.`, view: {} }
}

// --- Question types ------------------------------------------------------------------

function fitsQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const board = draw(kit, 1, 4)
  const casts = pickCasts(rng)
  const power = sum(board)
  const total = ghaltaCost(power, casts).total
  const mana = Math.max(2, total + pick([-2, -1, -1, 0, 0, 1, 2], rng))
  const yes = mana >= total
  const shown = show(board)
  return {
    id: `ghalta-fits-${n}`,
    key: `ghalta-fits:${casts}:${power}:${mana}`,
    prompt: pick(['Can you cast Ghalta this turn?', 'Is that enough mana for Ghalta?', 'Does Ghalta fit this turn?'], rng),
    context: join(shown.text, castLine(casts), `You have ${mana} mana available, including GG.`),
    ...shown.view,
    ...ordered(['Yes', 'No'], yes ? 0 : 1),
    explanation: `${mathText(power, casts)}, that’s ${total} mana in total. You have ${mana}, so ${yes ? 'it fits' : `you’re ${total - mana} short`}.`,
  }
}

function firstQuestion(kit: Kit, n: number): Question | null {
  const { rng } = kit
  for (let attempt = 0; attempt < 40; attempt++) {
    const board = draw(kit, 1, 3)
    const hand = drawHand(kit, 3, board)
    const casts = pickCasts(rng)
    const power = sum(board)
    const direct = ghaltaCost(power, casts).total
    const needs = hand.map((h) => h.cmc + ghaltaCost(power + h.power, casts).total)
    const mana = Math.min(...needs)
    if (needs.filter((x) => x === mana).length !== 1 || mana >= direct) continue
    const best = needs.indexOf(mana)
    const labels = hand.map(handLabel)
    const shown = show(board)
    const lines = hand.map((h, j) => `${h.real ? h.name : `The ${h.pt}`}: ${h.cmc} + ${costLabel(power + h.power, casts)} = ${needs[j]}`)
    return {
      id: `ghalta-first-${n}`,
      key: `ghalta-first:${casts}:${power}:${mana}:${hand.map((h) => `${h.cmc}/${h.power}`).sort().join(',')}`,
      prompt: pick(['Which creature do you cast first so Ghalta still fits this turn?', 'Which creature from your hand gets Ghalta out this turn?'], rng),
      context: join(shown.text, castLine(casts), `You have ${mana} mana (any color); the new creature can’t tap for mana yet.`),
      ...shown.view,
      ...choice(rng, labels[best], [...labels.filter((_, j) => j !== best), 'None – cast Ghalta right away']),
      explanation: `${lines.join('. ')}. Ghalta alone costs ${costLabel(power, casts)} = ${direct}. Only one fits into ${mana}.`,
    }
  }
  return null
}

function reverseQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const casts = pickCasts(rng)
  const before = beforeReduction(casts)
  const generic = int(1, before - 1, rng)
  const power = before - generic
  const label = `${generic}GG`
  const wrong = nums([casts ? 10 - generic : power + 2, power + 2, power - 2, generic, power + 1, power - 1])
  return {
    id: `ghalta-reverse-${n}`,
    key: `ghalta-reverse:${casts}:${generic}`,
    prompt: pick([`Ghalta costs ${label} right now. How much total power do you control?`, `Your board makes Ghalta cost ${label}. What’s the total power of your creatures?`], rng),
    context: castLine(casts),
    ...choice(rng, String(power), wrong),
    explanation: `Before the reduction Ghalta costs ${casts ? `10 + ${2 * casts} tax = ${before}` : '10'} generic. ${before} − ${generic} = ${power} power.`,
  }
}

type Zone = 'cz' | 'hand' | 'gy'

function taxStoryQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const steps = int(2, 4, rng)
  let zone: Zone = 'cz'
  let czCasts = 0
  let allCasts = 0
  let turn = int(3, 6, rng)
  const lines: string[] = []
  const codes: string[] = []
  for (let s = 0; s < steps; s++) {
    const next: Zone = s === steps - 1 ? 'cz' : pick<Zone>(['cz', 'cz', 'hand', 'gy'], rng)
    const enter =
      zone === 'cz' ? 'you cast Ghalta from the command zone' : zone === 'hand' ? 'you cast Ghalta from your hand' : 'a reanimation spell put Ghalta from your graveyard onto the battlefield'
    const leave =
      next === 'cz'
        ? `${pick(['it died', 'it was exiled', 'it was destroyed'], rng)}, and you moved it to the command zone`
        : next === 'hand'
          ? 'an opponent returned it to your hand, and you kept it there'
          : 'it died, and you left it in your graveyard'
    if (zone === 'cz') czCasts++
    if (zone !== 'gy') allCasts++
    lines.push(`Turn ${turn}: ${enter}; ${leave}.`)
    codes.push(`${zone}>${next}`)
    turn += int(1, 3, rng)
    zone = next
  }
  const rule = 'Only casts from the command zone add tax (+2 each); casting from your hand or putting it onto the battlefield without casting doesn’t.'
  const base = { id: `ghalta-tax-story-${n}`, context: lines.join(' ') }
  if (rng() < 0.5) {
    const tax = (k: number) => `+${2 * k}`
    return {
      ...base,
      key: `ghalta-tax-story:tax:${codes.join(',')}`,
      prompt: 'How much commander tax does Ghalta’s next cast from the command zone add?',
      ...choice(rng, tax(czCasts), [tax(allCasts), tax(steps), tax(czCasts + 1), tax(czCasts - 1)]),
      explanation: `${rule} ${czCasts} cast${czCasts > 1 ? 's' : ''} from the command zone → ${tax(czCasts)}.`,
    }
  }
  const power = int(0, 9, rng)
  return {
    ...base,
    key: `ghalta-tax-story:cost:${codes.join(',')}:${power}`,
    context: `${base.context} You control ${power} total power.`,
    prompt: 'What does Ghalta cost now from the command zone?',
    ...choice(rng, costLabel(power, czCasts), [costLabel(power, allCasts), costLabel(power, steps), costLabel(power, czCasts + 1), costLabel(power, czCasts - 1)]),
    explanation: `${rule} ${czCasts} cast${czCasts > 1 ? 's' : ''} from the command zone: ${mathText(power, czCasts)}.`,
  }
}

function savingsQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const board = draw(kit, 1, 5)
  const casts = pickCasts(rng)
  const power = sum(board)
  const before = beforeReduction(casts)
  const saved = Math.min(power, before)
  const shown = show(board)
  return {
    id: `ghalta-savings-${n}`,
    key: `ghalta-savings:${casts}:${power}`,
    prompt: pick(['How much mana does your board save on Ghalta?', 'By how much does your board reduce Ghalta’s cost?'], rng),
    context: join(shown.text, castLine(casts)),
    ...shown.view,
    ...choice(rng, String(saved), nums([power, before, saved + 2, saved - 2, saved + 1, saved - 1])),
    explanation:
      power > before
        ? `You have ${power} power, but only the ${before} generic can be reduced: you save ${saved}, Ghalta costs GG.`
        : `Every point of power saves one generic mana: ${power} power saves ${saved}. ${mathText(power, casts)}.`,
  }
}

function cheapestQuestion(kit: Kit, n: number): Question | null {
  const { rng } = kit
  for (let attempt = 0; attempt < 40; attempt++) {
    const casts = pickCasts(rng)
    const boards = [0, 1, 2].map(() => draw(kit, 1, 3))
    const labels = boards.map((b) =>
      b[0].real
        ? b.map((x) => x.name).sort().join(' + ')
        : b
            .map((x) => x.pt)
            .sort()
            .join(' + '),
    )
    if (new Set(labels).size !== 3) continue
    const generics = boards.map((b) => genericOf(sum(b), casts))
    const best = Math.min(...generics)
    if (generics.filter((g) => g === best).length !== 1) continue
    const i = generics.indexOf(best)
    const all = [...new Map(boards.flat().map((b) => [b.name, b])).values()]
    const real = all.every((b) => b.real)
    return {
      id: `ghalta-cheapest-${n}`,
      key: `ghalta-cheapest:${casts}:${[...labels].sort().join('|')}`,
      prompt: pick(['Which board makes Ghalta cheapest?', 'With which of these boards is Ghalta cheapest?'], rng),
      context: castLine(casts),
      ...(real ? { cardsLabel: 'Creatures in these boards', cards: all.map((b) => ({ name: b.name, caption: b.pt })) } : {}),
      ...choice(
        rng,
        labels[i],
        labels.filter((_, j) => j !== i),
      ),
      explanation: `${boards.map((b, j) => `${labels[j]}: ${sum(b)} power → ${costLabel(sum(b), casts)}`).join('. ')}.`,
    }
  }
  return null
}

function missingQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const board = draw(kit, 1, 3)
  const casts = pickCasts(rng)
  const power = sum(board)
  const before = beforeReduction(casts)
  const missing = Math.max(0, before - power)
  const shown = show(board)
  return {
    id: `ghalta-missing-${n}`,
    key: `ghalta-missing:${casts}:${power}`,
    prompt: pick(['How much more power do you need for Ghalta to cost only GG?', 'How much power is missing until Ghalta costs just GG?'], rng),
    context: join(shown.text, castLine(casts)),
    ...shown.view,
    ...choice(rng, String(missing), nums([10 - power, missing + 2, missing - 2, before + 2 - power, missing + 1])),
    explanation: `You need ${before} power${casts ? ` (10 + ${2 * casts} tax)` : ''}. You have ${power}, so ${missing ? `${missing} more` : 'nothing more: it already costs GG'}.`,
  }
}

function responseQuestion(kit: Kit, n: number): Question | null {
  const { rng } = kit
  for (let attempt = 0; attempt < 20; attempt++) {
    const board = draw(kit, 2, 4)
    const victims = board.filter((b) => b.power > 0)
    if (victims.length === 0) continue
    const victim = pick(victims, rng)
    const casts = pickCasts(rng)
    const power = sum(board)
    const after = power - victim.power
    const shown = show(board)
    const changes = costLabel(power, casts) !== costLabel(after, casts)
    const variant = changes ? pick(['what', 'paid', 'before'] as const, rng) : 'what'
    // A bounced creature could be recast before Ghalta, so “before” only destroys or exiles.
    const verbs = [`destroys ${refer(victim)}`, `exiles ${refer(victim)}`]
    const removal = pick(variant === 'before' ? verbs : [...verbs, `returns ${refer(victim)} to your hand`], rng)
    const key = `ghalta-response:${variant}:${casts}:${power}:${victim.power}`
    const base = { id: `ghalta-response-${n}`, key, ...shown.view }
    const locked = 'The total cost is locked in while you cast Ghalta; removing a creature afterwards changes nothing.'
    const spare = [costLabel(power, casts + 1), `${genericOf(power, casts) + 2}GG`, costLabel(after, casts + 1)]
    if (variant === 'what') {
      return {
        ...base,
        context: join(shown.text, castLine(casts), `You cast Ghalta and pay ${costLabel(power, casts)}. In response, an opponent ${removal}.`),
        prompt: 'What happens to Ghalta?',
        ...choice(rng, 'It resolves as normal', [`You pay ${victim.power} more or it’s countered`, 'It’s countered', 'It goes back to the command zone']),
        explanation: `${locked} Ghalta resolves.`,
      }
    }
    if (variant === 'paid') {
      return {
        ...base,
        context: join(shown.text, castLine(casts), `You cast Ghalta. In response, an opponent ${removal}.`),
        prompt: 'How much did Ghalta cost you?',
        ...choice(rng, costLabel(power, casts), [costLabel(after, casts), ...spare]),
        explanation: `${locked} ${mathText(power, casts)}.`,
      }
    }
    return {
      ...base,
      context: join(shown.text, castLine(casts), `During your upkeep, an opponent ${removal}.`),
      prompt: 'What does Ghalta cost in your main phase?',
      ...choice(rng, costLabel(after, casts), [costLabel(power, casts), ...spare]),
      explanation: `That creature is gone before you cast Ghalta, so it doesn’t count: ${power} − ${victim.power} = ${after} power. ${mathText(after, casts)}.`,
    }
  }
  return null
}

function boostQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const board = draw(kit, 1, 3)
  const casts = pickCasts(rng)
  const power = sum(board)
  const target = pick(board, rng)
  const kind = pick(['counters', 'pump', 'tokens', 'token', 'anthem'] as const, rng)
  let bonus: number
  let text: string
  if (kind === 'counters') {
    bonus = int(1, 3, rng)
    text = `${capital(refer(target))} has ${bonus} +1/+1 counter${bonus > 1 ? 's' : ''} on it (not in the P/T shown).`
  } else if (kind === 'pump') {
    bonus = pick([2, 3, 4], rng)
    text = `Before casting Ghalta, you give ${refer(target)} +${bonus}/+${bonus} until end of turn.`
  } else if (kind === 'tokens') {
    bonus = int(2, 4, rng)
    text = `Before casting Ghalta, you create ${bonus} 1/1 creature tokens.`
  } else if (kind === 'token') {
    bonus = int(2, 5, rng)
    text = `Before casting Ghalta, you create ${an(bonus)} ${bonus}/${bonus} creature token.`
  } else {
    bonus = board.length
    text = 'Before casting Ghalta, you cast a spell that gives each creature you control +1/+1 until end of turn.'
  }
  const total = power + bonus
  const shown = show(board)
  const generic = genericOf(total, casts)
  return {
    id: `ghalta-boost-${n}`,
    key: `ghalta-boost:${kind}:${casts}:${power}:${bonus}`,
    prompt: pick(['What does Ghalta cost now?', 'What do you pay for Ghalta?'], rng),
    context: join(shown.text, castLine(casts), text),
    ...shown.view,
    ...choice(rng, costLabel(total, casts), [costLabel(power, casts), `${generic + 2}GG`, costLabel(total + bonus, casts), costLabel(total, casts + 1)]),
    explanation: `Ghalta counts the power at the moment you cast it: ${power} + ${bonus} = ${total} power. ${mathText(total, casts)}.`,
  }
}

const COUNTS_TRUE: ((x: string, X: string) => string)[] = [
  (x) => `Your tapped ${x}`,
  (_, X) => `${X} you cast this turn`,
  (_, X) => `${X} that attacked this turn`,
  () => 'A 2/2 creature token you control',
  () => 'An opponent’s creature you gained control of',
  () => 'Your Vehicle, crewed this turn',
]
const COUNTS_FALSE: ((p: number) => string)[] = [
  (p) => `An opponent’s ${p}/${p} creature`,
  () => 'A creature card in your hand',
  () => 'A creature card in your graveyard',
  () => 'Your Vehicle that isn’t crewed',
  () => 'Your creature an opponent gained control of',
  () => 'A 0/4 creature you control',
  () => 'Ghalta’s own 12 power',
]

function countsQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const own = kit.deck.filter((b) => b.power > 0)
  const body = own.length ? pick(own, rng) : null
  const x = body ? body.name : `${int(2, 6, rng)}/${int(2, 6, rng)} creature`
  const X = body ? body.name : `A ${x}`
  const big = int(5, 9, rng)
  const does = rng() < 0.6
  const trues = shuffle(COUNTS_TRUE.map((f, i) => [i, f(x, X)] as const), rng)
  const falses = shuffle(COUNTS_FALSE.map((f, i) => [i, f(big)] as const), rng)
  const [right, wrongs] = does ? [trues[0], falses.slice(0, 3)] : [falses[0], trues.slice(0, 3)]
  return {
    id: `ghalta-counts-${n}`,
    key: `ghalta-counts:${does ? 'does' : 'not'}:${right[0]}:${wrongs.map((w) => w[0]).sort().join(',')}`,
    prompt: does ? pick(['Which of these lowers Ghalta’s cost?', 'Which one counts toward Ghalta’s reduction?'], rng) : 'Which of these does NOT lower Ghalta’s cost?',
    ...choice(
      rng,
      right[1],
      wrongs.map((w) => w[1]),
    ),
    explanation: `Only creatures you control on the battlefield count, tapped or summoning-sick ones too. Cards in hand or graveyard, opponents’ creatures, uncrewed Vehicles, 0-power creatures and Ghalta itself add nothing. “${right[1]}” ${does ? 'counts' : 'doesn’t'}.`,
  }
}

function handSetup(kit: Kit) {
  const board = draw(kit, 1, 3)
  const card = drawHand(kit, 1, board)[0]
  const casts = pickCasts(kit.rng)
  return { board, card, casts, power: sum(board), shown: show(board) }
}

function turnManaQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const { card, casts, power, shown } = handSetup(kit)
  const ghalta = ghaltaCost(power + card.power, casts).total
  const total = card.cmc + ghalta
  const without = ghaltaCost(power, casts).total
  return {
    id: `ghalta-turn-mana-${n}`,
    key: `ghalta-turn-mana:${casts}:${power}:${card.cmc}:${card.power}`,
    prompt: 'You cast that creature first, then Ghalta. How much mana do you need in total?',
    context: join(shown.text, castLine(casts), `In your hand: ${handLabel(card)}.`),
    ...shown.view,
    ...choice(rng, String(total), nums([card.cmc + without, ghalta, total + 2, total - 2, total + 1])),
    explanation: `The creature costs ${card.cmc}. Then you have ${power + card.power} power: ${mathText(power + card.power, casts)} = ${ghalta}. Total ${card.cmc} + ${ghalta} = ${total}.`,
  }
}

function orderQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const { card, casts, power, shown } = handSetup(kit)
  const first = genericOf(power + card.power, casts)
  const later = genericOf(power, casts)
  const saved = later - first
  return {
    id: `ghalta-order-${n}`,
    key: `ghalta-order:${casts}:${power}:${card.power}`,
    prompt: 'How much mana do you save by casting that creature before Ghalta instead of after?',
    context: join(shown.text, castLine(casts), `In your hand: ${handLabel(card)}.`),
    ...shown.view,
    ...choice(rng, String(saved), nums([card.power, card.cmc, 0, saved + 1, saved + 2, saved - 1])),
    explanation: `After: Ghalta costs ${costLabel(power, casts)}. Before: ${power + card.power} power, so ${costLabel(power + card.power, casts)}. You save ${saved}${saved < card.power ? ' (Ghalta can’t go below GG)' : ''}.`,
  }
}

function ggCastsQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  let board: Body[] | null = null
  for (let attempt = 0; attempt < 10 && !board; attempt++) {
    const b = draw(kit, 2, 5)
    if (b.every((x) => x.real) && sum(b) >= 10 && sum(b) <= 21) board = b
  }
  const power = board ? sum(board) : int(10, 19, rng)
  const answer = Math.floor((power - 10) / 2)
  return {
    id: `ghalta-gg-casts-${n}`,
    key: `ghalta-gg-casts:${power}`,
    prompt: 'Up to how many earlier casts from the command zone does Ghalta still cost only GG?',
    ...(board ? show(board).view : { context: `Your creatures have ${power} total power.` }),
    ...choice(rng, String(answer), nums([answer + 1, answer - 1, power - 10, answer + 2])),
    explanation: `Each earlier cast adds 2: with ${answer} casts Ghalta needs ${beforeReduction(answer)} power, with ${answer + 1} it would need ${beforeReduction(answer + 1)}. You have ${power}.`,
  }
}

function manaLeftQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const board = draw(kit, 1, 4)
  const casts = pickCasts(rng)
  const power = sum(board)
  const total = ghaltaCost(power, casts).total
  const mana = total + int(0, 5, rng)
  const left = mana - total
  const shown = show(board)
  return {
    id: `ghalta-mana-left-${n}`,
    key: `ghalta-mana-left:${casts}:${power}:${mana}`,
    prompt: pick(['You cast Ghalta. How much mana do you have left?', 'After casting Ghalta, how much mana is left over?'], rng),
    context: join(shown.text, castLine(casts), `You have ${mana} mana available.`),
    ...shown.view,
    ...choice(rng, String(left), nums([left + 2, mana - (beforeReduction(casts) + 2), left - 2, left + 1, left - 1])),
    explanation: `${mathText(power, casts)} = ${total} mana. ${mana} − ${total} = ${left}.`,
  }
}

function opponentsQuestion(kit: Kit, n: number): Question {
  const { rng } = kit
  const board = draw(kit, 1, 3)
  const casts = pickCasts(rng)
  const power = sum(board)
  const theirs = Array.from({ length: int(1, 2, rng) }, () => int(3, 8, rng))
  const theirPower = theirs.reduce((s, p) => s + p, 0)
  const shown = show(board)
  const tapped = pick(board, rng)
  const generic = genericOf(power, casts)
  return {
    id: `ghalta-opponents-${n}`,
    key: `ghalta-opponents:${casts}:${power}:${theirPower}`,
    prompt: pick(['What does Ghalta cost?', 'What do you pay for Ghalta now?'], rng),
    context: join(
      shown.text,
      castLine(casts),
      `${tapped.real ? tapped.name : 'One of your creatures'} attacked this turn and is tapped.`,
      `Your opponents control ${theirs.map((p) => `${an(p)} ${p}/${p} creature`).join(' and ')}.`,
    ),
    ...shown.view,
    ...choice(rng, costLabel(power, casts), [costLabel(power + theirPower, casts), `${generic + 2}GG`, costLabel(power - tapped.power, casts), costLabel(power, casts + 1)]),
    explanation: `Only creatures you control count, tapped ones too; your opponents’ don’t. ${mathText(power, casts)}.`,
  }
}

const MAKERS: [(kit: Kit, n: number) => Question | null, number][] = [
  [fitsQuestion, 3],
  [firstQuestion, 3],
  [reverseQuestion, 2],
  [taxStoryQuestion, 3],
  [savingsQuestion, 2],
  [cheapestQuestion, 2],
  [missingQuestion, 2],
  [responseQuestion, 3],
  [boostQuestion, 3],
  [countsQuestion, 2],
  [turnManaQuestion, 2],
  [orderQuestion, 2],
  [ggCastsQuestion, 2],
  [manaLeftQuestion, 2],
  [opponentsQuestion, 2],
]

/** Candidate questions for the Ghalta Math lesson (besides the plain cost and threshold questions). */
export function ghaltaMathQuestions(ctx: QuizContext): Question[] {
  const deck = deckBodies(ctx)
  const kit: Kit = { rng: ctx.rng, deck: deck.length >= 4 ? deck : [] }
  return MAKERS.flatMap(([make, count]) => Array.from({ length: count }, (_, n) => make(kit, n))).filter((q): q is Question => q !== null)
}
