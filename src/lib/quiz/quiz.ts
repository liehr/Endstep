import { boardPower, isCreature, isLand, type CardInfo } from '../cards'
import { ghaltaCost } from '../ghalta'
import { buildLibrary, MAX_TURNS, simulateGame, type SimCard, type TurnLog } from '../sim/goldfish'
import { evaluateHand } from '../sim/mulligan'
import { mulberry32, shuffle, type Rng } from '../sim/rng'
import type { DeckEntry, LessonId } from '../types'
import { classify, costVariants, faceOf, findGap, hideSelfName, ptVariants, ROLES, typeLabel, type CardFace, type FieldId, type Role } from './cardQuiz'
import { RULES_BANK } from './rulesBank'

// Duolingo-style quiz: each lesson generates 5 questions. Many questions are built from real
// cards in your deck (Scryfall data) and from simulated turns.

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
    prompt: `${castText(casts)}. How much power do you need for Ghalta to cost only GG?`,
    ...choice(ctx.rng, String(needed), [String(needed - 2), String(needed + 2), String(needed + 4), '12'].filter((x) => x !== String(needed))),
    explanation: `The reduction only applies to the generic part: 10${casts ? ` + ${2 * casts} tax` : ''} = ${needed}. With ${needed} power, only GG is left.`,
  }
}

function ghaltaLesson(ctx: QuizContext): Question[] {
  const qs = [0, 1, 2, 3].map((i) => ghaltaCostQuestion(ctx, i))
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
    prompt: `An opponent already has ${already} commander damage from Ghalta. Ghalta (12/12, Trample) attacks them${blocker ? ` and is blocked by a ${blocker}/${blocker}` : ' and isn’t blocked'}. Do they lose?`,
    ...ordered(['Yes, they lose', 'No, not yet'], dies ? 0 : 1),
    explanation: `${already} + ${dealt} = ${already + dealt} commander damage. ${dies ? 'At 21 they lose, no matter how much life they have.' : `Still ${21 - already - dealt} short of 21.`}`,
  }
}

function blockerGoneQuestion(ctx: QuizContext): Question {
  const trample = ctx.rng() < 0.5
  return {
    id: 'blocker-gone',
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
    prompt: 'Ram Through: Ghalta fights a 4/4, and the excess (8) hits the player. Does that count as commander damage?',
    ...ordered(['Yes', 'No'], 1),
    explanation: 'No. Commander damage is only combat damage. Fight damage (Ram Through, Bite Down) doesn’t count, not even the excess.',
  }
}

function combatLesson(ctx: QuizContext): Question[] {
  return shuffle(
    [
      trampleQuestion(ctx, 0),
      trampleQuestion(ctx, 1),
      ctx.rng() < 0.5 ? trampleQuestion(ctx, 2, true) : blockerGoneQuestion(ctx),
      commanderDamageQuestion(ctx, 0),
      fightQuestion(),
    ],
    ctx.rng,
  )
}

// --- Lesson 3: Commander Rules ----------------------------------------------------

function rulesLesson(ctx: QuizContext): Question[] {
  return shuffle(RULES_BANK, ctx.rng)
    .slice(0, QUESTIONS_PER_LESSON)
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      ...choice(ctx.rng, q.options[0], q.options.slice(1)),
      explanation: q.explanation,
    }))
}

// --- Lesson 4: Mulligan Trainer ---------------------------------------------------

function mulliganLesson(ctx: QuizContext): Question[] {
  const library = deckLibrary(ctx).filter((c) => c.info)
  const questions: Question[] = []
  let keeps = 0
  for (let attempt = 0; questions.length < QUESTIONS_PER_LESSON && attempt < 200; attempt++) {
    const hand = shuffle(library, ctx.rng).slice(0, 7)
    const report = evaluateHand(hand.map((c) => c.info))
    // Keep it balanced: 2–3 hands to keep, the rest mulligans.
    const wantKeep = keeps < 3 && (questions.length - keeps >= 2 || ctx.rng() < 0.5)
    if (report.keep !== wantKeep && attempt < 150) continue
    if (report.keep) keeps++
    questions.push({
      id: `mulligan-${questions.length}`,
      prompt: 'Keep or mulligan?',
      context: 'Your first mulligan is free.',
      cardsLabel: 'Your opening hand',
      cards: hand.map((c) => ({ name: c.name })),
      ...ordered(['Keep', 'Mulligan'], report.keep ? 0 : 1),
      explanation: `${report.keep ? 'Keep' : 'Mulligan'} by the rule of thumb (3–4 lands or mana creatures plus an early big creature). ${report.reasons.join(' ')}`,
    })
  }
  return questions
}

// --- Lesson 5: When Does Ghalta Land? (simulation) ---------------------------------

const TURN_BUCKETS = ['Turn 3 or earlier', 'Turn 4', 'Turn 5', 'Turn 6', 'Turn 7 or later']
const bucketOf = (turn: number | null) => (turn === null ? 4 : Math.min(4, Math.max(0, turn - 3)))

export function describeTurn(t: TurnLog): string {
  const parts = [`Turn ${t.turn}:`]
  if (t.drew) parts.push(`draws ${t.drew}`)
  if (t.land) parts.push(`· plays ${t.land}`)
  const spells = t.cast.filter((c) => !c.startsWith('Ghalta'))
  if (spells.length) parts.push(`· casts ${spells.join(', ')}`)
  if (t.ghalta) parts.push('· casts GHALTA!')
  parts.push(`(power ${t.power}, ${t.mana} mana)`)
  return parts.join(' ')
}

