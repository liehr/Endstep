import type { FocusRating, SkillId, WhyCategory, WipeOutcome } from './types'

export interface Skill {
  id: SkillId
  name: string
  /** Kurzer Merksatz für den Spieltisch. */
  tip: string
  /** Konkrete Aufgabe, die man sich für die Runde vornehmen kann. */
  task: string
}

/** Fokus-Rotation aus dem Lernplan: eine pro Spiel, danach von vorne. */
export const SKILLS: Skill[] = [
  {
    id: 'mulligan',
    name: 'Mulligan',
    tip: 'Der erste Mulligan ist gratis. Behalte 3–4 Länder oder Manakreaturen plus mindestens eine frühe dicke Kreatur.',
    task: 'Starthand bewusst prüfen und eine „naja“-Hand ruhig zurückschicken.',
  },
  {
    id: 'sequencing',
    name: 'Sequencing',
    tip: 'Jeden Zug ein Land. Manakreaturen früh. Kreaturen und Removal so spät wie sinnvoll, um auf neue Infos zu reagieren.',
    task: 'Laut mitzählen: „Ich habe X Stärke, Ghalta kostet Y.“',
  },
  {
    id: 'threat',
    name: 'Threat Assessment',
    tip: 'Lebenspunkte sind nicht der Punktestand. Gefährlich ist, wer Ressourcen anhäuft oder kurz vor dem Sieg steht. Der Zweite ist oft gefährlicher als der Erste.',
    task: 'Vor jedem Angriff einen Satz bilden: „Wer gewinnt gerade, und warum?“',
  },
  {
    id: 'combat',
    name: 'Kampfmathe',
    tip: 'Trample: Jeder Blocker braucht tödlichen Schaden, der Rest geht durch. 21 Kampfschaden vom selben Commander gewinnen.',
    task: 'Vor jedem Angriff die Kampfmathe einmal komplett im Kopf durchrechnen.',
  },
  {
    id: 'wipe',
    name: 'Board-Wipe-Disziplin',
    tip: 'Was passiert, wenn jetzt ein Wrath kommt? Angreifen und dabei 1–2 Dicke auf der Hand behalten.',
    task: 'Bewusst 1–2 dicke Kreaturen zurückhalten und notieren, ob es sich gelohnt hat.',
  },
  {
    id: 'removal',
    name: 'Removal-Timing',
    tip: 'Removal auf „tödlich“, nicht auf „nervig“. Ram Through und Bite Down funktionieren nur mit einer dicken Kreatur.',
    task: 'Vor jedem Removal fragen: Beendet diese Karte sonst das Spiel?',
  },
  {
    id: 'politics',
    name: 'Tisch lesen / Politik',
    tip: 'Nicht früh und grundlos angreifen. Jeder Angriff braucht einen Grund, den du laut sagen kannst.',
    task: 'Bei jedem Angriff den Grund laut aussprechen: „Ich hau dich, weil …“',
  },
]

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, Skill>

export const WHY_CATEGORIES: { id: WhyCategory; label: string }[] = [
  { id: 'mistake', label: 'Eigener technischer Fehler' },
  { id: 'foresee', label: 'Hätte ich lesen oder vorhersehen können' },
  { id: 'deckbuilding', label: 'Deckbau' },
  { id: 'wrongdeck', label: 'Falsches Deck für diesen Tisch' },
  { id: 'luck', label: 'Pech' },
]

export const WHY_LABEL = Object.fromEntries(WHY_CATEGORIES.map((c) => [c.id, c.label])) as Record<
  WhyCategory,
  string
>

export const WIPE_OPTIONS: { id: WipeOutcome; label: string }[] = [
  { id: 'none', label: 'Kein Wipe' },
  { id: 'kept', label: 'Wipe, aber Nachschub auf der Hand' },
  { id: 'overextended', label: 'Wipe, alles verloren' },
]

export const WIPE_LABEL = Object.fromEntries(WIPE_OPTIONS.map((o) => [o.id, o.label])) as Record<
  WipeOutcome,
  string
>

export const FOCUS_RATINGS: { id: FocusRating; label: string }[] = [
  { id: 1, label: 'Kaum dran gedacht' },
  { id: 2, label: 'Teilweise' },
  { id: 3, label: 'Gut umgesetzt' },
]

/** Faustregel aus dem Lernplan: Upgrades erst nach etwa 8–10 Spielen mit dem unveränderten Deck. */
export const UPGRADE_AFTER_GAMES = 8

/** Nach jeder Swap-Runde wieder 4–5 Spiele testen, dann die nächste kleine Runde. */
export const UPGRADE_AFTER_SWAP_GAMES = 5

/** Erst wenn dasselbe Problem zum dritten Mal auftaucht, ist es ein Muster. */
export const PATTERN_THRESHOLD = 3

export const DEFAULT_DECK = 'Tramplesaurus Rex (Ghalta)'

export const DEFAULT_TABLE_INTRO =
  'Ghalta-Precon, unverändert, Bracket 2, keine Game Changers, keine Kombos.'

export const ATTACK_PRIORITIES = [
  'Wer kurz vor dem Sieg steht oder eine Engine aufbaut, die du nicht entfernen kannst.',
  'Wer dein Board wipen kann (viele offene Länder in Weiß, Schwarz oder Rot).',
  'Wer wenige oder kleine Blocker hat: Trample-Überschuss zählt voll als Commander-Schaden.',
  'Nicht den Schwächsten, nur weil es geht. Das macht dich zum Archenemy.',
]

export const RULES = [
  {
    title: 'Commander-Steuer',
    text: '+2 generisches Mana für jeden früheren Cast aus der Command Zone. Ghaltas Reduktion senkt sie mit.',
  },
  {
    title: 'Commander-Schaden',
    text: '21 Kampfschaden vom selben Commander. Durchgekommener Trample-Schaden zählt, Fight-Schaden nicht. Ghalta (12/12) gegen einen 5/5-Blocker: nur 7 zählen.',
  },
  {
    title: 'Trample',
    text: 'Jedem Blocker tödlichen Schaden zuweisen, Überschuss geht zum Spieler. Verteilung auf mehrere Blocker ist frei. Mit Deathtouch reicht 1 Schaden pro Blocker.',
  },
  {
    title: 'Geblockt bleibt geblockt',
    text: 'Verschwindet der Blocker, macht eine Kreatur ohne Trample keinen Schaden. Mit Trample geht der volle Schaden zum Spieler.',
  },
  {
    title: 'Angriffe im Multiplayer',
    text: 'Für jede Kreatur ansagen, welchen Spieler oder Planeswalker sie angreift, bevor jemand blockt.',
  },
  {
    title: 'Stack & Priorität',
    text: 'Nach jedem Spruch darf jeder antworten. Last in, first out. Priorität mit etwas Zeit weitergeben.',
  },
  {
    title: 'Kampfschritte',
    text: 'Beginn → Angreifer → Blocker → Kampfschaden → Ende. Pump-Effekte wie Overwhelming Stampede in den Hauptzug vor dem Kampf.',
  },
]
