import { boardPower, isCreature, isLand, type CardInfo } from '../cards'
import { ghaltaCost } from '../ghalta'
import { buildLibrary, MAX_TURNS, simulateGame, type SimCard, type TurnLog } from '../sim/goldfish'
import { evaluateHand } from '../sim/mulligan'
import { mulberry32, shuffle, type Rng } from '../sim/rng'
import type { DeckEntry, LessonId } from '../types'
import { classify, costVariants, faceOf, findGap, hideSelfName, ptVariants, ROLES, typeLabel, type CardFace, type FieldId, type Role } from './cardQuiz'
import { RULES_BANK } from './rulesBank'

// Quiz im Duolingo-Stil: Jede Lektion erzeugt 5 Fragen. Viele Fragen werden aus echten
// Karten deines Decks (Scryfall-Daten) und aus simulierten Zügen gebaut.

export interface QuizOption {
  id: string
  label: string
}

export interface QuizCard {
  name: string
  /** Kleine Beschriftung unter dem Bild, z. B. „5/4“. */
  caption?: string
}

export interface Blank {
  field: FieldId
  answer: string
}

export interface Question {
  id: string
  /** „choice“: eine Antwort wählen; „build“: Lücken aus der Kachelbank füllen. */
  kind?: 'choice' | 'build'
  prompt: string
  /** Selbst gezeichnete Karte mit versteckten Feldern (Karten-Quiz). */
  face?: CardFace
  hidden?: FieldId[]
  /** Für „build“: Lücken in Reihenfolge und die Kacheln zur Auswahl. */
  blanks?: Blank[]
  bank?: string[]
  cardsLabel?: string
  cards?: QuizCard[]
  /** Kurzer Text über den Karten, z. B. Spielsituation. */
  context?: string
  options: QuizOption[]
  correct: string
  explanation: string
  /** Optionaler Zusatz nach der Antwort (z. B. Zugprotokoll). */
  details?: { title: string; lines: string[] }
}

export interface QuizContext {
  rng: Rng
  decklist: DeckEntry[]
  commander: string
  lookup: (name: string) => CardInfo | undefined
}

export const QUESTIONS_PER_LESSON = 5

// --- Hilfen -----------------------------------------------------------------

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]
const int = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1))

/** Antwortoptionen mischen; richtige Antwort per ID merken. */
function choice(rng: Rng, correctLabel: string, wrongLabels: string[]): { options: QuizOption[]; correct: string } {
  const unique = [...new Set(wrongLabels.filter((l) => l !== correctLabel))].slice(0, 3)
  const options = shuffle(
    [{ id: 'a', label: correctLabel }, ...unique.map((label, i) => ({ id: `w${i}`, label }))],
    rng,
  )
  return { options, correct: 'a' }
}

/** Optionen in fester Reihenfolge (z. B. Zug 3, 4, 5 …). */
function ordered(labels: string[], correctIndex: number): { options: QuizOption[]; correct: string } {
  return { options: labels.map((label, i) => ({ id: `o${i}`, label })), correct: `o${correctIndex}` }
}

const costLabel = (generic: number) => (generic > 0 ? `${generic}GG` : 'GG')
const timesText = (n: number) => (n === 0 ? 'noch nie' : n === 1 ? 'schon 1×' : `schon ${n}×`)
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

/** Anteil der Deckkarten mit geladenen Daten (für Lektionen mit echten Karten). */
export function cardCoverage(ctx: Pick<QuizContext, 'decklist' | 'lookup'>): number {
  const lib = deckLibrary(ctx)
  return lib.length ? lib.filter((c) => c.info).length / lib.length : 0
}

// --- Lektion 1: Ghalta-Mathe ------------------------------------------------------

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
      return { name: `Eine ${p}/${p}-Kreatur`, power: p, caption: `${p}/${p}`, real: false }
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
    prompt: 'Was kostet Ghalta jetzt?',
    context: real
      ? `Ghalta wurde ${timesText(casts)} aus der Command Zone gecastet.`
      : `Auf dem Feld: ${board.map((c) => c.name).join(', ')}. Ghalta wurde ${timesText(casts)} gecastet.`,
    ...(real ? { cardsLabel: 'Deine Kreaturen auf dem Feld', cards: board.map((c) => ({ name: c.name, caption: c.caption })) } : {}),
    ...choice(rng, cost.label, wrong),
    explanation: `10 generisch${casts ? ` + ${2 * casts} Steuer` : ''} = ${10 + 2 * casts}, minus ${power} Stärke → ${cost.generic} generisch. Dazu immer GG: ${cost.label}.`,
  }
}

