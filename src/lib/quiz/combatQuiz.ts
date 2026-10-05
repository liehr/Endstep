import { isCreature, type CardInfo } from '../cards'
import { shortName } from '../commander'
import { shuffle, type Rng } from '../sim/rng'
import { choice, int, ordered, pick, type Question, type QuizCard, type QuizContext } from './question'

// More question types for the Combat & Trample lesson: blocks, first strike, deathtouch,
// trample math, evasion, commander damage and more. Your own creatures attack where they
// fit (only ones whose rules text doesn't change the math), otherwise made-up ones.
// Rules as of the Foundations update: no damage assignment order anymore.

// --- Helpers ----------------------------------------------------------------

/** A creature in a question: one of yours (with card) or a made-up one. */
interface Body {
  name: string
  power: number
  toughness: number
  /** Keywords shown in the text, e.g. ["Trample"]. */
  kws: string[]
  card?: QuizCard
}

/** Rules text that could change combat math (keywords, pumps, damage effects …). */
const RISKY =
  /first strike|double strike|deathtouch|lifelink|indestructible|trample|flying|reach|menace|vigilance|haste|protection|shroud|defender|\bward\b|flanking|bushido|rampage|exalted|afflict|annihilator|battle cry|skulk|shadow|horsemanship|\bfear\b|intimidate|walk\b|infect|wither|toxic|banding|provoke|training|mentor|myriad|melee|dethrone|prowess|regenerat|prevent|damage|attack|block|[+-]\d+\/[+-]\d+|[+-]X\/|gets? [+-]|counters? on|power and toughness|untap/i

/** Keywords that don't change who dies in a block. */
const BLOCK_ALLOW = ['Vigilance', 'Haste', 'Lifelink', 'Trample']
/** … and that don't matter when your creature is the one being blocked or damaged. */
const HARMLESS = [...BLOCK_ALLOW, 'Flying', 'Reach', 'Menace']

const isNum = (s: string | null) => s !== null && /^\d+$/.test(s)
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
/** Article before a P/T: “an 8/8”, “a 3/3”. */
const an = (n: number) => (/^(8|11|18)$|^8\d$/.test(String(n)) ? 'an' : 'a')
/** Minus sign for negative numbers. */
const num = (n: number) => String(n).replace('-', '−')

const hasKw = (c: CardInfo, kw: string) =>
  c.keywords.some((k) => k.toLowerCase() === kw.toLowerCase()) ||
  new RegExp(`(^|\\n|, )${kw}(?=,|\\n|$| \\()`, 'i').test(c.oracleText)

/** No risky rules text apart from the allowed keywords. */
function clean(c: CardInfo, allow: readonly string[]): boolean {
  const ok = (text: string) => {
    let t = text.replace(/\([^)]*\)/g, '')
    for (const a of allow) t = t.replace(new RegExp(a, 'gi'), '')
    return !RISKY.test(t)
  }
  return ok(c.oracleText) && c.keywords.every(ok)
}

/** Your commander and deck creatures with numeric power ≥ 1 and toughness ≥ 1. */
function ownCreatures(ctx: QuizContext): CardInfo[] {
  const seen = new Set<string>()
  const out: CardInfo[] = []
  for (const name of [ctx.commander, ...ctx.decklist.map((e) => e.name)]) {
    const c = ctx.lookup(name)
    if (!c || seen.has(c.name) || !isCreature(c) || c.power === null || c.power < 1) continue
    if (!isNum(c.powerText) || !isNum(c.toughness) || Number(c.toughness) < 1) continue
    seen.add(c.name)
    out.push(c)
  }
  return out
}

const bodyOf = (c: CardInfo, kws: string[]): Body => ({
  name: c.name,
  power: c.power!,
  toughness: Number(c.toughness),
  kws,
  card: { name: c.name, caption: `${c.powerText}/${c.toughness}` },
})

interface PickOptions {
  /** Keywords the card may have. */
  allow?: string[]
  /** Keyword the creature must have (shown in the text). */
  need?: string
  /** Skip the rules text check (questions where abilities don't matter). */
  any?: (c: CardInfo) => boolean
  minPower?: number
  maxPower?: number
  minToughness?: number
}

/** One of your creatures at random, or a made-up one (more likely when few of yours fit). */
function pickBody(ctx: QuizContext, o: PickOptions = {}): Body {
  const { rng } = ctx
  const allow = [...(o.allow ?? []), ...(o.need ? [o.need] : [])]
  const minP = o.minPower ?? 1
  const minT = o.minToughness ?? 1
  const pool = ownCreatures(ctx).filter(
    (c) =>
      (o.any ? o.any(c) : clean(c, allow)) &&
      (!o.need || hasKw(c, o.need)) &&
      c.power! >= minP &&
      c.power! <= (o.maxPower ?? 99) &&
      Number(c.toughness) >= minT,
  )
  if (pool.length && rng() < Math.min(0.9, 0.55 + 0.1 * pool.length)) return bodyOf(pick(pool, rng), o.need ? [o.need] : [])
  const power = int(minP, Math.max(minP, Math.min(o.maxPower ?? 7, 7)), rng)
  return { name: '', power, toughness: int(minT, Math.max(minT, 6), rng), kws: o.need ? [o.need] : [] }
}

/** Your commander if it's a creature without damage-changing text, else a made-up one. */
function commanderBody(ctx: QuizContext): Body {
  const c = ctx.lookup(ctx.commander)
  if (c && ownCreatures(ctx).some((o) => o.name === c.name) && !/double strike|[+-]\d+\/[+-]\d+|[+-]X\/|gets? [+-]|counters? on|prevent|damage|attack|infect|toxic|wither/i.test(c.oracleText + c.keywords.join(' ')))
    return bodyOf(c, [])
  const power = int(3, 8, ctx.rng)
  return { name: '', power, toughness: int(Math.max(1, power - 2), power + 1, ctx.rng), kws: [] }
}

