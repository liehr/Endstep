import { boardPower, isCreature, isLand, type CardInfo } from '../cards'
import { isGhalta, shortName } from '../commander'
import { ghaltaCost } from '../ghalta'
import {
  buildLibrary,
  commanderCostLabel,
  commanderGeneric,
  handRuleFor,
  MAX_TURNS,
  simCommander,
  simulateGame,
  type SimCard,
  type SimCommander,
  type TurnLog,
} from '../sim/goldfish'
import { evaluateHand, ruleText } from '../sim/mulligan'
import { mulberry32, shuffle } from '../sim/rng'
import { today as todayIso } from '../dates'
import type { Ruling } from '../scryfall'
import type { LessonId, QuizMemory } from '../types'
import { classify, costVariants, faceOf, findGap, hideSelfName, KEYWORDS, ptVariants, ROLES, typeLabel, type Role } from './cardQuiz'
import { combatQuestions } from './combatQuiz'
import { ghaltaMathQuestions } from './ghaltaMath'
import { orderQuestions, tapCardQuestions, tapCombatQuestions, tapGhaltaQuestion } from './interactive'
import { selectQuestions } from './memory'
import { RULES_BANK } from './rulesBank'

// Duolingo-style quiz: each lesson generates a pool of candidate questions, and the question
// memory (memory.ts) picks 5 of them: due reviews first, then new ones. Many questions are
// built from real cards in your deck (Scryfall data) and from simulated turns.

export * from './question'
import { choice, int, ordered, pick, QUESTIONS_PER_LESSON, type Blank, type Question, type QuizCard, type QuizContext } from './question'

// --- Helpers ----------------------------------------------------------------

const costLabel = (generic: number) => (generic > 0 ? `${generic}GG` : 'GG')
const castText = (n: number) =>
  n === 0 ? 'Ghalta hasn’t been cast yet' : n === 1 ? 'Ghalta has been cast once before' : `Ghalta has been cast ${n} times before`
const ptOf = (c: CardInfo) => `${c.powerText ?? '?'}/${c.toughness ?? '?'}`

function deckCreatures(ctx: QuizContext): CardInfo[] {
  const seen = new Set<string>()
  const out: CardInfo[] = []
  for (const e of ctx.decklist) {
    const c = ctx.lookup(e.name)
    if (c && isCreature(c) && c.power !== null && !seen.has(c.name)) {
      seen.add(c.name)
      out.push(c)
    }
  }
  return out
}

export function deckLibrary(ctx: Pick<QuizContext, 'decklist' | 'lookup'>): SimCard[] {
  return buildLibrary(ctx.decklist, ctx.lookup)
}

/** Share of deck cards with loaded data (for lessons with real cards). */
export function cardCoverage(ctx: Pick<QuizContext, 'decklist' | 'lookup'>): number {
  const lib = deckLibrary(ctx)
  return lib.length ? lib.filter((c) => c.info).length / lib.length : 0
}

// --- Lesson 1: Ghalta Math --------------------------------------------------------

function ghaltaCostQuestion(ctx: QuizContext, n: number): Question {
  const { rng } = ctx
  const creatures = deckCreatures(ctx)
  const casts = pick([0, 0, 1, 1, 2], rng)
  let board: { name: string; power: number; caption: string; real: boolean }[]
  if (creatures.length >= 4) {
    board = shuffle(creatures, rng)
      .slice(0, int(1, 4, rng))
      .map((c) => ({ name: c.name, power: boardPower(c, 0), caption: ptOf(c), real: true }))
  } else {
    board = Array.from({ length: int(1, 3, rng) }, () => {
      const p = pick([1, 2, 3, 4, 5, 6], rng)
      return { name: `a ${p}/${p} creature`, power: p, caption: `${p}/${p}`, real: false }
    })
  }
  const power = board.reduce((s, c) => s + c.power, 0)
  const cost = ghaltaCost(power, casts)
  const forgotTax = Math.max(0, 10 - power)
  const forgotReduction = 10 + 2 * casts
  const wrong = [forgotTax, forgotReduction, cost.generic + 2, Math.max(0, cost.generic - 2), cost.generic + 4].map(costLabel)
  const real = board.every((c) => c.real)
  return {
    id: `ghalta-${n}`,
    key: `ghalta-cost:${casts}:${power}`,
    prompt: 'What does Ghalta cost right now?',
    context: real
      ? `${castText(casts)} from the command zone.`
      : `On the battlefield: ${board.map((c) => c.name).join(', ')}. ${castText(casts)}.`,
    ...(real ? { cardsLabel: 'Your creatures on the battlefield', cards: board.map((c) => ({ name: c.name, caption: c.caption })) } : {}),
    ...choice(rng, cost.label, wrong),
    explanation: `10 generic${casts ? ` + ${2 * casts} tax` : ''} = ${10 + 2 * casts}, minus ${power} power → ${cost.generic} generic. Plus GG as always: ${cost.label}.`,
  }
}