function ghaltaThresholdQuestion(ctx: QuizContext, n: number): Question {
  const casts = int(0, 2, ctx.rng)
  const needed = 10 + 2 * casts
  return {
    id: `ghalta-threshold-${n}`,
    prompt: `Ghalta wurde ${timesText(casts)} gecastet. Wie viel Stärke brauchst du, damit sie nur GG kostet?`,
    ...choice(ctx.rng, String(needed), [String(needed - 2), String(needed + 2), String(needed + 4), '12'].filter((x) => x !== String(needed))),
    explanation: `Die Reduktion wirkt nur auf den generischen Teil: 10${casts ? ` + ${2 * casts} Steuer` : ''} = ${needed}. Mit ${needed} Stärke bleibt nur GG.`,
  }
}

function ghaltaLesson(ctx: QuizContext): Question[] {
  const qs = [0, 1, 2, 3].map((i) => ghaltaCostQuestion(ctx, i))
  qs.splice(int(1, 4, ctx.rng), 0, ghaltaThresholdQuestion(ctx, 0))
  return qs
}

// --- Lektion 2: Kampf & Trample ---------------------------------------------------

const BLOCKERS = [1, 2, 2, 3, 3, 4, 5, 6]

function trampleQuestion(ctx: QuizContext, n: number, deathtouch = false): Question {
  const { rng } = ctx
  const blockers = Array.from({ length: int(1, 2, rng) }, () => pick(BLOCKERS, rng))
  const lethal = blockers.reduce((s, t) => s + (deathtouch ? 1 : t), 0)
  const toPlayer = Math.max(0, 12 - lethal)
  const blockerText = blockers.map((t) => `${t}/${t}`).join(' und eine ')
  const wrong = [12, Math.max(0, 12 - Math.max(...blockers)), 0, toPlayer + 1, Math.max(0, toPlayer - 1)].map(String)
  return {
    id: `trample-${n}`,
    prompt: `Ghalta (12/12, Trample${deathtouch ? ', Deathtouch' : ''}) wird von einer ${blockerText} geblockt. Wie viel Schaden geht maximal an den Spieler?`,
    ...(ctx.lookup(ctx.commander) ? { cards: [{ name: ctx.commander, caption: '12/12' }] } : {}),
    ...choice(rng, String(toPlayer), wrong),
    explanation: deathtouch
      ? `Mit Deathtouch reicht 1 Schaden pro Blocker: 12 − ${blockers.length} = ${toPlayer}. Das zählt als Commander-Schaden.`
      : `Jeder Blocker braucht tödlichen Schaden (${blockers.join(' + ')} = ${lethal}). Rest 12 − ${lethal} = ${toPlayer} geht durch und zählt als Commander-Schaden.`,
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
    prompt: `Ein Gegner hat schon ${already} Commander-Schaden von Ghalta. Ghalta (12/12, Trample) greift ihn an${blocker ? ` und wird von einer ${blocker}/${blocker} geblockt` : ' und wird nicht geblockt'}. Verliert er?`,
    ...ordered(['Ja, er verliert', 'Nein, noch nicht'], dies ? 0 : 1),
    explanation: `${already} + ${dealt} = ${already + dealt} Commander-Schaden. ${dies ? 'Ab 21 verliert er, egal wie viele Lebenspunkte er hat.' : `Bis 21 fehlen noch ${21 - already - dealt}.`}`,
  }
}

function blockerGoneQuestion(ctx: QuizContext): Question {
  const trample = ctx.rng() < 0.5
  return {
    id: 'blocker-gone',
    prompt: `${trample ? 'Ghalta (12/12, Trample)' : 'Steel Leaf Champion (5/4, ohne Trample)'} wird geblockt. Vor dem Schaden wird der Blocker entfernt. Wie viel Schaden macht sie beim Spieler?`,
    ...choice(ctx.rng, trample ? '12' : '0', trample ? ['0', '6', '11'] : ['5', '4', '1']),
    explanation: trample
      ? 'Geblockt bleibt geblockt, aber mit Trample und ohne Blocker geht der volle Schaden zum Spieler.'
      : 'Geblockt bleibt geblockt: Ohne Trample macht die Kreatur gar keinen Schaden, wenn der Blocker verschwindet.',
  }
}

