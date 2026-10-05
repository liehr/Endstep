import { isArtifact, isCreature, isLand, manaAbility, type CardInfo } from '../cards'
import { shortName } from '../commander'
import { isBasicLand } from '../decklist'
import { shuffle, type Rng } from '../sim/rng'
import { fewestFor, int, pick, selectSolution, type Question, type QuizContext, type SelectRule } from './question'

// Interactive question kinds: put things in the right order (turn steps, the stack, which
// card to play first) and tap cards on the board (enough power, every possible blocker …).

// --- Helpers ----------------------------------------------------------------------

function uniqueCards(ctx: QuizContext, filter: (c: CardInfo) => boolean): CardInfo[] {
  const seen = new Set<string>()
  const out: CardInfo[] = []
  for (const e of ctx.decklist) {
    const c = ctx.lookup(e.name)
    if (c && !seen.has(c.name) && filter(c)) {
      seen.add(c.name)
      out.push(c)
    }
  }
  return out
}

const numericCreature = (c: CardInfo) => isCreature(c) && c.power !== null && /^\d+$/.test(c.toughness ?? '')
const toughnessOf = (c: CardInfo) => Number(c.toughness)
const ptOf = (c: CardInfo) => `${c.powerText}/${c.toughness}`

function orderQuestion(id: string, key: string, prompt: string, order: string[], rng: Rng, rest: Partial<Question>): Question {
  let bank = shuffle(order, rng)
  // Never show the items already in the right order.
  for (let i = 0; i < 5 && bank.every((b, j) => b === order[j]); i++) bank = shuffle(order, rng)
  return { id, key, kind: 'order', prompt, order, bank, options: [], correct: '', explanation: '', ...rest }
}

function selectQuestion(id: string, key: string, prompt: string, cards: { name: string; caption?: string }[], select: SelectRule, rest: Partial<Question>): Question {
  return { id, key, kind: 'select', prompt, cards, select, options: [], correct: '', explanation: '', ...rest }
}

// --- Order: steps of the turn -------------------------------------------------------

export const TURN_STEPS = [
  'Untap',
  'Upkeep',
  'Draw',
  'Main phase 1',
  'Beginning of combat',
  'Declare attackers',
  'Declare blockers',
  'Combat damage',
  'End of combat',
  'Main phase 2',
  'End step',
  'Cleanup',
]

const COMBAT_STEPS = ['Beginning of combat', 'Declare attackers', 'Declare blockers', 'First-strike damage', 'Combat damage', 'End of combat']

function turnOrderQuestion(ctx: QuizContext, n: number): Question {
  const count = int(4, 6, ctx.rng)
  const order = shuffle(TURN_STEPS.map((_, i) => i), ctx.rng)
    .slice(0, count)
    .sort((a, b) => a - b)
    .map((i) => TURN_STEPS[i])
  return orderQuestion(`order-turn-${n}`, `order-turn:${order.join('|')}`, 'Put these steps of your turn in order.', order, ctx.rng, {
    context: 'Tap them from first to last.',
    explanation: `A turn goes: ${TURN_STEPS.join(' → ')}.`,
  })
}

function combatOrderQuestion(ctx: QuizContext, n: number): Question {
  const firstStrike = ctx.rng() < 0.5
  const steps = COMBAT_STEPS.filter((s) => firstStrike || s !== 'First-strike damage')
  // Sometimes leave out one step so it doesn't always look the same.
  const dropped = ctx.rng() < 0.5 ? pick(steps.filter((x) => x !== 'First-strike damage'), ctx.rng) : null
  const order = steps.filter((s) => s !== dropped)
  return orderQuestion(`order-combat-${n}`, `order-combat:${order.join('|')}`, 'Put the combat steps in order.', order, ctx.rng, {
    context: firstStrike ? 'A creature with First strike is in combat.' : 'Tap them from first to last.',
    explanation: firstStrike
      ? 'With First strike or Double strike in combat, there’s an extra damage step before the regular one: Beginning of combat → Declare attackers → Declare blockers → First-strike damage → Combat damage → End of combat.'
      : 'Beginning of combat → Declare attackers → Declare blockers → Combat damage → End of combat.',
  })
}

// --- Order: the stack -------------------------------------------------------------------

const OPPONENT_SPELLS = ['Counterspell', 'Lightning Bolt', 'Swords to Plowshares', 'Negate', 'Path to Exile', 'Beast Within', 'Heroic Intervention', 'Chaos Warp']