function ghaltaThresholdQuestion(ctx: QuizContext, n: number): Question {
  const casts = int(0, 2, ctx.rng)
  const needed = 10 + 2 * casts
  return {
    id: `ghalta-threshold-${n}`,
    key: `ghalta-threshold:${casts}`,
    prompt: `${castText(casts)}. How much power do you need for Ghalta to cost only GG?`,
    ...choice(ctx.rng, String(needed), [String(needed - 2), String(needed + 2), String(needed + 4), '12'].filter((x) => x !== String(needed))),
    explanation: `The reduction only applies to the generic part: 10${casts ? ` + ${2 * casts} tax` : ''} = ${needed}. With ${needed} power, only GG is left.`,
  }
}

function ghaltaLesson(ctx: QuizContext): Question[] {
  return shuffle(
    [
      ...Array.from({ length: 8 }, (_, i) => ghaltaCostQuestion(ctx, i)),
      ghaltaThresholdQuestion(ctx, 0),
      ...ghaltaMathQuestions(ctx),
      ...[0, 1, 2].map((i) => tapGhaltaQuestion(ctx, i)).filter((q): q is Question => q !== null),
    ],
    ctx.rng,
  )
}

// --- Lesson 2: Combat & Trample ---------------------------------------------------
// Built from your own deck: your commander and creatures where they fit the question,
// otherwise a made-up creature of the right kind.

const BLOCKERS = [1, 2, 2, 3, 3, 4, 5, 6]

interface Attacker {
  /** Text in the question, e.g. "Ghalta (12/12, Trample)" or "a 7/7 creature with Trample". */
  label: string
  power: number
  trample: boolean
  /** Real card to show (name + P/T caption). */
  card?: QuizCard
}

const hasTrample = (c: CardInfo) => c.keywords.includes('Trample') || /(^|\n)(Flying, )?trample\b/i.test(c.oracleText)

function attackerOf(c: CardInfo): Attacker {
  const trample = hasTrample(c)
  return {
    label: `${shortName(c.name)} (${ptOf(c)}${trample ? ', Trample' : ''})`,
    power: c.power ?? 0,
    trample,
    card: { name: c.name, caption: ptOf(c) },
  }
}

const madeUp = (power: number, trample: boolean): Attacker => ({
  label: `a ${power}/${power} creature${trample ? ' with Trample' : ' without Trample'}`,
  power,
  trample,
})

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Your commander, if it's a creature with a printed power of at least 2. */
function commanderCreature(ctx: QuizContext): CardInfo | null {
  const c = ctx.lookup(ctx.commander)
  return c && isCreature(c) && c.power !== null && c.power >= 2 && /^\d+$/.test(c.toughness ?? '') ? c : null
}

/** The trampler for trample questions: your commander, else your biggest trampler, else a made-up 7/7. */
function trampler(ctx: QuizContext): Attacker {
  const commander = commanderCreature(ctx)
  if (commander && hasTrample(commander) && commander.power! >= 6) return attackerOf(commander)
  const own = deckCreatures(ctx)
    .filter((c) => hasTrample(c) && (c.power ?? 0) >= 6 && /^\d+$/.test(c.toughness ?? ''))
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0]
  return own ? attackerOf(own) : madeUp(7, true)
}

function trampleQuestion(ctx: QuizContext, n: number, deathtouch = false): Question {
  const { rng } = ctx
  const attacker = trampler(ctx)
  const p = attacker.power
  const blockers = Array.from({ length: int(1, 2, rng) }, () => pick(BLOCKERS.filter((b) => b < p), rng))
  const lethal = blockers.reduce((s, t) => s + (deathtouch ? 1 : t), 0)
  const toPlayer = Math.max(0, p - lethal)
  const blockerText = blockers.map((t) => `${t}/${t}`).join(' and a ')
  const wrong = [p, Math.max(0, p - Math.max(...blockers)), 0, toPlayer + 1, Math.max(0, toPlayer - 1)].map(String)
  const label = deathtouch ? attacker.label.replace(/\)$|$/, (end) => (end ? ', Deathtouch)' : ' and Deathtouch')) : attacker.label
  return {
    id: `trample-${n}`,
    key: `${deathtouch ? 'deathtouch' : 'trample'}:${p}:${[...blockers].sort().join('+')}`,
    prompt: `${capitalize(label)} is blocked by a ${blockerText}. What’s the most damage that can go to the player?`,
    ...(attacker.card ? { cards: [attacker.card] } : {}),
    ...choice(rng, String(toPlayer), wrong),
    explanation: deathtouch
      ? `With Deathtouch, 1 damage per blocker is enough: ${p} − ${blockers.length} = ${toPlayer}.`
      : `Each blocker needs lethal damage (${blockers.join(' + ')} = ${lethal}). The remaining ${p} − ${lethal} = ${toPlayer} goes through.`,
  }
}

