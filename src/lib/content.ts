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
    tip: 'The first mulligan is free. Keep 3–4 lands or mana sources plus something to cast early, in the colors your spells need.',
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

// Choices on the settings page (More → Settings). The constants above are the defaults.
export const UPGRADE_EVERY_OPTIONS = [4, 6, 8, 10, 12] as const
/** 0 turns the bracket check off. */
export const BRACKET_CHECK_OPTIONS = [0, 32, 64, 96] as const
export const PATTERN_OPTIONS = [2, 3, 4, 5] as const
export const LESSON_LENGTHS = [5, 8, 10] as const
export const MISTAKE_DAY_OPTIONS = [7, 14, 30] as const
export const EXAM_HEART_OPTIONS = [3, 5] as const

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
    text: '+2 generic mana for each previous cast from the command zone. Cost reductions on your commander lower it too.',
  },
  {
    title: 'Commander damage',
    text: '21 combat damage from the same commander. Trample damage that gets through counts, fight damage doesn’t. A 12/12 trampler against a 5/5 blocker: only 7 count.',
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
    text: 'Beginning → attackers → blockers → combat damage → end. Sorcery-speed pump effects go in the main phase before combat.',
  },
]

// --- Ranks ----------------------------------------------------------------------
// Like Duolingo's sections: each rank unlocks a few focus skills for your games and harder
// question kinds for the lessons. Order follows the usual way Magic is learned: technique
// first, then timing, then reading the table, then planning and deckbuilding.

export type RankId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster'

export interface Rank {
  id: RankId
  name: string
  /** The question this rank answers. */
  motto: string
  /** What you learn here, one line. */
  learn: string
  /** Focus skills this rank adds to the rotation. */
  skills: SkillId[]
}

export const RANKS: Rank[] = [
  { id: 'bronze', name: 'Bronze', motto: 'How do I play my turn?', learn: 'Your cards, keywords, simple blocks, commander basics.', skills: ['mulligan', 'sequencing'] },
  { id: 'silver', name: 'Silver', motto: 'How do I win a fight?', learn: 'Trample, first strike, deathtouch, double blocks, commander tax and damage.', skills: ['combat'] },
  { id: 'gold', name: 'Gold', motto: 'When do I play what?', learn: 'Combat tricks, removal and wipe timing, rulings, the role of each card.', skills: ['removal', 'wipe'] },
  { id: 'platinum', name: 'Platinum', motto: 'Who is the threat at the table?', learn: 'Who to attack, staying off the archenemy spot, brackets.', skills: ['threat', 'politics'] },
  { id: 'diamond', name: 'Diamond', motto: 'Can I win this turn?', learn: 'Lethal across the table and alpha strikes.', skills: [] },
  { id: 'master', name: 'Master', motto: 'How do I make my deck better?', learn: 'Everything at full difficulty, with your swap rounds.', skills: [] },
  { id: 'grandmaster', name: 'Grandmaster', motto: 'Everything, mixed.', learn: 'All lessons at full difficulty. The top of the ladder.', skills: [] },
]

/** Games to play in a rank before its exam unlocks (same rhythm as the upgrade chest). */
export const RANK_GAMES = UPGRADE_EVERY_GAMES

/**
 * Lessons needed in a rank before its exam: at least RANK_LESSON_SCORE correct answers and
 * RANK_LESSON_SHARE of the lesson (4 of 5, 7 of 8, 8 of 10).
 */
export const RANK_LESSONS = 5
export const RANK_LESSON_SCORE = 4
export const RANK_LESSON_SHARE = 0.8

/** The rank exam: this many questions, and you may get this many wrong (hearts). */
export const EXAM_QUESTIONS = 12
export const EXAM_HEARTS = 3

/**
 * Rank (index into RANKS) of each question topic, the part of the question key before ":".
 * Keys ending in "*" match every topic that starts with that text. Topics missing here count
 * as Bronze; a test makes sure every generated topic is listed.
 */
export const QUESTION_LEVELS: Record<string, number> = {
  // Bronze: your cards, simple blocks, commander basics
  'card-name': 0, 'card-cost': 0, 'card-type': 0, 'card-which-type': 0, 'card-pt': 0, 'card-keyword': 0, 'card-art': 0, 'card-mv': 0,
  'block-outcome': 0, 'can-block': 0, 'summoning-sick': 0, vigilance: 0,
  'ghalta-cost': 0, mulligan: 0,
  'rule-free-mulligan': 0, 'rule-commander-damage-21': 0, 'rule-tax': 0, 'rule-combat-steps': 0,
  'order-turn': 0, 'tap-type': 0,
  // Silver: combat keywords, commander tax and damage, when your commander lands
  trample: 1, deathtouch: 1, 'trample-assign': 1, 'first-strike-block': 1, 'deathtouch-block': 1, 'double-strike': 1,
  'double-strike-block': 1, lifelink: 1, 'indestructible-block': 1, 'double-block': 1, 'gang-block': 1,
  'cmd-damage': 1, 'cmd-hits': 1, 'cmd-tally': 1,
  'ghalta-threshold': 1, 'ghalta-tax-story': 1, 'ghalta-gg-casts': 1, 'ghalta-turn-mana': 1, 'ghalta-counts': 1, 'ghalta-fits': 1,
  'ghalta-mana-left': 1, 'tap-ghalta': 1, when: 1, 'cast-now': 1,
  'card-text': 1, 'card-compare': 1, 'card-gap': 1, 'card-build': 1,
  'rule-commander-damage-kind': 1, 'rule-stack': 1, 'rule-declare-attack': 1, 'rule-trample-assign': 1,
  'order-stack': 1, 'order-combat': 1, 'order-play': 1, 'tap-blockers': 1,
  // Gold: timing, tricks, rulings, the role of a card
  'combat-trick': 2, 'marked-damage': 2, 'trample-marked': 2, 'trample-pump': 2, 'blocker-gone': 2, fight: 2, 'best-block': 2,
  'card-role': 2, 'ruling-*': 2,
  'rule-pump-timing': 2, 'rule-removal': 2, 'rule-wipe': 2,
  'ghalta-boost': 2, 'ghalta-response': 2, 'ghalta-first': 2, 'ghalta-order': 2, 'ghalta-cheapest': 2, 'ghalta-savings': 2, 'ghalta-missing': 2, 'ghalta-reverse': 2,
  // Platinum: reading the table
  'cmd-vs-life': 3, 'rule-threat': 3, 'rule-bracket-2': 3, 'rule-upgrade': 3, 'ghalta-opponents': 3,
  // Diamond: lethal
  'alpha-strike': 4, 'lethal-check': 4, 'tap-lethal': 4,
}
