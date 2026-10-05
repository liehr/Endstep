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
import { mulberry32, shuffle, type Rng } from '../sim/rng'
import { today as todayIso } from '../dates'
import type { Ruling } from '../scryfall'
import type { DeckEntry, LessonId, QuizMemory } from '../types'
import { classify, costVariants, faceOf, findGap, hideSelfName, ptVariants, ROLES, typeLabel, type CardFace, type FieldId, type Role } from './cardQuiz'
import { selectQuestions } from './memory'
import { RULES_BANK } from './rulesBank'

// Duolingo-style quiz: each lesson generates a pool of candidate questions, and the question
// memory (memory.ts) picks 5 of them: due reviews first, then new ones. Many questions are
// built from real cards in your deck (Scryfall data) and from simulated turns.

export interface QuizOption {
  id: string
  label: string
}

export interface QuizCard {
  name: string
  /** Small caption under the image, e.g. “5/4”. */
  caption?: string
}

export interface Blank {
  field: FieldId
  answer: string
}

export interface Question {
  id: string
  /**
   * Stable key for the question memory, e.g. "card-cost:Llanowar Elves". The part before
   * the first ":" is the topic; a lesson spreads its questions across topics.
   */
  key: string
  /** Questions of the same group (e.g. about the same card) don't appear together. */
  group?: string
  /** “choice”: pick one answer; “build”: fill the blanks from the tile bank. */
  kind?: 'choice' | 'build'
  prompt: string
  /** Self-drawn card with hidden fields (card quiz). */
  face?: CardFace
  hidden?: FieldId[]
  /** For “build”: blanks in order and the tiles to choose from. */
  blanks?: Blank[]
  bank?: string[]
  cardsLabel?: string
  cards?: QuizCard[]
  /** Short text above the cards, e.g. the game situation. */
  context?: string
  options: QuizOption[]
  correct: string
  explanation: string
  /** Optional extra after the answer (e.g. turn log). */
  details?: { title: string; lines: string[] }
}

export interface QuizContext {
  rng: Rng
  decklist: DeckEntry[]
  commander: string
  lookup: (name: string) => CardInfo | undefined
  /** Rulings per card (loaded in the background); missing for older callers and tests. */
  rulings?: (name: string) => Ruling[] | undefined
}

export const QUESTIONS_PER_LESSON = 5

// --- Helpers ----------------------------------------------------------------

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]
const int = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1))

/** Shuffle answer options; remember the correct answer by ID. */
function choice(rng: Rng, correctLabel: string, wrongLabels: string[]): { options: QuizOption[]; correct: string } {
  const unique = [...new Set(wrongLabels.filter((l) => l !== correctLabel))].slice(0, 3)
  const options = shuffle(
    [{ id: 'a', label: correctLabel }, ...unique.map((label, i) => ({ id: `w${i}`, label }))],
    rng,
  )
  return { options, correct: 'a' }
}

/** Options in a fixed order (e.g. turn 3, 4, 5 …). */
function ordered(labels: string[], correctIndex: number): { options: QuizOption[]; correct: string } {
  return { options: labels.map((label, i) => ({ id: `o${i}`, label })), correct: `o${correctIndex}` }
}

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
  const qs = Array.from({ length: 12 }, (_, i) => ghaltaCostQuestion(ctx, i))
  qs.splice(int(1, 4, ctx.rng), 0, ghaltaThresholdQuestion(ctx, 0))
  return qs
}

// --- Lesson 2: Combat & Trample ---------------------------------------------------

const BLOCKERS = [1, 2, 2, 3, 3, 4, 5, 6]

function trampleQuestion(ctx: QuizContext, n: number, deathtouch = false): Question {
  const { rng } = ctx
  const blockers = Array.from({ length: int(1, 2, rng) }, () => pick(BLOCKERS, rng))
  const lethal = blockers.reduce((s, t) => s + (deathtouch ? 1 : t), 0)
  const toPlayer = Math.max(0, 12 - lethal)
  const blockerText = blockers.map((t) => `${t}/${t}`).join(' and a ')
  const wrong = [12, Math.max(0, 12 - Math.max(...blockers)), 0, toPlayer + 1, Math.max(0, toPlayer - 1)].map(String)
  return {
    id: `trample-${n}`,
    key: `${deathtouch ? 'deathtouch' : 'trample'}:${[...blockers].sort().join('+')}`,
    prompt: `Ghalta (12/12, Trample${deathtouch ? ', Deathtouch' : ''}) is blocked by a ${blockerText}. What’s the most damage that can go to the player?`,
    ...(ctx.lookup(ctx.commander) ? { cards: [{ name: ctx.commander, caption: '12/12' }] } : {}),
    ...choice(rng, String(toPlayer), wrong),
    explanation: deathtouch
      ? `With Deathtouch, 1 damage per blocker is enough: 12 − ${blockers.length} = ${toPlayer}. That counts as commander damage.`
      : `Each blocker needs lethal damage (${blockers.join(' + ')} = ${lethal}). The remaining 12 − ${lethal} = ${toPlayer} goes through and counts as commander damage.`,
  }
}