function commanderDamageQuestion(ctx: QuizContext, n: number): Question {
  const { rng } = ctx
  const own = commanderCreature(ctx)
  const attacker = own ? attackerOf(own) : { ...madeUp(6, true), label: 'your commander (a 6/6 with Trample)' }
  const p = attacker.power
  const name = own ? shortName(own.name) : 'your commander'
  const already = int(Math.max(1, 21 - p - 4), 20, rng)
  const blocker = pick(attacker.trample ? [0, 2, 3, 4, 5].filter((b) => b < p) : [0, 0, 2], rng)
  const dealt = blocker === 0 ? p : attacker.trample ? p - blocker : 0
  const dies = already + dealt >= 21
  return {
    id: `cmd-damage-${n}`,
    key: `cmd-damage:${p}:${attacker.trample ? 't' : ''}:${already}:${blocker}`,
    prompt: `An opponent already has ${already} commander damage from ${name}. ${capitalize(attacker.label)} attacks them${blocker ? ` and is blocked by a ${blocker}/${blocker}` : ' and isn’t blocked'}. Do they lose?`,
    ...(attacker.card ? { cards: [attacker.card] } : {}),
    ...ordered(['Yes, they lose', 'No, not yet'], dies ? 0 : 1),
    explanation: `${blocker && !attacker.trample ? 'Without Trample, a blocked creature deals no damage to the player. ' : ''}${already} + ${dealt} = ${already + dealt} commander damage. ${dies ? 'At 21 they lose, no matter how much life they have.' : `Still ${21 - already - dealt} short of 21.`}`,
  }
}

function blockerGoneQuestion(ctx: QuizContext, trample: boolean): Question {
  const plain = deckCreatures(ctx)
    .filter((c) => !hasTrample(c) && (c.power ?? 0) >= 2 && /^\d+$/.test(c.toughness ?? ''))
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0]
  const attacker = trample ? trampler(ctx) : plain ? attackerOf(plain) : madeUp(5, false)
  const p = attacker.power
  return {
    id: `blocker-gone-${trample ? 'trample' : 'plain'}`,
    key: `blocker-gone:${trample ? 'trample' : 'plain'}`,
    prompt: `${capitalize(attacker.label)} is blocked. The blocker is removed before damage. How much damage does it deal to the player?`,
    ...(attacker.card ? { cards: [attacker.card] } : {}),
    ...choice(ctx.rng, trample ? String(p) : '0', trample ? ['0', String(Math.ceil(p / 2)), String(p - 1)] : [String(p), String(p - 1), '1']),
    explanation: trample
      ? 'Blocked stays blocked, but with Trample and no blocker left, the full damage goes to the player.'
      : 'Blocked stays blocked: without Trample, the creature deals no damage at all if the blocker disappears.',
  }
}

const FIGHT_RE = /\bfights?\b|deals damage equal to its power to target/i

function fightQuestion(ctx: QuizContext): Question {
  // A fight spell from your deck, if there is one.
  const spell = ctx.decklist
    .map((e) => ctx.lookup(e.name))
    .find((c): c is CardInfo => !!c && !isCreature(c) && !isLand(c) && FIGHT_RE.test(c.oracleText))
  const own = commanderCreature(ctx)
  const who = own ? shortName(own.name) : 'Your commander'
  return {
    id: 'fight',
    key: 'fight',
    prompt: spell && /excess/i.test(spell.oracleText)
      ? `${spell.name}: ${who} fights a 4/4, and the excess hits the player. Does that count as commander damage?`
      : `${spell ? `${spell.name}: ` : ''}${who} fights an opponent’s creature. Does the damage count toward the 21 commander damage?`,
    ...(spell ? { cards: [{ name: spell.name }] } : {}),
    ...ordered(['Yes', 'No'], 1),
    explanation: 'No. Commander damage is only combat damage. Fight and “bite” damage doesn’t count, not even the excess.',
  }
}

function combatLesson(ctx: QuizContext): Question[] {
  return shuffle(
    [
      ...[0, 1, 2, 3, 4, 5].map((i) => trampleQuestion(ctx, i)),
      ...[6, 7, 8].map((i) => trampleQuestion(ctx, i, true)),
      ...[0, 1, 2, 3].map((i) => commanderDamageQuestion(ctx, i)),
      blockerGoneQuestion(ctx, true),
      blockerGoneQuestion(ctx, false),
      fightQuestion(ctx),
      ...combatQuestions(ctx),
      ...tapCombatQuestions(ctx),
    ],
    ctx.rng,
  )
}

// --- Lesson 3: Commander Rules ----------------------------------------------------

function rulesLesson(ctx: QuizContext): Question[] {
  const bank = RULES_BANK.map((q) => ({
    id: q.id,
    // Every rule is its own topic, so the memory alone decides.
    key: `rule-${q.id}`,
    prompt: q.prompt,
    ...choice(ctx.rng, q.options[0], q.options.slice(1)),
    explanation: q.explanation,
  }))
  return shuffle([...bank, ...orderQuestions(ctx)], ctx.rng)
}

// --- Lesson 4: Mulligan Trainer ---------------------------------------------------

const handKey = (hand: { name: string }[]) => hand.map((c) => c.name).sort().join('|')