function whenQuestion(ctx: QuizContext, library: SimCard[], n: number): Question {
  const game = simulateGame(library, Math.floor(ctx.rng() * 2 ** 31))
  const correct = bucketOf(game.ghaltaTurn)
  const shown = game.log.slice(0, game.ghaltaTurn ?? MAX_TURNS)
  return {
    id: `when-${n}`,
    prompt: 'When can Ghalta land with this opening hand?',
    context: `The autopilot plays a land every turn, mana creatures first, then the strongest creatures. No opponents.${game.mulligans ? ` (After ${game.mulligans} mulligan${game.mulligans > 1 ? 's' : ''}.)` : ''}`,
    cardsLabel: 'Your opening hand',
    cards: game.hand.map((c) => ({ name: c.name })),
    ...ordered(TURN_BUCKETS, correct),
    explanation:
      game.ghaltaTurn === null
        ? `With this hand, Ghalta didn’t land by turn ${MAX_TURNS}.`
        : `In this simulation, Ghalta landed on turn ${game.ghaltaTurn}.`,
    details: { title: 'How the simulation went', lines: shown.map(describeTurn) },
  }
}

function castNowQuestion(ctx: QuizContext, library: SimCard[], n: number): Question | null {
  const game = simulateGame(library, Math.floor(ctx.rng() * 2 ** 31))
  const candidates = game.log.filter((t) => t.turn >= 2 && t.boardAtStart.length > 0)
  if (candidates.length === 0) return null
  const t = pick(candidates, ctx.rng)
  const cost = ghaltaCost(t.powerAtStart, 0)
  const can = t.mana >= cost.total
  return {
    id: `cast-now-${n}`,
    prompt: `Turn ${t.turn}: You have ${t.mana} mana. Can you cast Ghalta now without playing anything first?`,
    cardsLabel: 'Your creatures on the battlefield',
    cards: t.boardAtStart.map((name) => ({ name })),
    ...ordered(['Yes', 'No'], can ? 0 : 1),
    explanation: `Power ${t.powerAtStart} → Ghalta costs ${cost.label} (${cost.total} mana). ${can ? `${t.mana} mana is enough.` : `${t.mana} mana isn’t enough.`}`,
  }
}

function goldfishLesson(ctx: QuizContext): Question[] {
  const library = deckLibrary(ctx)
  const qs: Question[] = [0, 1, 2].map((i) => whenQuestion(ctx, library, i))
  for (let i = 0; qs.length < QUESTIONS_PER_LESSON && i < 10; i++) {
    const q = castNowQuestion(ctx, library, i)
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
  const pool = shuffle(deckCards(ctx), ctx.rng)
  const next = (pred: (c: CardInfo) => boolean = () => true) => {
    const i = pool.findIndex(pred)
    return i >= 0 ? pool.splice(i, 1)[0] : undefined
  }
  const all = deckCards(ctx)
  const qs: Question[] = []
  const nameCard = next()
  if (nameCard) qs.push(nameQuestion(ctx, nameCard, all, 0))
  const costCard = next((c) => !isLand(c) && c.manaCost !== '' && costVariants(c.manaCost).length >= 3)
  if (costCard) qs.push(costQuestion(ctx, costCard, 0))
  for (let i = 0; i < pool.length && qs.length < 3; i++) {
    const q = gapQuestion(ctx, pool[i], 0)
    if (q) {
      pool.splice(i, 1)
      qs.push(q)
    }
  }
  const roleCard = next((c) => classify(c).confident && !isLand(c))
  if (roleCard) qs.push(roleQuestion(ctx, roleCard, 0))
  const buildCard = next((c) => !isLand(c) && c.manaCost !== '' && costVariants(c.manaCost).length >= 2)
  if (buildCard) qs.push(buildQuestion(ctx, buildCard, all, 0))
  // Fill up in case a question type found no matching card.
  for (let n = 1; qs.length < QUESTIONS_PER_LESSON && pool.length > 0; n++) {
    const c = next()!
    qs.push(nameQuestion(ctx, c, all, n))
  }
  const [first, ...rest] = qs
  return [first, ...shuffle(rest, ctx.rng)].filter(Boolean).slice(0, QUESTIONS_PER_LESSON)
}

// --- Lessons ----------------------------------------------------------------------

export interface Lesson {
  id: LessonId
  title: string
  description: string
  /** Needs card data from Scryfall. */
  needsCards: boolean
  build: (ctx: QuizContext) => Question[]
}

export const LESSONS: Lesson[] = [
  { id: 'ghalta', title: 'Ghalta Math', description: 'What does Ghalta cost with your board?', needsCards: false, build: ghaltaLesson },
  { id: 'combat', title: 'Combat & Trample', description: 'Blockers, trample and commander damage.', needsCards: false, build: combatLesson },
  { id: 'rules', title: 'Commander Rules', description: 'Mulligan, stack, combat, brackets.', needsCards: false, build: rulesLesson },
  { id: 'mulligan', title: 'Mulligan Trainer', description: 'Real opening hands from your deck.', needsCards: true, build: mulliganLesson },
  { id: 'goldfish', title: 'When Does Ghalta Land?', description: 'Simulated turns with your deck.', needsCards: true, build: goldfishLesson },
  { id: 'cards', title: 'Know Your Cards', description: 'What each card costs, does and is for.', needsCards: true, build: cardsLesson },
]

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l])) as Record<LessonId, Lesson>

export function buildLesson(id: LessonId, ctx: Omit<QuizContext, 'rng'>, seed: number): Question[] {
  return LESSON_BY_ID[id].build({ ...ctx, rng: mulberry32(seed) })
}