function commanderDamageQuestion(ctx: QuizContext, n: number): Question {
  const { rng } = ctx
  const already = int(4, 16, rng)
  const blocker = pick([0, 2, 3, 4, 5], rng)
  const dealt = 12 - blocker
  const dies = already + dealt >= 21
  return {
    id: `cmd-damage-${n}`,
    key: `cmd-damage:${already}:${blocker}`,
    prompt: `An opponent already has ${already} commander damage from Ghalta. Ghalta (12/12, Trample) attacks them${blocker ? ` and is blocked by a ${blocker}/${blocker}` : ' and isn’t blocked'}. Do they lose?`,
    ...ordered(['Yes, they lose', 'No, not yet'], dies ? 0 : 1),
    explanation: `${already} + ${dealt} = ${already + dealt} commander damage. ${dies ? 'At 21 they lose, no matter how much life they have.' : `Still ${21 - already - dealt} short of 21.`}`,
  }
}

function blockerGoneQuestion(ctx: QuizContext, trample: boolean): Question {
  return {
    id: `blocker-gone-${trample ? 'trample' : 'plain'}`,
    key: `blocker-gone:${trample ? 'trample' : 'plain'}`,
    prompt: `${trample ? 'Ghalta (12/12, Trample)' : 'Steel Leaf Champion (5/4, no Trample)'} is blocked. The blocker is removed before damage. How much damage does it deal to the player?`,
    ...choice(ctx.rng, trample ? '12' : '0', trample ? ['0', '6', '11'] : ['5', '4', '1']),
    explanation: trample
      ? 'Blocked stays blocked, but with Trample and no blocker left, the full damage goes to the player.'
      : 'Blocked stays blocked: without Trample, the creature deals no damage at all if the blocker disappears.',
  }
}

function fightQuestion(): Question {
  return {
    id: 'fight',
    key: 'fight',
    prompt: 'Ram Through: Ghalta fights a 4/4, and the excess (8) hits the player. Does that count as commander damage?',
    ...ordered(['Yes', 'No'], 1),
    explanation: 'No. Commander damage is only combat damage. Fight damage (Ram Through, Bite Down) doesn’t count, not even the excess.',
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
      fightQuestion(),
    ],
    ctx.rng,
  )
}

// --- Lesson 3: Commander Rules ----------------------------------------------------

function rulesLesson(ctx: QuizContext): Question[] {
  return shuffle(RULES_BANK, ctx.rng).map((q) => ({
      id: q.id,
      // Every rule is its own topic, so the memory alone decides.
      key: `rule-${q.id}`,
      prompt: q.prompt,
      ...choice(ctx.rng, q.options[0], q.options.slice(1)),
      explanation: q.explanation,
    }))
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

function cardsLesson(ctx: QuizContext): Question[] {
  const all = deckCards(ctx)
  const qs: Question[] = []
  // Every card can come up in every question type; the memory picks, and a card shows up
  // at most once per lesson (group), so one question can't give away another's answer.
  shuffle(all, ctx.rng).forEach((card, n) => {
    qs.push(nameQuestion(ctx, card, all, n))
    if (!isLand(card) && card.manaCost !== '' && costVariants(card.manaCost).length >= 3) qs.push(costQuestion(ctx, card, n))
    const gap = gapQuestion(ctx, card, n)
    if (gap) qs.push(gap)
    if (classify(card).confident && !isLand(card)) qs.push(roleQuestion(ctx, card, n))
    if (!isLand(card) && card.manaCost !== '' && costVariants(card.manaCost).length >= 2) qs.push(buildQuestion(ctx, card, all, n))
  })
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
  /** Candidate questions; buildLesson picks 5 of them. */
  build: (ctx: QuizContext) => Question[]
}

export const LESSONS: Lesson[] = [
  { id: 'ghalta', title: 'Ghalta Math', description: 'What does Ghalta cost with your board?', needsCards: false, forCommander: isGhalta, remember: true, build: ghaltaLesson },
  { id: 'combat', title: 'Combat & Trample', description: 'Blockers, trample and commander damage.', needsCards: false, remember: true, build: combatLesson },
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