function mulliganLesson(ctx: QuizContext): Question[] {
  const library = deckLibrary(ctx).filter((c) => c.info)
  const rule = handRuleFor(commanderOf(ctx))
  const questions: Question[] = []
  let keeps = 0
  for (let attempt = 0; questions.length < QUESTIONS_PER_LESSON && attempt < 200; attempt++) {
    const hand = shuffle(library, ctx.rng).slice(0, 7)
    const report = evaluateHand(hand.map((c) => c.info), rule)
    // Keep it balanced: 2–3 hands to keep, the rest mulligans.
    const wantKeep = keeps < 3 && (questions.length - keeps >= 2 || ctx.rng() < 0.5)
    if (report.keep !== wantKeep && attempt < 150) continue
    if (report.keep) keeps++
    questions.push({
      id: `mulligan-${questions.length}`,
      key: `mulligan:${handKey(hand)}`,
      prompt: 'Keep or mulligan?',
      context: 'Your first mulligan is free.',
      cardsLabel: 'Your opening hand',
      cards: hand.map((c) => ({ name: c.name })),
      ...ordered(['Keep', 'Mulligan'], report.keep ? 0 : 1),
      explanation: `${report.keep ? 'Keep' : 'Mulligan'} by the rule of thumb (${ruleText(rule)}). ${report.reasons.join(' ')}`,
    })
  }
  return questions
}

// --- Lesson 5: When Does Your Commander Land? (simulation) -------------------------

const TURN_BUCKETS = ['Turn 3 or earlier', 'Turn 4', 'Turn 5', 'Turn 6', 'Turn 7 or later']
const bucketOf = (turn: number | null) => (turn === null ? 4 : Math.min(4, Math.max(0, turn - 3)))

export function describeTurn(t: TurnLog, commander: string): string {
  const parts = [`Turn ${t.turn}:`]
  if (t.drew) parts.push(`draws ${t.drew}`)
  if (t.land) parts.push(`· plays ${t.land}`)
  const spells = t.cast.filter((c) => c !== commander)
  if (spells.length) parts.push(`· casts ${spells.join(', ')}`)
  if (t.commander) parts.push(`· casts ${shortName(commander).toUpperCase()}!`)
  parts.push(`(power ${t.power}, ${t.mana} mana)`)
  return parts.join(' ')
}

/** The commander for the simulation; null while its card data is missing. */
function commanderOf(ctx: Pick<QuizContext, 'commander' | 'lookup'>): SimCommander | null {
  const card = ctx.lookup(ctx.commander)
  return card ? simCommander(card) : null
}

function whenQuestion(ctx: QuizContext, library: SimCard[], commander: SimCommander, n: number): Question {
  const game = simulateGame(library, Math.floor(ctx.rng() * 2 ** 31), commander)
  const correct = bucketOf(game.commanderTurn)
  const shown = game.log.slice(0, game.commanderTurn ?? MAX_TURNS)
  const name = shortName(commander.name)
  return {
    id: `when-${n}`,
    key: `when:${handKey(game.hand)}`,
    prompt: `When can ${name} land with this opening hand?`,
    context: `The autopilot plays a land every turn, ramp first, then the strongest creatures. No opponents.${game.mulligans ? ` (After ${game.mulligans} mulligan${game.mulligans > 1 ? 's' : ''}.)` : ''}`,
    cardsLabel: 'Your opening hand',
    cards: game.hand.map((c) => ({ name: c.name })),
    ...ordered(TURN_BUCKETS, correct),
    explanation:
      game.commanderTurn === null
        ? `With this hand, ${name} didn’t land by turn ${MAX_TURNS}.`
        : `In this simulation, ${name} landed on turn ${game.commanderTurn}.`,
    details: { title: 'How the simulation went', lines: shown.map((t) => describeTurn(t, commander.name)) },
  }
}

function castNowQuestion(ctx: QuizContext, library: SimCard[], commander: SimCommander, n: number): Question | null {
  const game = simulateGame(library, Math.floor(ctx.rng() * 2 ** 31), commander)
  const byPower = commander.reducedByPower
  const candidates = game.log.filter((t) => t.turn >= 2 && (byPower ? t.boardAtStart : t.sourcesAtStart).length > 0)
  if (candidates.length === 0) return null
  const t = pick(candidates, ctx.rng)
  const name = shortName(commander.name)
  const label = commanderCostLabel(commander, t.powerAtStart)
  const total = commanderGeneric(commander, t.powerAtStart) + commander.cost.pips.length
  const can = t.canCastAtStart
  const verdict = can
    ? `${t.mana} mana in the right colors is enough.`
    : t.mana >= total
      ? `${t.mana} mana would be enough, but not in the right colors.`
      : `${t.mana} mana isn’t enough.`
  const shownCards = byPower ? t.boardAtStart : t.sourcesAtStart
  return {
    id: `cast-now-${n}`,
    key: `cast-now:${t.turn}:${t.mana}:${shownCards.join('|')}`,
    prompt: `Turn ${t.turn}: You have ${t.mana} mana. Can you cast ${name} now without playing anything first?`,
    cardsLabel: byPower ? 'Your creatures on the battlefield' : 'Your untapped mana sources',
    cards: shownCards.map((card) => ({ name: card })),
    ...ordered(['Yes', 'No'], can ? 0 : 1),
    explanation: `${byPower ? `Power ${t.powerAtStart} → ` : ''}${name} costs ${label} (${total} mana). ${verdict}`,
  }
}

function goldfishLesson(ctx: QuizContext): Question[] {
  const commander = commanderOf(ctx)
  if (!commander) return []
  const library = deckLibrary(ctx)
  const qs: Question[] = [0, 1, 2].map((i) => whenQuestion(ctx, library, commander, i))
  for (let i = 0; qs.length < QUESTIONS_PER_LESSON && i < 10; i++) {
    const q = castNowQuestion(ctx, library, commander, i)
    if (q) qs.splice(int(1, qs.length, ctx.rng), 0, q)
  }
  return qs
}