function stackQuestion(ctx: QuizContext, n: number): Question | null {
  const { rng } = ctx
  const spells = uniqueCards(ctx, (c) => !isLand(c))
  if (spells.length === 0) return null
  const instants = spells.filter((c) => /\bInstant\b/.test(c.typeLine) || /\bFlash\b/.test(c.oracleText))
  const first = pick(spells, rng)
  const yourResponse = instants.filter((c) => c.name !== first.name)
  const opp = shuffle(
    OPPONENT_SPELLS.filter((o) => !spells.some((c) => c.name === o)),
    rng,
  )
  const cast: { who: string; name: string }[] = [{ who: 'You', name: first.name }, { who: 'An opponent', name: opp[0] }]
  if (yourResponse.length && rng() < 0.6) cast.push({ who: 'You', name: pick(yourResponse, rng).name })
  else cast.push({ who: 'Another opponent', name: opp[1] })
  if (rng() < 0.4) cast.push({ who: 'An opponent', name: opp[2] })
  const order = [...cast].reverse().map((c) => c.name)
  const story = cast.map((c, i) => (i === 0 ? `${c.who} cast ${c.name}.` : `${c.who} respond${c.who === 'You' ? '' : 's'} with ${c.name}.`)).join(' ')
  return orderQuestion(`order-stack-${n}`, `order-stack:${cast.map((c) => c.name).join('|')}`, 'In which order does the stack handle them?', order, rng, {
    context: `${story} Nobody does anything else.`,
    explanation: `Last in, first out: the spell cast last resolves first, so ${order[0]} goes before everything else. A spell that gets countered still leaves the stack in its spot, it just does nothing.`,
  })
}

// --- Order: what to play first --------------------------------------------------------

interface Play {
  name: string
  kind: 'land' | 'rock' | 'dork' | 'spell'
  cost: number
  /** Mana a rock adds right away (a mana creature can't tap the turn it comes in). */
  adds: number
}

/** Can you play everything in this order with `lands` untapped lands? (Colors ignored.) */
export function playable(plays: Play[], lands: number): boolean {
  let mana = lands
  let landPlayed = false
  for (const p of plays) {
    if (p.kind === 'land') {
      if (landPlayed) return false
      landPlayed = true
      mana += 1
      continue
    }
    if (mana < p.cost) return false
    mana -= p.cost
    if (p.kind === 'rock') mana += p.adds
  }
  return true
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]))
}

function sequenceQuestion(ctx: QuizContext, n: number): Question | null {
  const { rng } = ctx
  const land = ctx.decklist.find((e) => isBasicLand(e.name))?.name ?? 'Forest'
  const noX = (c: CardInfo) => !/\{X\}/.test(c.manaCost)
  const rocks = uniqueCards(
    ctx,
    (c) => isArtifact(c) && !isCreature(c) && !isLand(c) && !!manaAbility(c) && c.cmc <= 4 && noX(c) && !/enters( the battlefield)? tapped/i.test(c.oracleText),
  )
  const dorks = uniqueCards(ctx, (c) => isCreature(c) && !!manaAbility(c) && c.cmc <= 3)
  const spells = uniqueCards(ctx, (c) => !isLand(c) && !manaAbility(c) && c.cmc >= 2 && c.cmc <= 7 && noX(c))
  if (spells.length === 0 || rocks.length === 0) return null
  for (let attempt = 0; attempt < 60; attempt++) {
    const hand: Play[] = [{ name: land, kind: 'land', cost: 0, adds: 0 }]
    for (const r of shuffle(rocks, rng).slice(0, rocks.length > 1 && rng() < 0.4 ? 2 : 1))
      hand.push({ name: r.name, kind: 'rock', cost: r.cmc, adds: manaAbility(r)!.amount })
    if (dorks.length && rng() < 0.4) {
      const d = pick(dorks, rng)
      hand.push({ name: d.name, kind: 'dork', cost: d.cmc, adds: 0 })
    }
    const s = pick(spells, rng)
    hand.push({ name: s.name, kind: 'spell', cost: s.cmc, adds: 0 })
    const lands = int(1, 5, rng)
    const all = permutations(hand)
    const valid = all.filter((p) => playable(p, lands))
    // Every order that works counts; it's only a question if most orders don't.
    if (valid.length === 0 || valid.length * 3 > all.length) continue
    const [order, ...accept] = valid.map((p) => p.map((x) => x.name))
    const dork = hand.find((h) => h.kind === 'dork')
    return orderQuestion(`order-play-${n}`, `order-play:${lands}:${order.join('|')}`, 'Play all of these this turn. In which order?', order, rng, {
      accept,
      context: `You have ${lands} untapped land${lands > 1 ? 's' : ''} and haven’t played a land yet. Colors don’t matter here.`,
      cardsLabel: 'In your hand',
      cards: shuffle(order, rng).map((name) => ({ name })),
      explanation: `For example ${order.join(' → ')}. Land first for the extra mana, and mana rocks tap the turn they come in${dork ? `, but ${shortName(dork.name)} can’t tap for mana until your next turn` : ''}.${accept.length ? ` ${accept.length + 1} orders work.` : ' It’s the only order that works.'}`,
    })
  }
  return null
}