const pt = (b: Body) => `${b.power}/${b.toughness}`
const kwList = (b: Body) => (b.kws.length ? `, ${b.kws.join(', ')}` : '')

/** "your Ghalta (12/12, Trample)" or "your 5/4 creature with Trample". */
const yours = (b: Body) =>
  b.card
    ? `your ${shortName(b.name)} (${pt(b)}${kwList(b)})`
    : `your ${pt(b)} creature${b.kws.length ? ` with ${b.kws.join(' and ')}` : ''}`
/** Commander in the text: "Ghalta (12/12)" or "your commander (a 6/6)". */
const cmdName = (b: Body) => (b.card ? `${shortName(b.name)} (${pt(b)})` : `your commander (${an(b.power)} ${pt(b)})`)
const nameKey = (b: Body) => (b.card ? shortName(b.name).replace(/:/g, '') : 'x')
const cardsOf = (...bs: Body[]) => {
  const cards = bs.flatMap((b) => (b.card ? [b.card] : []))
  return cards.length ? { cards } : {}
}

/** Power that kills toughness t, or one that doesn't. */
const killing = (t: number, rng: Rng) => int(t, t + 2, rng)
const notKilling = (t: number, rng: Rng) => (t <= 1 ? 0 : int(1, t - 1, rng))
/** Toughness that dies to power p, or one that survives. */
const dyingTo = (p: number, rng: Rng) => int(1, Math.max(1, p), rng)
const surviving = (p: number, rng: Rng) => int(p + 1, p + 3, rng)

export const OUTCOMES = ['Only your creature dies', 'Only the blocker dies', 'Both die', 'Neither dies']
const outcome = (attackerDies: boolean, blockerDies: boolean) =>
  ordered(OUTCOMES, attackerDies ? (blockerDies ? 2 : 0) : blockerDies ? 1 : 3)
const dies = (d: boolean) => (d ? 'dies' : 'survives')

const yesNo = (yes: boolean) => ordered(['Yes', 'No'], yes ? 0 : 1)

/** Number options in ascending order: the answer, likely mistakes, then neighbors. */
function numbers(rng: Rng, answer: number, mistakes: number[], fmt: (n: number) => string = String) {
  const pool = shuffle([...new Set(mistakes.filter((w) => w >= 0 && w !== answer))], rng).slice(0, 3)
  for (let d = 1; pool.length < 3; d++) for (const w of [answer + d, answer - d]) if (w >= 0 && !pool.includes(w) && pool.length < 3) pool.push(w)
  const values = [answer, ...pool].sort((a, b) => a - b)
  return ordered(values.map(fmt), values.indexOf(answer))
}

type Gen = (ctx: QuizContext, n: number) => Question | null

// --- Blocks ------------------------------------------------------------------

const blockOutcome: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { allow: BLOCK_ALLOW })
  const a = rng() < 0.5 ? killing(att.toughness, rng) : notKilling(att.toughness, rng)
  const b = rng() < 0.5 ? dyingTo(att.power, rng) : surviving(att.power, rng)
  const aDies = a >= att.toughness
  const bDies = att.power >= b
  return {
    id: `block-outcome-${n}`,
    key: `block-outcome:${pt(att)}:${a}/${b}:${nameKey(att)}`,
    prompt: pick(
      [
        `${cap(yours(att))} attacks and is blocked by ${an(a)} ${a}/${b}. What happens?`,
        `An opponent blocks ${yours(att)} with ${an(a)} ${a}/${b}. Which creatures die?`,
        `${cap(yours(att))} attacks. The defending player blocks with ${an(a)} ${a}/${b}. What’s the result?`,
      ],
      rng,
    ),
    ...cardsOf(att),
    ...outcome(aDies, bDies),
    explanation: `Both deal damage at the same time. ${att.power} damage vs. toughness ${b}: the blocker ${dies(bDies)}. ${a} damage vs. toughness ${att.toughness}: your creature ${dies(aDies)}.`,
  }
}

const firstStrikeBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { allow: BLOCK_ALLOW })
  const a = rng() < 0.5 ? killing(att.toughness, rng) : notKilling(att.toughness, rng)
  const b = rng() < 0.6 ? dyingTo(att.power, rng) : surviving(att.power, rng)
  const aDies = a >= att.toughness
  const bDies = !aDies && att.power >= b
  return {
    id: `first-strike-block-${n}`,
    key: `first-strike-block:${pt(att)}:${a}/${b}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} attacks and is blocked by ${an(a)} ${a}/${b} with First strike. What happens?`,
    ...cardsOf(att),
    ...outcome(aDies, bDies),
    explanation: aDies
      ? `First strike damage comes first: ${a} damage kills your toughness-${att.toughness} creature before it deals any damage. The blocker survives.`
      : `The first-strike ${a} damage isn’t lethal (toughness ${att.toughness}), so your creature deals ${att.power} in the regular step: the blocker ${dies(bDies)}.`,
  }
}

const doubleStrikeBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { allow: BLOCK_ALLOW })
  const t = att.toughness
  const half = Math.ceil(t / 2)
  const c = int(0, 2, rng)
  // 0: dies to the first hit, 1: dies to both hits, 2: survives both.
  const a = c === 0 || t === 1 ? killing(t, rng) : c === 1 ? int(half, t - 1, rng) : half <= 1 ? 0 : int(1, half - 1, rng)
  const b = rng() < 0.6 ? dyingTo(att.power, rng) : surviving(att.power, rng)
  const first = a >= t
  const aDies = 2 * a >= t
  const bDies = !first && att.power >= b
  return {
    id: `double-strike-block-${n}`,
    key: `double-strike-block:${pt(att)}:${a}/${b}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} attacks and is blocked by ${an(a)} ${a}/${b} with Double strike. What happens?`,
    ...cardsOf(att),
    ...outcome(aDies, bDies),
    explanation: first
      ? `The first strike alone (${a}) kills your toughness-${t} creature before it deals damage. The blocker survives.`
      : `First strike step: ${a} damage, not lethal. Regular step: your creature deals ${att.power} (blocker ${dies(bDies)}) while the blocker hits again: ${a} + ${a} = ${2 * a} vs. toughness ${t}, your creature ${dies(aDies)}.`,
  }
}

const deathtouchBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { allow: BLOCK_ALLOW })
  const fs = rng() < 0.4
  const a = int(1, 3, rng)
  const b = rng() < 0.55 ? dyingTo(att.power, rng) : surviving(att.power, rng)
  const bDies = att.power >= b
  const aDies = fs ? !bDies : true
  return {
    id: `deathtouch-block-${n}`,
    key: `deathtouch-block:${fs ? 'fs' : 'plain'}:${pt(att)}:${a}/${b}:${nameKey(att)}`,
    prompt: fs
      ? `${cap(yours(att))} is blocked by ${an(a)} ${a}/${b} with Deathtouch. Before damage, you give your creature First strike. What happens?`
      : `${cap(yours(att))} attacks and is blocked by ${an(a)} ${a}/${b} with Deathtouch. What happens?`,
    ...cardsOf(att),
    ...outcome(aDies, bDies),
    explanation: fs
      ? bDies
        ? `With First strike, your ${att.power} damage kills the toughness-${b} blocker first, so its Deathtouch damage never happens.`
        : `${att.power} first-strike damage doesn’t kill toughness ${b}, so the blocker strikes back, and any Deathtouch damage is lethal.`
      : `Any damage from a Deathtouch creature is lethal, so your creature dies. It deals ${att.power} to toughness ${b}: the blocker ${dies(bDies)}.`,
  }
}

const indestructibleBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  if (rng() < 0.5) {
    const att = pickBody(ctx, { need: 'Trample', allow: BLOCK_ALLOW, minPower: 3 })
    const p = att.power
    const b = int(1, p + 1, rng)
    const a = int(0, 6, rng)
    const toPlayer = Math.max(0, p - b)
    return {
      id: `indestructible-block-${n}`,
      key: `indestructible-block:trample:${p}:${a}/${b}:${nameKey(att)}`,
      prompt: `${cap(yours(att))} is blocked by an indestructible ${a}/${b}. What’s the most damage that can go to the player?`,
      ...cardsOf(att),
      ...numbers(rng, toPlayer, [0, p, p - b - 1, p - 1]),
      explanation: `Indestructible doesn’t change what lethal damage is: ${b} counts as lethal for the ${a}/${b}, even though it won’t die. ${toPlayer > 0 ? `${p} − ${b} = ${toPlayer} tramples over.` : `${p} isn’t more than ${b}, so nothing tramples over.`}`,
    }
  }
  const att = pickBody(ctx, { allow: BLOCK_ALLOW })
  const a = rng() < 0.5 ? killing(att.toughness, rng) : notKilling(att.toughness, rng)
  const b = dyingTo(att.power, rng)
  const aDies = a >= att.toughness
  return {
    id: `indestructible-block-${n}`,
    key: `indestructible-block:plain:${pt(att)}:${a}/${b}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} attacks and is blocked by an indestructible ${a}/${b}. What happens?`,
    ...cardsOf(att),
    ...outcome(aDies, false),
    explanation: `Indestructible creatures aren’t destroyed by lethal damage, so the blocker survives your ${att.power} damage. It deals ${a} to your toughness-${att.toughness} creature: yours ${dies(aDies)}.`,
  }
}

const combatTrick: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { allow: BLOCK_ALLOW })
  const k = int(1, 4, rng)
  const you = rng() < 0.5
  const a = int(0, att.toughness + 2, rng)
  const b = int(1, att.power + 2, rng)
  const [p, t] = you ? [att.power + k, att.toughness + k] : [att.power, att.toughness]
  const [a2, b2] = you ? [a, b] : [a + k, b + k]
  const aDies = a2 >= t
  const bDies = p >= b2
  return {
    id: `combat-trick-${n}`,
    key: `combat-trick:${you ? 'you' : 'them'}:${pt(att)}:${a}/${b}:${k}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} is blocked by ${an(a)} ${a}/${b}. ${you ? `You cast a +${k}/+${k} trick on your creature.` : `The opponent casts a +${k}/+${k} trick on their blocker.`} What happens?`,
    ...cardsOf(att),
    ...outcome(aDies, bDies),
    explanation: `After the trick: your creature is ${p}/${t}, the blocker ${a2}/${b2}. ${p} damage vs. toughness ${b2}: the blocker ${dies(bDies)}. ${a2} damage vs. toughness ${t}: yours ${dies(aDies)}.`,
  }
}

const doubleBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { allow: ['Vigilance', 'Haste', 'Lifelink'], minPower: 2 })
  const p = att.power
  const c = int(0, 2, rng)
  let b1: number
  let b2: number
  if (c === 0) {
    b1 = int(1, p - 1, rng)
    b2 = int(1, p - b1, rng)
  } else if (c === 1) {
    b1 = int(1, p, rng)
    b2 = int(Math.max(1, p - b1 + 1), p + 3, rng)
  } else {
    b1 = int(p + 1, p + 3, rng)
    b2 = int(p + 1, p + 3, rng)
  }
  ;[b1, b2] = shuffle([b1, b2], rng)
  const a1 = int(0, 4, rng)
  const a2 = int(0, 4, rng)
  const answer = p >= b1 + b2 ? 0 : p >= Math.min(b1, b2) ? 1 : 2
  return {
    id: `double-block-${n}`,
    key: `double-block:${pt(att)}:${a1}/${b1}:${a2}/${b2}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} doesn’t have Trample and is blocked by ${an(a1)} ${a1}/${b1} and ${an(a2)} ${a2}/${b2}. How many blockers can it destroy?`,
    ...cardsOf(att),
    ...ordered(['Both', 'One', 'None'], answer),
    explanation: `There’s no damage assignment order: you divide the ${p} damage among the blockers as you like. ${
      answer === 0
        ? `${b1} + ${b2} = ${b1 + b2} is enough for both.`
        : answer === 1
          ? `${b1} + ${b2} = ${b1 + b2} is too much, but lethal on the toughness-${Math.min(b1, b2)} blocker works.`
          : `Each blocker needs more than ${p}, so none dies.`
    }`,
  }
}

const gangBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { allow: BLOCK_ALLOW })
  const t = att.toughness
  let a1: number
  let a2: number
  if (rng() < 0.5) {
    a1 = int(0, t - 1, rng)
    a2 = int(0, t - 1 - a1, rng)
  } else {
    a1 = int(1, Math.max(1, t - 1), rng)
    a2 = int(Math.max(0, t - a1), Math.max(t - a1, t - 1), rng)
  }
  const b1 = int(1, 5, rng)
  const b2 = int(1, 5, rng)
  const survives = a1 + a2 < t
  return {
    id: `gang-block-${n}`,
    key: `gang-block:${pt(att)}:${a1}/${b1}:${a2}/${b2}:${nameKey(att)}`,
    prompt: pick(
      [
        `${cap(yours(att))} is blocked by ${an(a1)} ${a1}/${b1} and ${an(a2)} ${a2}/${b2}. Does your creature survive?`,
        `Two creatures, ${an(a1)} ${a1}/${b1} and ${an(a2)} ${a2}/${b2}, block ${yours(att)}. Does it survive combat?`,
      ],
      rng,
    ),
    ...cardsOf(att),
    ...yesNo(survives),
    explanation: `Both blockers deal damage at the same time: ${a1} + ${a2} = ${a1 + a2} vs. toughness ${t}. ${survives ? 'Not lethal, it survives.' : 'That’s lethal.'}`,
  }
}

const bestBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  const own = shuffle(
    ownCreatures(ctx).filter((c) => clean(c, HARMLESS)),
    rng,
  )
    .slice(0, int(3, 4, rng))
    .map((c) => ({ label: `${shortName(c.name)} (${c.power}/${c.toughness})`, p: c.power!, t: Number(c.toughness), card: bodyOf(c, []).card! }))
  const cands: { label: string; p: number; t: number; card?: QuizCard }[] = [...own]
  while (cands.length < 3 || (own.length < 3 && cands.length < 4 && rng() < 0.5)) {
    const p = int(1, 6, rng)
    const t = int(1, 6, rng)
    const label = `A ${p}/${t} creature`
    if (!cands.some((c) => c.label === label)) cands.push({ label, p, t })
  }
  for (let tries = 0; tries < 80; tries++) {
    const a = int(1, 8, rng)
    const b = int(1, 8, rng)
    const good = cands.filter((c) => c.p >= b && c.t > a)
    if (good.length !== 1) continue
    const best = good[0]
    const cards = cands.flatMap((c) => (c.card ? [c.card] : []))
    return {
      id: `best-block-${n}`,
      key: `best-block:${a}/${b}:${cands.map((c) => c.label.replace(/:/g, '')).sort().join('|')}`,
      prompt: `An opponent attacks you with ${an(a)} ${a}/${b}. Which of your creatures can block it, destroy it and survive?`,
      ...(cards.length ? { cardsLabel: 'Your untapped creatures', cards } : {}),
      ...choice(
        rng,
        best.label,
        cands.filter((c) => c !== best).map((c) => c.label),
      ),
      explanation: `${best.label} deals ${best.p} (at least ${b}) and has toughness ${best.t} (more than ${a}). The others either deal too little damage or don’t survive ${a}.`,
    }
  }
  return null
}

// --- Evasion and tapping -----------------------------------------------------

const CAN_BLOCK = ['fly-ground', 'fly-reach', 'fly-fly', 'ground-fly', 'menace-one', 'menace-two', 'tapped', 'new'] as const

const canBlock: Gen = (ctx, n) => {
  const { rng } = ctx
  const v = pick(CAN_BLOCK, rng)
  const need = v.startsWith('fly-') ? 'Flying' : v.startsWith('menace') ? 'Menace' : undefined
  const att = pickBody(ctx, need ? { need, allow: BLOCK_ALLOW } : { allow: BLOCK_ALLOW })
  const a = int(0, 6, rng)
  const b = int(1, 6, rng)
  const c = int(1, 4, rng)
  const d = int(1, 4, rng)
  const [situation, yes, why] = {
    'fly-ground': [`The opponent’s only untapped creature is ${an(a)} ${a}/${b} without Flying or Reach.`, false, 'A creature with Flying can only be blocked by creatures with Flying or Reach.'],
    'fly-reach': [`The opponent’s only untapped creature is ${an(a)} ${a}/${b} with Reach.`, true, 'Reach lets a creature block creatures with Flying.'],
    'fly-fly': [`The opponent’s only untapped creature is ${an(a)} ${a}/${b} with Flying.`, true, 'Creatures with Flying can block other flyers.'],
    'ground-fly': [`The opponent’s only untapped creature is ${an(a)} ${a}/${b} with Flying.`, true, 'Flying only limits what can block the flyer. A flyer can block ground creatures just fine.'],
    'menace-one': [`The opponent has only one untapped creature, ${an(a)} ${a}/${b}.`, false, 'A creature with Menace can’t be blocked except by two or more creatures.'],
    'menace-two': [`The opponent has two untapped creatures, ${an(a)} ${a}/${b} and ${an(c)} ${c}/${d}.`, true, 'Both block it together: Menace only needs two or more blockers.'],
    tapped: [`The opponent’s only creature is a tapped ${a}/${b}.`, false, 'Tapped creatures can’t block.'],
    new: [`The opponent’s only creature is ${an(a)} ${a}/${b} that entered the battlefield this turn.`, true, 'Summoning sickness only stops attacking and {T} abilities, not blocking.'],
  }[v] as [string, boolean, string]
  return {
    id: `can-block-${n}`,
    key: `can-block:${v}:${a}/${b}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} attacks. ${situation} Can they block it?`,
    ...cardsOf(att),
    ...yesNo(yes),
    explanation: `${yes ? 'Yes' : 'No'}. ${why}`,
  }
}