// --- Lesson 6: Know Your Cards ----------------------------------------------------------

function deckCards(ctx: QuizContext): CardInfo[] {
  const seen = new Set<string>()
  const out: CardInfo[] = []
  for (const e of ctx.decklist) {
    const c = ctx.lookup(e.name)
    if (c && !seen.has(c.name) && !c.typeLine.startsWith('Basic Land')) {
      seen.add(c.name)
      out.push(c)
    }
  }
  return out
}

const isNumericPt = (c: CardInfo) => c.power !== null && /^\d+$/.test(c.toughness ?? '')

function nameQuestion(ctx: QuizContext, card: CardInfo, pool: CardInfo[], n: number): Question {
  const sameKind = pool.filter((c) => c.name !== card.name && isCreature(c) === isCreature(card))
  const others = (sameKind.length >= 3 ? sameKind : pool.filter((c) => c.name !== card.name)).map((c) => c.name)
  const face = faceOf(card)
  return {
    id: `card-name-${n}`,
    key: `card-name:${card.name}`,
    group: card.name,
    prompt: 'Which card is this?',
    face: { ...face, text: hideSelfName(face.text, card.name) },
    hidden: ['name'],
    ...choice(ctx.rng, card.name, shuffle(others, ctx.rng)),
    explanation: `This is ${card.name}. ${ROLES[classify(card).role].hint}`,
  }
}

function costQuestion(ctx: QuizContext, card: CardInfo, n: number): Question {
  return {
    id: `card-cost-${n}`,
    key: `card-cost:${card.name}`,
    group: card.name,
    prompt: 'What does this card cost?',
    face: faceOf(card),
    hidden: ['cost'],
    ...choice(ctx.rng, card.manaCost, shuffle(costVariants(card.manaCost), ctx.rng)),
    explanation: `${card.name} costs ${card.cmc} mana.`,
  }
}

function gapQuestion(ctx: QuizContext, card: CardInfo, n: number): Question | null {
  const gap = findGap(card.oracleText, ctx.rng)
  if (!gap) return null
  return {
    id: `card-gap-${n}`,
    key: `card-gap:${card.name}`,
    group: card.name,
    prompt: 'What’s missing from the card text?',
    face: { ...faceOf(card), text: gap.text },
    hidden: ['gap'],
    ...choice(ctx.rng, gap.answer, gap.wrong),
    explanation: `On ${card.name}, it says “${gap.answer}”.`,
  }
}

function roleQuestion(ctx: QuizContext, card: CardInfo, n: number): Question {
  const { role } = classify(card)
  const others = shuffle(
    (Object.keys(ROLES) as Role[]).filter((r) => r !== role && r !== 'utility'),
    ctx.rng,
  ).map((r) => ROLES[r].label)
  return {
    id: `card-role-${n}`,
    key: `card-role:${card.name}`,
    group: card.name,
    prompt: 'What role does this card play in your gameplan?',
    cards: [{ name: card.name }],
    ...choice(ctx.rng, ROLES[role].label, others),
    explanation: `${ROLES[role].label}: ${ROLES[role].hint}`,
  }
}

const TYPE_TILES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact']
const withArticle = (type: string) =>
  type === 'Other' ? 'something else' : `${/^[AEIOU]/.test(type) ? 'an' : 'a'} ${type.toLowerCase()}`

function buildQuestion(ctx: QuizContext, card: CardInfo, pool: CardInfo[], n: number): Question {
  const blanks: Blank[] = [{ field: 'cost', answer: card.manaCost }]
  const wrong: string[] = shuffle(costVariants(card.manaCost), ctx.rng).slice(0, 2)
  if (isCreature(card) && isNumericPt(card)) {
    const pt = `${card.powerText}/${card.toughness}`
    blanks.push({ field: 'pt', answer: pt })
    const fromDeck = pool.filter((c) => isCreature(c) && isNumericPt(c)).map((c) => `${c.powerText}/${c.toughness}`)
    wrong.push(...shuffle([...new Set([...ptVariants(pt), ...fromDeck])].filter((v) => v !== pt), ctx.rng).slice(0, 2))
  } else {
    const t = typeLabel(card)
    blanks.push({ field: 'type', answer: t })
    wrong.push(...shuffle(TYPE_TILES.filter((x) => x !== t), ctx.rng).slice(0, 2))
  }
  const answers = blanks.map((b) => b.answer)
  const face = faceOf(card)
  return {
    id: `card-build-${n}`,
    key: `card-build:${card.name}`,
    group: card.name,
    kind: 'build',
    prompt: `Build the card: ${card.name}`,
    context: 'Tap the right tiles to fill the blanks.',
    face,
    hidden: blanks.map((b) => b.field),
    blanks,
    bank: shuffle([...answers, ...wrong.filter((w) => !answers.includes(w))], ctx.rng),
    options: [],
    correct: '',
    explanation: `${card.name}: ${blanks.map((b) => (b.field === 'cost' ? `costs ${card.cmc} mana` : b.field === 'pt' ? `is a ${b.answer}` : `is ${withArticle(b.answer)}`)).join(' and ')}.`,
  }
}