export function orderQuestions(ctx: QuizContext): Question[] {
  const qs: (Question | null)[] = [
    ...[0, 1, 2].map((i) => turnOrderQuestion(ctx, i)),
    ...[0, 1].map((i) => combatOrderQuestion(ctx, i)),
    ...[0, 1, 2].map((i) => stackQuestion(ctx, i)),
    ...[0, 1, 2].map((i) => sequenceQuestion(ctx, i)),
  ]
  return qs.filter((q): q is Question => q !== null)
}

/** “Troll (6) + Yeva (4) = 10” for the biggest cards that reach the target. */
function sumOf(board: CardInfo[], values: number[], target: number): string {
  const picked = selectSolution({ mode: 'fewest', values, target }).sort((a, b) => values[b] - values[a])
  const total = picked.reduce((s, i) => s + values[i], 0)
  return `${picked.map((i) => `${shortName(board[i].name)} (${values[i]})`).join(' + ')} = ${total}`
}

// --- Tap: Ghalta down to GG -----------------------------------------------------------

export function tapGhaltaQuestion(ctx: QuizContext, n: number): Question | null {
  const { rng } = ctx
  const creatures = uniqueCards(ctx, (c) => numericCreature(c) && c.power! > 0 && !/^Ghalta\b/.test(c.name))
  if (creatures.length < 4) return null
  for (let attempt = 0; attempt < 30; attempt++) {
    const board = shuffle(creatures, rng).slice(0, int(4, Math.min(6, creatures.length), rng))
    const casts = int(0, 2, rng)
    const target = 10 + 2 * casts
    const values = board.map((c) => c.power!)
    const fewest = fewestFor(values, target)
    if (fewest === Infinity || fewest < 2 || fewest === board.length) continue
    return selectQuestion(
      `tap-ghalta-${n}`,
      `tap-ghalta:${casts}:${board.map((c) => c.name).sort().join('|')}`,
      'Tap the fewest creatures whose power together brings Ghalta down to GG.',
      board.map((c) => ({ name: c.name, caption: ptOf(c) })),
      { mode: 'fewest', values, target },
      {
        context: casts ? `Ghalta has been cast from the command zone ${casts === 1 ? 'once' : `${casts} times`} before: you need ${target} power.` : 'You need 10 power.',
        explanation: `You need ${target} power: ${sumOf(board, values, target)}. Fewer than ${fewest} creatures can’t get there.`,
      },
    )
  }
  return null
}

// --- Tap: combat on the board -----------------------------------------------------------