const SICK = ['cast', 'haste', 'block', 'steal', 'eot'] as const
const NO_HASTE = (c: CardInfo) => !/haste|defender|can't attack|can't block|attack|block/i.test(c.oracleText + c.keywords.join(' '))

const summoningSick: Gen = (ctx, n) => {
  const { rng } = ctx
  const v = pick(SICK, rng)
  const b = pickBody(ctx, { any: NO_HASTE })
  const it = v === 'steal' ? `an opponent’s ${pt(b)}` : yours(b)
  const [prompt, yes, why] = {
    cast: [`You cast ${it} this turn. Can it attack this turn?`, false, 'Without Haste it’s summoning sick: it can only attack if you’ve controlled it since the start of your most recent turn.'],
    haste: [`You cast ${it} this turn, and an effect gives your creatures Haste. Can it attack this turn?`, true, 'Haste lets a creature attack (and use {T} abilities) the turn it comes under your control.'],
    block: [`You cast ${it} on your turn. On the next opponent’s turn, can it block?`, true, 'Summoning sickness never stops blocking.'],
    steal: [`You gain control of ${it} this turn. It has been on the battlefield for many turns. Can it attack this turn?`, false, 'What counts is how long YOU have controlled it: not since the start of your turn, so it can’t attack without Haste.'],
    eot: [`${cap(it)} entered the battlefield at the end of the last opponent’s turn. Can it attack on your turn?`, true, 'You’ve controlled it continuously since your turn began, so it’s no longer summoning sick.'],
  }[v] as [string, boolean, string]
  return {
    id: `summoning-sick-${n}`,
    key: `summoning-sick:${v}:${v === 'steal' ? pt(b) : nameKey(b)}`,
    prompt,
    ...(v === 'steal' ? {} : cardsOf(b)),
    ...yesNo(yes),
    explanation: `${yes ? 'Yes' : 'No'}. ${why}`,
  }
}

const VIGILANCE = ['vig-block', 'plain-block', 'vig-tap', 'block-tap'] as const
const NO_VIGILANCE = (c: CardInfo) => !/vigilance|untap|defender|can't attack|can't block|attack|block/i.test(c.oracleText + c.keywords.join(' '))

const vigilance: Gen = (ctx, n) => {
  const { rng } = ctx
  const v = pick(VIGILANCE, rng)
  const b = pickBody(ctx, { any: NO_VIGILANCE })
  const it = yours(b)
  const [prompt, yes, why] = {
    'vig-block': [`${cap(it)} has Vigilance this turn and attacks. Can it block on the next opponent’s turn?`, true, 'Vigilance means attacking doesn’t tap it, so it’s still untapped to block.'],
    'plain-block': [`${cap(it)} attacks (no Vigilance). Can it block on the next opponent’s turn?`, false, 'Attacking tapped it, and it only untaps in your next untap step, after the opponents’ turns.'],
    'vig-tap': [`${cap(it)} has Vigilance this turn. Does attacking tap it?`, false, 'That’s exactly what Vigilance does: it attacks without tapping.'],
    'block-tap': [`${cap(it)} blocks an attacker. Does blocking tap it?`, false, 'Blocking never taps a creature. Only attacking does (unless it has Vigilance).'],
  }[v] as [string, boolean, string]
  return {
    id: `vigilance-${n}`,
    key: `vigilance:${v}:${nameKey(b)}`,
    prompt,
    ...cardsOf(b),
    ...yesNo(yes),
    explanation: `${yes ? 'Yes' : 'No'}. ${why}`,
  }
}

// --- Trample -----------------------------------------------------------------

const trampleMarked: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { need: 'Trample', allow: BLOCK_ALLOW, minPower: 3 })
  const p = att.power
  const b = int(2, p + 2, rng)
  const d = int(1, b - 1, rng)
  const a = int(0, 5, rng)
  const lethal = b - d
  const toPlayer = Math.max(0, p - lethal)
  return {
    id: `trample-marked-${n}`,
    key: `trample-marked:${p}:${a}/${b}:${d}:${nameKey(att)}`,
    prompt: pick(
      [
        `${cap(yours(att))} is blocked by ${an(a)} ${a}/${b} that already took ${d} damage this turn. What’s the most damage that can go to the player?`,
        `Earlier this turn you dealt ${d} damage to an opponent’s ${a}/${b}. Now it blocks ${yours(att)}. How much can trample over?`,
      ],
      rng,
    ),
    ...cardsOf(att),
    ...numbers(rng, toPlayer, [Math.max(0, p - b), p, p - d, 0]),
    explanation: `Lethal damage counts damage already marked this turn: ${b} − ${d} = ${lethal}. ${toPlayer > 0 ? `${p} − ${lethal} = ${toPlayer} tramples over.` : `${p} isn’t more than ${lethal}, so nothing tramples over.`}`,
  }
}