function fightQuestion(): Question {
  return {
    id: 'fight',
    prompt: 'Ram Through: Ghalta kämpft gegen eine 4/4, der Überschuss (8) trifft den Spieler. Zählt das als Commander-Schaden?',
    ...ordered(['Ja', 'Nein'], 1),
    explanation: 'Nein. Commander-Schaden ist nur Kampfschaden. Fight-Schaden (Ram Through, Bite Down) zählt nicht, auch nicht der Überschuss.',
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

// --- Lektion 3: Commander-Regeln ---------------------------------------------------

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

// --- Lektion 4: Mulligan-Trainer ---------------------------------------------------

function mulliganLesson(ctx: QuizContext): Question[] {
  const library = deckLibrary(ctx).filter((c) => c.info)
  const questions: Question[] = []
  let keeps = 0
  for (let attempt = 0; questions.length < QUESTIONS_PER_LESSON && attempt < 200; attempt++) {
    const hand = shuffle(library, ctx.rng).slice(0, 7)
    const report = evaluateHand(hand.map((c) => c.info))
    // Ausgewogen mischen: 2–3 Hände zum Behalten, der Rest Mulligans.
    const wantKeep = keeps < 3 && (questions.length - keeps >= 2 || ctx.rng() < 0.5)
    if (report.keep !== wantKeep && attempt < 150) continue
    if (report.keep) keeps++
    questions.push({
      id: `mulligan-${questions.length}`,
      prompt: 'Behalten oder Mulligan?',
      context: 'Dein erster Mulligan ist gratis.',
      cardsLabel: 'Deine Starthand',
      cards: hand.map((c) => ({ name: c.name })),
      ...ordered(['Behalten', 'Mulligan'], report.keep ? 0 : 1),
      explanation: `${report.keep ? 'Behalten' : 'Mulligan'} laut Faustregel (3–4 Länder oder Manakreaturen plus eine frühe dicke Kreatur). ${report.reasons.join(' ')}`,
    })
  }
  return questions
}

// --- Lektion 5: Wann kommt Ghalta? (Simulation) -------------------------------------

const TURN_BUCKETS = ['Zug 3 oder früher', 'Zug 4', 'Zug 5', 'Zug 6', 'Zug 7 oder später']
const bucketOf = (turn: number | null) => (turn === null ? 4 : Math.min(4, Math.max(0, turn - 3)))

export function describeTurn(t: TurnLog): string {
  const parts = [`Zug ${t.turn}:`]
  if (t.drew) parts.push(`zieht ${t.drew}`)
  if (t.land) parts.push(`· spielt ${t.land}`)
  const spells = t.cast.filter((c) => !c.startsWith('Ghalta'))
  if (spells.length) parts.push(`· castet ${spells.join(', ')}`)
  if (t.ghalta) parts.push('· castet GHALTA!')
  parts.push(`(Stärke ${t.power}, ${t.mana} Mana)`)
  return parts.join(' ')
}

function whenQuestion(ctx: QuizContext, library: SimCard[], n: number): Question {
  const game = simulateGame(library, Math.floor(ctx.rng() * 2 ** 31))
  const correct = bucketOf(game.ghaltaTurn)
  const shown = game.log.slice(0, game.ghaltaTurn ?? MAX_TURNS)
  return {
    id: `when-${n}`,
    prompt: 'Wann kann Ghalta mit dieser Starthand kommen?',
    context: `Der Autopilot spielt jeden Zug ein Land, zuerst Manakreaturen, dann die stärksten Kreaturen. Ohne Gegner.${game.mulligans ? ` (Nach ${game.mulligans} Mulligan${game.mulligans > 1 ? 's' : ''}.)` : ''}`,
    cardsLabel: 'Deine Starthand',
    cards: game.hand.map((c) => ({ name: c.name })),
    ...ordered(TURN_BUCKETS, correct),
    explanation:
      game.ghaltaTurn === null
        ? `Mit dieser Hand kam Ghalta bis Zug ${MAX_TURNS} nicht.`
        : `In dieser Simulation kam Ghalta in Zug ${game.ghaltaTurn}.`,
    details: { title: 'So lief die Simulation', lines: shown.map(describeTurn) },
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
    prompt: `Zug ${t.turn}: Du hast ${t.mana} Mana. Kannst du Ghalta jetzt casten, ohne vorher etwas zu spielen?`,
    cardsLabel: 'Deine Kreaturen auf dem Feld',
    cards: t.boardAtStart.map((name) => ({ name })),
    ...ordered(['Ja', 'Nein'], can ? 0 : 1),
    explanation: `Stärke ${t.powerAtStart} → Ghalta kostet ${cost.label} (${cost.total} Mana). ${can ? `${t.mana} Mana reichen.` : `${t.mana} Mana reichen nicht.`}`,
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

// --- Lektion 6: Karten kennen ----------------------------------------------------------

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
    prompt: 'Welche Karte ist das?',
    face: { ...face, text: hideSelfName(face.text, card.name) },
    hidden: ['name'],
    ...choice(ctx.rng, card.name, shuffle(others, ctx.rng)),
    explanation: `Das ist ${card.name}. ${ROLES[classify(card).role].hint}`,
  }
}

function costQuestion(ctx: QuizContext, card: CardInfo, n: number): Question {
  return {
    id: `card-cost-${n}`,
    prompt: 'Was kostet diese Karte?',
    face: faceOf(card),
    hidden: ['cost'],
    ...choice(ctx.rng, card.manaCost, shuffle(costVariants(card.manaCost), ctx.rng)),
    explanation: `${card.name} kostet ${card.cmc} Mana.`,
  }
}

function gapQuestion(ctx: QuizContext, card: CardInfo, n: number): Question | null {
  const gap = findGap(card.oracleText, ctx.rng)
  if (!gap) return null
  return {
    id: `card-gap-${n}`,
    prompt: 'Was fehlt im Kartentext?',
    face: { ...faceOf(card), text: gap.text },
    hidden: ['gap'],
    ...choice(ctx.rng, gap.answer, gap.wrong),
    explanation: `Bei ${card.name} steht dort „${gap.answer}“.`,
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
    prompt: 'Welche Rolle hat diese Karte in deinem Gameplan?',
    cards: [{ name: card.name }],
    ...choice(ctx.rng, ROLES[role].label, others),
    explanation: `${ROLES[role].label}: ${ROLES[role].hint}`,
  }
}

const TYPE_TILES = ['Kreatur', 'Spontanzauber', 'Hexerei', 'Verzauberung', 'Artefakt']
const FEMININE = new Set(['Kreatur', 'Hexerei', 'Verzauberung'])
const withArticle = (type: string) => `${FEMININE.has(type) ? 'eine' : 'ein'} ${type}`

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
    prompt: `Baue die Karte: ${card.name}`,
    context: 'Tippe die passenden Kacheln in die Lücken.',
    face,
    hidden: blanks.map((b) => b.field),
    blanks,
    bank: shuffle([...answers, ...wrong.filter((w) => !answers.includes(w))], ctx.rng),
    options: [],
    correct: '',
    explanation: `${card.name}: ${blanks.map((b) => (b.field === 'cost' ? `kostet ${card.cmc} Mana` : b.field === 'pt' ? `ist eine ${b.answer}` : `ist ${withArticle(b.answer)}`)).join(' und ')}.`,
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
  // Auffüllen, falls eine Fragenart keine passende Karte fand.
  for (let n = 1; qs.length < QUESTIONS_PER_LESSON && pool.length > 0; n++) {
    const c = next()!
    qs.push(nameQuestion(ctx, c, all, n))
  }
  const [first, ...rest] = qs
  return [first, ...shuffle(rest, ctx.rng)].filter(Boolean).slice(0, QUESTIONS_PER_LESSON)
}

// --- Lektionen --------------------------------------------------------------------

export interface Lesson {
  id: LessonId
  title: string
  description: string
  /** Braucht Kartendaten von Scryfall. */
  needsCards: boolean
  build: (ctx: QuizContext) => Question[]
}

export const LESSONS: Lesson[] = [
  { id: 'ghalta', title: 'Ghalta-Mathe', description: 'Was kostet Ghalta mit deinem Board?', needsCards: false, build: ghaltaLesson },
  { id: 'combat', title: 'Kampf & Trample', description: 'Blocker, Trample und Commander-Schaden.', needsCards: false, build: combatLesson },
  { id: 'rules', title: 'Commander-Regeln', description: 'Mulligan, Stack, Kampf, Brackets.', needsCards: false, build: rulesLesson },
  { id: 'mulligan', title: 'Mulligan-Trainer', description: 'Echte Starthände aus deinem Deck.', needsCards: true, build: mulliganLesson },
  { id: 'goldfish', title: 'Wann kommt Ghalta?', description: 'Simulierte Züge mit deinem Deck.', needsCards: true, build: goldfishLesson },
  { id: 'cards', title: 'Karten kennen', description: 'Was kostet, kann und soll jede Karte?', needsCards: true, build: cardsLesson },
]

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l])) as Record<LessonId, Lesson>

export function buildLesson(id: LessonId, ctx: Omit<QuizContext, 'rng'>, seed: number): Question[] {
  return LESSON_BY_ID[id].build({ ...ctx, rng: mulberry32(seed) })
}