function tapBlockersQuestion(ctx: QuizContext, n: number): Question | null {
  const { rng } = ctx
  const creatures = uniqueCards(ctx, (c) => numericCreature(c) && !/deathtouch|first strike|double strike|indestructible|can't block/i.test(c.oracleText))
  if (creatures.length < 4) return null
  for (let attempt = 0; attempt < 30; attempt++) {
    const board = shuffle(creatures, rng).slice(0, int(4, Math.min(6, creatures.length), rng))
    const p = int(2, 7, rng)
    const t = int(2, 7, rng)
    const survive = rng() < 0.5
    const correct = board.map((c, i) => ((survive ? toughnessOf(c) > p : c.power! >= t) ? i : -1)).filter((i) => i >= 0)
    if (correct.length === 0 || correct.length === board.length) continue
    return selectQuestion(
      `tap-blockers-${n}`,
      `tap-blockers:${survive ? 's' : 'k'}:${p}/${t}:${board.map((c) => c.name).sort().join('|')}`,
      survive ? `An opponent attacks you with a ${p}/${t}. Tap every creature that can block it and survive.` : `An opponent attacks you with a ${p}/${t}. Tap every creature that would destroy it in a block.`,
      board.map((c) => ({ name: c.name, caption: ptOf(c) })),
      { mode: 'exact', correct },
      {
        context: 'All your creatures are untapped. No tricks.',
        explanation: survive
          ? `It deals ${p} damage, so a blocker needs toughness ${p + 1} or more: ${correct.map((i) => `${shortName(board[i].name)} (${ptOf(board[i])})`).join(', ')}.`
          : `It has toughness ${t}, so a blocker needs power ${t} or more: ${correct.map((i) => `${shortName(board[i].name)} (${ptOf(board[i])})`).join(', ')}.`,
      },
    )
  }
  return null
}

function tapLethalQuestion(ctx: QuizContext, n: number): Question | null {
  const { rng } = ctx
  const creatures = uniqueCards(ctx, (c) => numericCreature(c) && c.power! > 0 && !/double strike|can't attack|\bdefender\b/i.test(c.oracleText))
  if (creatures.length < 4) return null
  for (let attempt = 0; attempt < 30; attempt++) {
    const board = shuffle(creatures, rng).slice(0, int(4, Math.min(6, creatures.length), rng))
    const values = board.map((c) => c.power!)
    const total = values.reduce((s, v) => s + v, 0)
    const life = int(Math.max(3, Math.floor(total / 3)), total - 1, rng)
    const fewest = fewestFor(values, life)
    if (fewest < 2 || fewest === board.length) continue
    return selectQuestion(
      `tap-lethal-${n}`,
      `tap-lethal:${life}:${board.map((c) => c.name).sort().join('|')}`,
      `An opponent is at ${life} life with no blockers. Tap the fewest attackers for lethal.`,
      board.map((c) => ({ name: c.name, caption: ptOf(c) })),
      { mode: 'fewest', values, target: life },
      {
        context: 'Keep the rest home to defend.',
        explanation: `You need ${life} damage: ${sumOf(board, values, life)}. Fewer than ${fewest} attackers can’t get there.`,
      },
    )
  }
  return null
}

export function tapCombatQuestions(ctx: QuizContext): Question[] {
  return [0, 1, 2].flatMap((i) => [tapBlockersQuestion(ctx, i), tapLethalQuestion(ctx, i)]).filter((q): q is Question => q !== null)
}

// --- Tap: know your cards ----------------------------------------------------------------

const byType = (c: CardInfo) => c.typeLine
const byValue = (c: CardInfo) => `mana value ${c.cmc}`

const TYPE_TESTS: { label: string; test: (c: CardInfo) => boolean; detail: (c: CardInfo) => string }[] = [
  { label: 'every creature', test: (c) => isCreature(c), detail: byType },
  { label: 'every instant', test: (c) => /\bInstant\b/.test(c.typeLine), detail: byType },
  { label: 'every sorcery', test: (c) => /\bSorcery\b/.test(c.typeLine), detail: byType },
  { label: 'every artifact', test: (c) => isArtifact(c), detail: byType },
  { label: 'every enchantment', test: (c) => /\bEnchantment\b/.test(c.typeLine), detail: byType },
  { label: 'every card with mana value 3 or less', test: (c) => !isLand(c) && c.cmc <= 3, detail: byValue },
  { label: 'every card with mana value 5 or more', test: (c) => c.cmc >= 5, detail: byValue },
  { label: 'every card that makes mana', test: (c) => !isLand(c) && !!manaAbility(c), detail: (c) => c.oracleText.match(/\{T\}[^.]*: Add [^.]+\./)?.[0] ?? 'makes mana' },
]

function tapTypeQuestion(ctx: QuizContext, n: number): Question | null {
  const { rng } = ctx
  const cards = uniqueCards(ctx, (c) => !isLand(c))
  if (cards.length < 6) return null
  for (let attempt = 0; attempt < 30; attempt++) {
    const rule = pick(TYPE_TESTS, rng)
    const shown = shuffle(cards, rng).slice(0, 6)
    const correct = shown.map((c, i) => (rule.test(c) ? i : -1)).filter((i) => i >= 0)
    if (correct.length === 0 || correct.length === shown.length) continue
    return selectQuestion(
      `tap-type-${n}`,
      `tap-type:${rule.label}:${shown.map((c) => c.name).sort().join('|')}`,
      `Tap ${rule.label}.`,
      shown.map((c) => ({ name: c.name })),
      { mode: 'exact', correct },
      // Shows six cards at once: at most one of these per lesson.
      { group: 'tap-type', explanation: `Right: ${correct.map((i) => `${shown[i].name} (${rule.detail(shown[i])})`).join(', ')}.` },
    )
  }
  return null
}

export function tapCardQuestions(ctx: QuizContext): Question[] {
  return [0, 1, 2, 3].map((i) => tapTypeQuestion(ctx, i)).filter((q): q is Question => q !== null)
}