/** Which card has this artwork? Only the art is shown. */
function artQuestion(ctx: QuizContext, card: CardInfo, pool: CardInfo[], n: number): Question | null {
  if (!card.art) return null
  const others = pool.filter((c) => c.name !== card.name && c.art).map((c) => c.name)
  if (others.length < 3) return null
  return {
    id: `card-art-${n}`,
    key: `card-art:${card.name}`,
    group: card.name,
    prompt: 'Which card has this artwork?',
    face: { name: '', manaCost: '', typeLine: '', text: '', pt: null, art: card.art, frame: faceOf(card).frame },
    ...choice(ctx.rng, card.name, shuffle(others, ctx.rng)),
    explanation: `That’s the art of ${card.name}.`,
  }
}

/** Which card has this rules text? No art, no name, just the text. */
function textQuestion(ctx: QuizContext, card: CardInfo, pool: CardInfo[], n: number): Question | null {
  if (card.oracleText.length < 25) return null
  // Same kind of card where possible, so "this creature" in the text doesn't give it away.
  const candidates = pool.filter((c) => c.name !== card.name && c.oracleText !== card.oracleText && isLand(c) === isLand(card))
  const sameKind = candidates.filter((c) => isCreature(c) === isCreature(card))
  const others = (sameKind.length >= 3 ? sameKind : candidates).map((c) => c.name)
  if (others.length < 3) return null
  return {
    id: `card-text-${n}`,
    key: `card-text:${card.name}`,
    group: card.name,
    prompt: 'Which of your cards has this text?',
    context: `“${hideSelfName(card.oracleText, card.name).replace(/~/g, 'this card').replace(/\n/g, ' ')}”`,
    ...choice(ctx.rng, card.name, shuffle(others, ctx.rng)),
    explanation: `That’s ${card.name}.`,
  }
}

function ptQuestion(ctx: QuizContext, card: CardInfo, pool: CardInfo[], n: number): Question | null {
  if (!isCreature(card) || !isNumericPt(card)) return null
  const pt = `${card.powerText}/${card.toughness}`
  const fromDeck = pool.filter((c) => isCreature(c) && isNumericPt(c)).map((c) => `${c.powerText}/${c.toughness}`)
  const wrong = shuffle([...new Set([...ptVariants(pt), ...fromDeck])].filter((v) => v !== pt), ctx.rng)
  if (wrong.length < 2) return null
  return {
    id: `card-pt-${n}`,
    key: `card-pt:${card.name}`,
    group: card.name,
    prompt: 'How big is this creature?',
    face: faceOf(card),
    hidden: ['pt'],
    ...choice(ctx.rng, pt, wrong),
    explanation: `${card.name} is a ${pt}.`,
  }
}

const TYPE_CHOICES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Land', 'Planeswalker']

function typeQuestion(ctx: QuizContext, card: CardInfo, n: number): Question | null {
  const t = typeLabel(card)
  if (t === 'Other') return null
  return {
    id: `card-type-${n}`,
    key: `card-type:${card.name}`,
    group: card.name,
    prompt: 'What kind of card is this?',
    face: faceOf(card),
    hidden: ['type'],
    ...choice(ctx.rng, t, shuffle(TYPE_CHOICES.filter((x) => x !== t), ctx.rng)),
    explanation: `${card.name} is ${withArticle(t)} (${card.typeLine}).`,
  }
}

/** Which keyword does this card have? Asked by name only, so the text doesn't give it away. */
function keywordQuestion(ctx: QuizContext, card: CardInfo, n: number): Question | null {
  // Only keywords the card has itself (a line like "Flying, trample"), not ones it grants.
  const isKeyword = (part: string, k: string) => part.startsWith(k.toLowerCase()) && part.length <= k.length + 6
  const keywordLines = card.oracleText
    .split('\n')
    .map((line) => line.replace(/\s*\([^)]*\)/g, '').split(/,\s*/).map((part) => part.trim().toLowerCase()))
    .filter((parts) => parts.every((part) => KEYWORDS.some((k) => isKeyword(part, k))))
  const has = (k: string) => keywordLines.some((parts) => parts.some((part) => isKeyword(part, k)))
  const mentioned = (k: string) => new RegExp(`\\b${k}\\b`, 'i').test(card.oracleText)
  const own = KEYWORDS.filter(has)
  if (own.length === 0) return null
  const answer = pick(own, ctx.rng)
  return {
    id: `card-keyword-${n}`,
    key: `card-keyword:${card.name}:${answer}`,
    group: card.name,
    prompt: `Which keyword does ${card.name} have?`,
    ...choice(ctx.rng, answer, shuffle(KEYWORDS.filter((k) => !mentioned(k)), ctx.rng)),
    explanation: `${card.name} has ${answer}.`,
    details: { title: card.name, lines: card.oracleText.split('\n') },
  }
}