const tramplePump: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { need: 'Trample', allow: BLOCK_ALLOW, minPower: 3 })
  const p = att.power
  const k = int(1, 4, rng)
  const you = rng() < 0.55
  const a = int(1, 5, rng)
  const b = you ? int(1, p + k, rng) : int(1, p, rng)
  const lethal = you ? b : b + k
  const total = you ? p + k : p
  const toPlayer = Math.max(0, total - lethal)
  return {
    id: `trample-pump-${n}`,
    key: `trample-pump:${you ? 'you' : 'them'}:${p}:${a}/${b}:${k}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} is blocked by ${an(a)} ${a}/${b}. After blocks, ${you ? 'you give your attacker' : 'the opponent gives their blocker'} +${k}/+${k}. What’s the most damage that can go to the player?`,
    ...cardsOf(att),
    ...numbers(rng, toPlayer, you ? [Math.max(0, p - b), p + k, p + k - b + k] : [Math.max(0, p - b), Math.max(0, p - b + k), p]),
    explanation: you
      ? `Your attacker now deals ${p} + ${k} = ${total}. The blocker still needs ${b}: ${total} − ${b} = ${toPlayer} to the player.`
      : `The blocker now has toughness ${b} + ${k} = ${lethal}, and that much is lethal. ${toPlayer > 0 ? `${p} − ${lethal} = ${toPlayer} tramples over.` : `${p} isn’t more than ${lethal}: nothing tramples over.`}`,
  }
}

const trampleAssign: Gen = (ctx, n) => {
  const { rng } = ctx
  const att = pickBody(ctx, { need: 'Trample', allow: BLOCK_ALLOW, minPower: 4 })
  const p = att.power
  const x = int(1, p - 2, rng)
  const y = int(1, p - 1 - x, rng)
  const [small, big] = [Math.min(x, y), Math.max(x, y)]
  const sa = int(0, 4, rng)
  const ba = small === big ? sa + 1 : int(0, 4, rng)
  const S = `${sa}/${small}`
  const B = `${ba}/${big}`
  const v = pick(['skip', 'each', 'one'] as const, rng)
  const [question, yes] = {
    skip: [`Can you assign ${big} to the ${B}, ${p - big} to the player and nothing to the ${S}?`, false],
    each: [`Can you assign ${small} to the ${S}, ${big} to the ${B} and ${p - small - big} to the player?`, true],
    one: [`Can you assign all ${p} damage to the ${B} and nothing to the ${S}?`, true],
  }[v] as [string, boolean]
  return {
    id: `trample-assign-${n}`,
    key: `trample-assign:${v}:${p}:${S}:${B}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} is blocked by a ${S} and a ${B}. ${question}`,
    ...cardsOf(att),
    ...yesNo(yes),
    explanation: {
      skip: `No. With Trample, every blocker needs lethal damage before any goes to the player: ${small} + ${big} = ${small + big}, so at most ${p - small - big} reaches the player.`,
      each: 'Yes. Both blockers get lethal damage, so the rest may trample over to the player.',
      one: 'Yes. There’s no damage assignment order anymore: you divide damage among the blockers as you like. You only need lethal on all of them to send damage to the player.',
    }[v],
  }
}

const doubleStrike: Gen = (ctx, n) => {
  const { rng } = ctx
  const v = pick(['unblocked', 'blocked', 'trample', 'trample'] as const, rng)
  const att = v === 'trample'
    ? pickBody(ctx, { need: 'Trample', allow: BLOCK_ALLOW, minPower: 2 })
    : pickBody(ctx, { allow: ['Vigilance', 'Haste', 'Lifelink'] })
  const p = att.power
  const a = int(0, 5, rng)
  const b = v === 'trample' ? int(1, 2 * p + 1, rng) : int(1, 6, rng)
  const answer = v === 'unblocked' ? 2 * p : v === 'blocked' ? 0 : Math.max(0, 2 * p - b)
  const situation = v === 'unblocked' ? 'and it isn’t blocked' : `and it’s blocked by ${an(a)} ${a}/${b}`
  return {
    id: `double-strike-${n}`,
    key: `double-strike:${v}:${p}:${v === 'unblocked' ? '-' : `${a}/${b}`}:${nameKey(att)}`,
    prompt: `You give ${yours(att)} Double strike, ${situation}. How much damage can the defending player take?`,
    ...cardsOf(att),
    ...numbers(rng, answer, v === 'unblocked' ? [p, 3 * p] : v === 'blocked' ? [p, 2 * p, Math.max(0, p - b)] : [Math.max(0, p - b), 2 * Math.max(0, p - b), 2 * p]),
    explanation:
      v === 'unblocked'
        ? `Double strike deals damage twice: ${p} + ${p} = ${2 * p}.`
        : v === 'blocked'
          ? 'Without Trample, a blocked creature never damages the player, no matter how often it strikes.'
          : answer === 0
            ? `Both strikes together deal ${2 * p}, not more than toughness ${b}: nothing tramples over.`
            : p >= b
              ? `First strike step: ${b} to the blocker, ${p - b} to the player. The blocker dies, so in the regular step all ${p} goes to the player: ${2 * p - b}.`
              : `First strike step: all ${p} to the blocker (not lethal yet). Regular step: it needs only ${b - p} more (marked damage counts), the other ${2 * p - b} tramples over.`,
  }
}

// --- Damage and life ---------------------------------------------------------

const LIFELINK = ['unblocked', 'blocked', 'fs-kill', 'fs-weak'] as const

