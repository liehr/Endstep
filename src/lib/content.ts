import type { FocusRating, SkillId, WhyCategory, WipeOutcome } from './types'

export interface Skill {
  id: SkillId
  name: string
  /** Short rule of thumb for the table. */
  tip: string
  /** Concrete task you can set yourself for the game. */
  task: string
}

/** Focus rotation from the learning plan: one per game, then start over. */
export const SKILLS: Skill[] = [
  {
    id: 'mulligan',
    name: 'Mulligan',
    tip: 'The first mulligan is free. Keep 3–4 lands or mana creatures plus at least one early big creature.',
    task: 'Check your opening hand on purpose and calmly send back a “meh” hand.',
  },
  {
    id: 'sequencing',
    name: 'Sequencing',
    tip: 'A land every turn. Mana creatures early. Creatures and removal as late as makes sense, so you can react to new info.',
    task: 'Before each main phase, say your plan out loud: which land, which spell, and why now.',
  },
  {
    id: 'threat',
    name: 'Threat Assessment',
    tip: 'Life totals aren’t the scoreboard. The dangerous player is the one piling up resources or close to winning. Second place is often more dangerous than first.',
    task: 'Before every attack, say one sentence: “Who is winning right now, and why?”',
  },
  {
    id: 'combat',
    name: 'Combat Math',
    tip: 'Trample: every blocker needs lethal damage, the rest goes through. 21 combat damage from the same commander wins.',
    task: 'Before every attack, run the full combat math in your head once.',
  },
  {
    id: 'wipe',
    name: 'Board Wipe Discipline',
    tip: 'What happens if a wrath comes down now? Attack, and keep 1–2 big creatures in hand.',
    task: 'Deliberately hold back 1–2 big creatures and note whether it paid off.',
  },
  {
    id: 'removal',
    name: 'Removal Timing',
    tip: 'Removal is for “lethal”, not for “annoying”. Fight and bite spells only work when you have a big creature.',
    task: 'Before every removal spell, ask: Will this card otherwise end the game?',
  },
  {
    id: 'politics',
    name: 'Reading the Table / Politics',
    tip: 'Don’t attack early for no reason. Every attack needs a reason you can say out loud.',
    task: 'Say the reason out loud with every attack: “I’m hitting you because …”',
  },
]

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, Skill>

export const WHY_CATEGORIES: { id: WhyCategory; label: string }[] = [
  { id: 'mistake', label: 'My own technical mistake' },
  { id: 'foresee', label: 'I could have read or seen it coming' },
  { id: 'deckbuilding', label: 'Deckbuilding' },
  { id: 'wrongdeck', label: 'Wrong deck for this table' },
  { id: 'luck', label: 'Bad luck' },
]

export const WHY_LABEL = Object.fromEntries(WHY_CATEGORIES.map((c) => [c.id, c.label])) as Record<
  WhyCategory,
  string
>

export const WIPE_OPTIONS: { id: WipeOutcome; label: string }[] = [
  { id: 'none', label: 'No wipe' },
  { id: 'kept', label: 'Wipe, but reloads in hand' },
  { id: 'overextended', label: 'Wipe, lost everything' },
]

export const WIPE_LABEL = Object.fromEntries(WIPE_OPTIONS.map((o) => [o.id, o.label])) as Record<
  WipeOutcome,
  string
>

export const FOCUS_RATINGS: { id: FocusRating; label: string }[] = [
  { id: 1, label: 'Barely thought of it' },
  { id: 2, label: 'Partly' },
  { id: 3, label: 'Nailed it' },
]

/** Upgrade chest: a swap round every 8 games (the first after 8 games with the unchanged deck). */
export const UPGRADE_EVERY_GAMES = 8

/**
 * Maximum number of cards per swap round, in steps: swap one at a time at first so you can see the effect,
 * a bit more later on. The last step applies to all further rounds.
 */
export const UPGRADE_CARDS = [1, 1, 2, 2, 3]

/** After this many games with the deck, the app asks whether the table wants to play a higher bracket. */
export const BRACKET_CHECK_GAMES = 64

/** Only when the same problem shows up for the third time is it a pattern. */
export const PATTERN_THRESHOLD = 3

export const DEFAULT_DECK = 'Tramplesaurus Rex (Ghalta)'

export const DEFAULT_TABLE_INTRO =
  'Ghalta precon, unchanged, Bracket 2, no Game Changers, no combos.'

/** The sentence for the table when you pick a deck. */
export function tableIntroFor(deckName: string, commander: string, precon: boolean, bracket: number): string {
  return precon
    ? `${deckName} precon, unchanged, Bracket ${bracket}.`
    : `${commander} deck, Bracket ${bracket}.`
}

export const ATTACK_PRIORITIES = [
  'Whoever is close to winning or building an engine you can’t remove.',
  'Whoever can wipe your board (lots of open lands in white, black or red).',
  'Whoever has few or small blockers: trample overflow counts in full as commander damage.',
  'Not the weakest player just because you can. That makes you the archenemy.',
]

export const RULES = [
  {
    title: 'Commander tax',
    text: '+2 generic mana for each previous cast from the command zone. Ghalta’s reduction lowers it too.',
  },
  {
    title: 'Commander damage',
    text: '21 combat damage from the same commander. Trample damage that gets through counts, fight damage doesn’t. Ghalta (12/12) against a 5/5 blocker: only 7 count.',
  },
  {
    title: 'Trample',
    text: 'Assign lethal damage to each blocker, the excess goes to the player. You can split it freely across multiple blockers. With Deathtouch, 1 damage per blocker is enough.',
  },
  {
    title: 'Blocked stays blocked',
    text: 'If the blocker disappears, a creature without Trample deals no damage. With Trample, the full damage goes to the player.',
  },
  {
    title: 'Attacks in multiplayer',
    text: 'For each creature, announce which player or planeswalker it attacks before anyone blocks.',
  },
  {
    title: 'Stack & priority',
    text: 'After every spell, everyone may respond. Last in, first out. Pass priority with a bit of time.',
  },
  {
    title: 'Combat steps',
    text: 'Beginning → attackers → blockers → combat damage → end. Pump effects like Overwhelming Stampede go in the main phase before combat.',
  },
]