/** Mana value, asked by name only. */
function manaValueQuestion(ctx: QuizContext, card: CardInfo, n: number): Question | null {
  if (isLand(card) || card.manaCost === '' || /\{X\}/.test(card.manaCost)) return null
  const mv = card.cmc
  const wrong = [mv - 2, mv - 1, mv + 1, mv + 2].filter((v) => v >= 0).map(String)
  return {
    id: `card-mv-${n}`,
    key: `card-mv:${card.name}`,
    group: card.name,
    prompt: `What’s the mana value of ${card.name}?`,
    ...choice(ctx.rng, String(mv), shuffle(wrong, ctx.rng)),
    explanation: `${card.name} costs ${card.manaCost}, that’s mana value ${mv}.`,
  }
}

/** Which of these four cards costs the most (or the least)? */
function compareCostQuestion(ctx: QuizContext, card: CardInfo, pool: CardInfo[], n: number): Question | null {
  if (isLand(card) || card.manaCost === '' || /\{X\}/.test(card.manaCost)) return null
  const most = ctx.rng() < 0.5
  const others = shuffle(
    pool.filter((c) => !isLand(c) && c.manaCost !== '' && !/\{X\}/.test(c.manaCost) && (most ? c.cmc < card.cmc : c.cmc > card.cmc)),
    ctx.rng,
  )
  // Distinct mana values, so the answer is clear.
  const wrong: CardInfo[] = []
  for (const c of others) if (wrong.length < 3 && !wrong.some((w) => w.cmc === c.cmc)) wrong.push(c)
  if (wrong.length < 3) return null
  return {
    id: `card-compare-${n}`,
    key: `card-compare:${most ? 'most' : 'least'}:${card.name}`,
    group: card.name,
    prompt: `Which of these cards has the ${most ? 'highest' : 'lowest'} mana value?`,
    ...choice(ctx.rng, card.name, wrong.map((c) => c.name)),
    explanation: [card, ...wrong].map((c) => `${c.name}: ${c.cmc}`).join(' · '),
  }
}

/** Which of these four cards is an instant (creature, artifact …)? */
function whichTypeQuestion(ctx: QuizContext, card: CardInfo, pool: CardInfo[], n: number): Question | null {
  const t = typeLabel(card)
  if (t === 'Other' || t === 'Land') return null
  const english = { Creature: 'Creature', Instant: 'Instant', Sorcery: 'Sorcery', Enchantment: 'Enchantment', Artifact: 'Artifact', Planeswalker: 'Planeswalker' }[t]
  // Wrong options must not have that type at all (an artifact creature is also an artifact).
  const others = shuffle(pool.filter((c) => !new RegExp(`\\b${english}\\b`).test(c.typeLine)), ctx.rng)
  if (others.length < 3) return null
  return {
    id: `card-which-type-${n}`,
    key: `card-which-type:${card.name}`,
    group: card.name,
    prompt: `Which of these is ${withArticle(t)}?`,
    ...choice(ctx.rng, card.name, others.map((c) => c.name)),
    explanation: `${card.name} is ${withArticle(t)} (${card.typeLine}).`,
  }
}

function cardsLesson(ctx: QuizContext): Question[] {
  const all = deckCards(ctx)
  const qs: Question[] = []
  // Every card can come up in every question type. The memory picks the cards you haven't
  // seen for the longest time, and a card shows up at most once per lesson (group), so one
  // question can't give away another's answer.
  shuffle(all, ctx.rng).forEach((card, n) => {
    qs.push(nameQuestion(ctx, card, all, n))
    if (!isLand(card) && card.manaCost !== '' && costVariants(card.manaCost).length >= 3) qs.push(costQuestion(ctx, card, n))
    const gap = gapQuestion(ctx, card, n)
    if (gap) qs.push(gap)
    if (classify(card).confident && !isLand(card)) qs.push(roleQuestion(ctx, card, n))
    if (!isLand(card) && card.manaCost !== '' && costVariants(card.manaCost).length >= 2) qs.push(buildQuestion(ctx, card, all, n))
    for (const q of [
      artQuestion(ctx, card, all, n),
      textQuestion(ctx, card, all, n),
      ptQuestion(ctx, card, all, n),
      typeQuestion(ctx, card, n),
      keywordQuestion(ctx, card, n),
      manaValueQuestion(ctx, card, n),
      compareCostQuestion(ctx, card, all, n),
      whichTypeQuestion(ctx, card, all, n),
    ])
      if (q) qs.push(q)
  })
  qs.push(...tapCardQuestions(ctx))
  return shuffle(qs, ctx.rng)
}

// --- Lesson 7: Card Rulings ---------------------------------------------------------------

/** Short, stable hash for question keys (djb2). */
function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const MAX_RULING_LENGTH = 400

/** Rulings that clearly belong to one card of the deck (not shared, not too long). */
function deckRulings(ctx: QuizContext): { card: CardInfo; ruling: Ruling }[] {
  if (!ctx.rulings) return []
  const commander = ctx.lookup(ctx.commander)
  const cards = [...(commander ? [commander] : []), ...deckCards(ctx)].filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i)
  const withRulings = cards.map((card) => ({ card, rulings: ctx.rulings!(card.name) ?? [] }))
  const count = new Map<string, number>()
  for (const { rulings } of withRulings) for (const r of new Set(rulings.map((x) => x.text))) count.set(r, (count.get(r) ?? 0) + 1)
  return withRulings.flatMap(({ card, rulings }) =>
    rulings.filter((r) => count.get(r.text) === 1 && r.text.length <= MAX_RULING_LENGTH).map((ruling) => ({ card, ruling })),
  )
}