const lifelink: Gen = (ctx, n) => {
  const { rng } = ctx
  const v = pick(LIFELINK, rng)
  const att = pickBody(ctx, { allow: ['Lifelink', 'Vigilance', 'Haste'] })
  const p = att.power
  const t = att.toughness
  const a = v === 'fs-kill' ? killing(t, rng) : v === 'fs-weak' ? notKilling(t, rng) : int(0, 5, rng)
  const b = v === 'blocked' ? (rng() < 0.5 ? dyingTo(p, rng) : surviving(p, rng)) : int(1, 6, rng)
  const gained = v === 'fs-kill' ? 0 : p
  const situation = {
    unblocked: 'It isn’t blocked.',
    blocked: `It’s blocked by ${an(a)} ${a}/${b}.`,
    'fs-kill': `It’s blocked by ${an(a)} ${a}/${b} with First strike.`,
    'fs-weak': `It’s blocked by ${an(a)} ${a}/${b} with First strike.`,
  }[v]
  return {
    id: `lifelink-${n}`,
    key: `lifelink:${v}:${pt(att)}:${v === 'unblocked' ? '-' : `${a}/${b}`}:${nameKey(att)}`,
    prompt: `${cap(yours(att))} has Lifelink and attacks. ${situation} How much life do you gain?`,
    ...cardsOf(att),
    ...numbers(rng, gained, [0, p, Math.min(p, b), 2 * p, p - 1]),
    explanation: {
      unblocked: `Lifelink gains you as much life as the damage dealt: ${p}.`,
      blocked: `Without Trample, all ${p} damage goes to the blocker, even beyond lethal, and Lifelink counts all of it: ${p}.`,
      'fs-kill': `The first-strike ${a} damage kills your toughness-${t} creature before it deals damage. No damage, no life.`,
      'fs-weak': `Your creature survives the first-strike damage (${a} vs. toughness ${t}) and then deals ${p}: you gain ${p}.`,
    }[v],
  }
}

const markedDamage: Gen = (ctx, n) => {
  const { rng } = ctx
  const b = pickBody(ctx, { allow: HARMLESS, minToughness: 2 })
  const t = b.toughness
  const d = int(1, t - 1, rng)
  const same = rng() < 0.5
  const answer = same ? t - d : t
  return {
    id: `marked-damage-${n}`,
    key: `marked-damage:${same ? 'same' : 'next'}:${t}:${d}:${nameKey(b)}`,
    prompt: same
      ? `${cap(yours(b))} took ${d} damage from a spell earlier this turn. How much more damage destroys it this turn?`
      : `During an opponent’s turn, ${yours(b)} took ${d} damage and survived. On your next turn, how much damage destroys it?`,
    ...cardsOf(b),
    ...numbers(rng, answer, [t, t - d, d, t + d]),
    explanation: same
      ? `Damage stays marked until the end of the turn: ${t} − ${d} = ${t - d} more is lethal.`
      : `Damage wears off in the cleanup step at the end of every turn, so it needs the full ${t} again.`,
  }
}

interface Striker {
  label: string
  p: number
  trample: boolean
  /** Toughness of the blocker, if blocked. */
  blockedBy?: number
  card?: QuizCard
}

/** An attack with 3–4 creatures, 1–2 of them blocked by made-up creatures. */
function attack(ctx: QuizContext) {
  const { rng } = ctx
  const size = int(3, 4, rng)
  const own = shuffle(
    ownCreatures(ctx).filter((c) => clean(c, BLOCK_ALLOW)),
    rng,
  ).filter(() => rng() < 0.8)
  const strikers: Striker[] = own.slice(0, size).map((c) => {
    const trample = hasKw(c, 'Trample')
    return { label: `${shortName(c.name)} (${c.power}/${c.toughness}${trample ? ', Trample' : ''})`, p: c.power!, trample, card: bodyOf(c, []).card }
  })
  while (strikers.length < size) {
    const p = int(1, 6, rng)
    const trample = rng() < 0.3
    strikers.push({ label: `a ${p}/${p} token${trample ? ' with Trample' : ''}`, p, trample })
  }
  const blocked = shuffle([...strikers.keys()], rng).slice(0, int(1, 2, rng))
  for (const i of blocked) strikers[i].blockedBy = int(1, 6, rng)
  const hit = (s: Striker) => (s.blockedBy === undefined ? s.p : s.trample ? Math.max(0, s.p - s.blockedBy) : 0)
  const total = strikers.reduce((sum, s) => sum + hit(s), 0)
  const blocks = strikers.filter((s) => s.blockedBy !== undefined).map((s) => `${s.label} with a ${int(0, 4, rng)}/${s.blockedBy}`)
  const cards = strikers.flatMap((s) => (s.card ? [s.card] : []))
  return {
    strikers,
    total,
    context: `You attack with ${strikers.map((s) => s.label).join(', ')}. The opponent blocks ${blocks.join(' and ')}.`,
    keyPart: `${strikers.map((s) => `${s.p}${s.trample ? 't' : ''}>${s.blockedBy ?? '-'}`).join('+')}`,
    names: strikers.map((s) => s.label.replace(/:/g, '')).join('|'),
    cards: cards.length ? { cardsLabel: 'Your attackers', cards } : {},
    math: `${strikers.map((s) => (s.blockedBy === undefined ? `${s.p}` : s.trample ? `${Math.max(0, s.p - s.blockedBy)} (trample)` : '0 (blocked)')).join(' + ')} = ${total}`,
  }
}

const alphaStrike: Gen = (ctx, n) => {
  const s = attack(ctx)
  const maxHit = Math.max(...s.strikers.map((x) => x.p))
  const all = s.strikers.reduce((sum, x) => sum + x.p, 0)
  const unblocked = s.strikers.filter((x) => x.blockedBy === undefined).reduce((sum, x) => sum + x.p, 0)
  return {
    id: `alpha-strike-${n}`,
    key: `alpha-strike:${s.keyPart}:${s.names}`,
    prompt: 'How much combat damage does the defending player take?',
    context: s.context,
    ...s.cards,
    ...numbers(ctx.rng, s.total, [all, unblocked, all - maxHit, s.total + 2]),
    explanation: `Blocked creatures without Trample deal nothing to the player; tramplers deal what’s left after lethal to their blocker. ${s.math}.`,
  }
}

const lethalCheck: Gen = (ctx, n) => {
  const s = attack(ctx)
  const life = Math.max(1, s.total + pick([-4, -2, -1, 0, 1, 2, 3, 5], ctx.rng))
  const lethal = s.total >= life
  return {
    id: `lethal-check-${n}`,
    key: `lethal-check:${s.keyPart}:${life}:${s.names}`,
    prompt: `The defending player is at ${life} life. Is this attack lethal?`,
    context: s.context,
    ...s.cards,
    ...yesNo(lethal),
    explanation: `Damage to the player: ${s.math}. ${lethal ? `That’s at least ${life}: lethal.` : `${life - s.total} short of lethal.`}`,
  }
}

// --- Commander damage --------------------------------------------------------

const cmdHits: Gen = (ctx, n) => {
  const { rng } = ctx
  const cmd = commanderBody(ctx)
  const bonus = pick([0, 0, 0, 1, 2, 3], rng)
  const per = cmd.power + bonus
  const d = int(0, 20, rng)
  const hits = Math.ceil((21 - d) / per)
  const base = Math.max(1, hits - 1)
  const labels = [0, 1, 2, 3].map((i) => `${base + i} ${base + i === 1 ? 'hit' : 'hits'}`)
  return {
    id: `cmd-hits-${n}`,
    key: `cmd-hits:${cmd.power}:${bonus}:${d}:${nameKey(cmd)}`,
    prompt: `${cap(cmdName(cmd))} has dealt an opponent ${d} commander damage so far${bonus ? ` and now carries Equipment that gives +${bonus}/+0` : ''}. If it connects unblocked every turn, how many more hits until they have 21 commander damage?`,
    ...cardsOf(cmd),
    ...ordered(labels, hits - base),
    explanation: `${21 - d} to go at ${per} per hit: ${21 - d} ÷ ${per} → ${hits} ${hits === 1 ? 'hit' : 'hits'}.`,
  }
}

export const LIFE_OUTCOMES = ['Yes, their life hits 0', 'Yes, 21 commander damage', 'Yes, both at once', 'No, they survive']

const cmdVsLife: Gen = (ctx, n) => {
  const { rng } = ctx
  const cmd = commanderBody(ctx)
  const p = cmd.power
  // Ranges per outcome: [C min, C max, L min, L max(C)]; their life is at most 40 − C.
  const ranges: [number, number, number, (c: number) => number][] = [
    [0, 20 - p, 1, (c) => Math.min(p, 40 - c)],
    [21 - p, 20, p + 1, (c) => 40 - c],
    [21 - p, 20, 1, (c) => Math.min(p, 40 - c)],
    [0, 20 - p, p + 1, (c) => 40 - c],
  ]
  for (const i of shuffle([0, 1, 2, 3], rng)) {
    const [cMin, cMax, lMin, lMax] = ranges[i]
    if (Math.max(0, cMin) > cMax) continue
    const c = int(Math.max(0, cMin), cMax, rng)
    if (lMin > lMax(c)) continue
    const life = int(lMin, Math.min(lMax(c), lMin + 12), rng)
    const byLife = life - p <= 0
    const byCmd = c + p >= 21
    return {
      id: `cmd-vs-life-${n}`,
      key: `cmd-vs-life:${p}:${life}:${c}:${nameKey(cmd)}`,
      prompt: `An opponent is at ${life} life and has taken ${c} commander damage from ${cmdName(cmd)}. It hits them unblocked for ${p}. Do they lose?`,
      ...cardsOf(cmd),
      ...ordered(LIFE_OUTCOMES, byLife ? (byCmd ? 2 : 0) : byCmd ? 1 : 3),
      explanation: `Commander damage is still damage, so it costs life too: ${life} − ${p} = ${num(life - p)} life, and ${c} + ${p} = ${c + p} commander damage. ${byLife || byCmd ? 'They lose.' : 'Neither reaches the limit.'}`,
    }
  }
  return null
}

const cmdTally: Gen = (ctx, n) => {
  const { rng } = ctx
  const cmd = commanderBody(ctx)
  const a = int(3, 20, rng)
  const b = int(1, 8, rng)
  let c = int(1, 14, rng)
  if (c === b) c++
  const name = cmdName(cmd)
  return {
    id: `cmd-tally-${n}`,
    key: `cmd-tally:${a}:${b}:${c}:${nameKey(cmd)}`,
    prompt: `This game, ${name} dealt an opponent ${a} combat damage and ${b} damage in fights. Another player’s commander dealt them ${c} combat damage. How much commander damage from ${cmd.card ? shortName(cmd.name) : 'your commander'} do they have?`,
    ...cardsOf(cmd),
    ...numbers(rng, a, [a + b, a + c, a + b + c]),
    explanation: `Only combat damage from the same commander counts: ${a}. Fight damage isn’t combat damage, and every commander is tracked separately.`,
  }
}

// --- Pool --------------------------------------------------------------------

const GENERATORS: Gen[] = [
  blockOutcome,
  firstStrikeBlock,
  doubleStrikeBlock,
  deathtouchBlock,
  indestructibleBlock,
  combatTrick,
  doubleBlock,
  gangBlock,
  bestBlock,
  canBlock,
  summoningSick,
  vigilance,
  trampleMarked,
  tramplePump,
  trampleAssign,
  doubleStrike,
  lifelink,
  markedDamage,
  alphaStrike,
  lethalCheck,
  cmdHits,
  cmdVsLife,
  cmdTally,
]

/** Candidate questions for the Combat & Trample lesson (two per type, unique keys). */
export function combatQuestions(ctx: QuizContext): Question[] {
  const out: Question[] = []
  const keys = new Set<string>()
  for (const gen of GENERATORS) {
    for (let i = 0; i < 2; i++) {
      const q = gen(ctx, i)
      if (q && !keys.has(q.key)) {
        keys.add(q.key)
        out.push(q)
      }
    }
  }
  return shuffle(out, ctx.rng)
}