/** Enough rulings for a lesson: questions about at least 5 different cards. */
export function rulingsReady(ctx: Omit<QuizContext, 'rng'>): boolean {
  return new Set(deckRulings({ ...ctx, rng: () => 0 }).map((r) => r.card.name)).size >= QUESTIONS_PER_LESSON
}

function rulingQuestion(ctx: QuizContext, card: CardInfo, ruling: Ruling, cardsWithRulings: CardInfo[], n: number): Question {
  const sameKind = cardsWithRulings.filter((c) => c.name !== card.name && isCreature(c) === isCreature(card))
  const others = (sameKind.length >= 3 ? sameKind : cardsWithRulings.filter((c) => c.name !== card.name)).map((c) => c.name)
  return {
    id: `ruling-${n}`,
    key: `ruling-${card.name}:${hash(ruling.text)}`,
    group: card.name,
    prompt: 'Which card is this ruling about?',
    context: `“${hideSelfName(ruling.text, card.name).replace(/(^|[.!?:]\s+)~/g, '$1This card').replace(/~/g, 'this card')}”`,
    ...choice(ctx.rng, card.name, shuffle(others, ctx.rng)),
    explanation: `This official ruling (${ruling.date}) is about ${card.name}.`,
    details: { title: card.name, lines: card.oracleText.split('\n') },
  }
}

function rulingsLesson(ctx: QuizContext): Question[] {
  const all = deckRulings(ctx)
  const cards = [...new Map(all.map((r) => [r.card.name, r.card])).values()]
  return shuffle(
    all.map(({ card, ruling }, n) => rulingQuestion(ctx, card, ruling, cards, n)),
    ctx.rng,
  )
}

// --- Lessons ----------------------------------------------------------------------

export interface Lesson {
  id: LessonId
  title: string
  description: string
  /** Needs card data from Scryfall. */
  needsCards: boolean
  /** Only for decks with this commander (e.g. the Ghalta lessons); without it, for every deck. */
  forCommander?: (commander: string) => boolean
  /** Extra condition (e.g. rulings loaded); without it, needsCards decides. */
  ready?: (ctx: Omit<QuizContext, 'rng'>) => boolean
  /**
   * Remember answers for the review schedule. Off for lessons whose questions are random
   * hands and simulations that won't come back anyway.
   */
  remember: boolean
  /** Has its own page instead of questions (the turn scenarios). */
  page?: boolean
  /** Candidate questions; buildLesson picks 5 of them. */
  build: (ctx: QuizContext) => Question[]
}

export const LESSONS: Lesson[] = [
  { id: 'ghalta', title: 'Ghalta Math', description: 'What does Ghalta cost with your board?', needsCards: false, forCommander: isGhalta, remember: true, build: ghaltaLesson },
  { id: 'combat', title: 'Combat & Trample', description: 'Blocks, first strike, trample and commander damage.', needsCards: false, remember: true, build: combatLesson },
  { id: 'rules', title: 'Commander Rules', description: 'Mulligan, stack, combat, brackets.', needsCards: false, remember: true, build: rulesLesson },
  { id: 'mulligan', title: 'Mulligan Trainer', description: 'Real opening hands from your deck.', needsCards: true, remember: false, build: mulliganLesson },
  {
    id: 'goldfish',
    title: 'When Does Your Commander Land?',
    description: 'Simulated turns with your deck.',
    needsCards: true,
    ready: (ctx) => ctx.lookup(ctx.commander) !== undefined,
    remember: false,
    build: goldfishLesson,
  },
  { id: 'cards', title: 'Know Your Cards', description: 'What each card costs, does and is for.', needsCards: true, remember: true, build: cardsLesson },
  {
    id: 'rulings',
    title: 'Card Rulings',
    description: 'Official rulings: which of your cards is it about?',
    needsCards: true,
    ready: rulingsReady,
    remember: true,
    build: rulingsLesson,
  },
  {
    id: 'scenario',
    title: 'Turn by Turn',
    description: 'Play the turns yourself and race the autopilot to your commander.',
    needsCards: true,
    ready: (ctx) => ctx.lookup(ctx.commander) !== undefined,
    remember: false,
    page: true,
    build: () => [],
  },
]

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l])) as Record<LessonId, Lesson>

/**
 * Build a lesson: generate the candidates with the seed, then let the question memory pick
 * 5 (due reviews first, then new questions, spread across topics and cards).
 */
export function buildLesson(
  id: LessonId,
  ctx: Omit<QuizContext, 'rng'>,
  seed: number,
  memory: QuizMemory = {},
  today: string = todayIso(),
): Question[] {
  const lesson = LESSON_BY_ID[id]
  const candidates = lesson.build({ ...ctx, rng: mulberry32(seed) })
  if (!lesson.remember) return candidates.slice(0, QUESTIONS_PER_LESSON)
  return selectQuestions(candidates, memory, today, QUESTIONS_PER_LESSON)
}

