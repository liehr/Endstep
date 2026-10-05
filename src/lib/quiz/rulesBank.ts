// Fixed rules and strategy questions from the learning plan. The first option is always correct;
// the order is shuffled when asked.

export interface StaticQuestion {
  id: string
  prompt: string
  options: [string, ...string[]]
  explanation: string
}

export const RULES_BANK: StaticQuestion[] = [
  {
    id: 'free-mulligan',
    prompt: 'What does your first mulligan cost you in multiplayer Commander?',
    options: ['Nothing: a fresh 7 cards, none to the bottom of your library', 'One card to the bottom of your library', '2 life', 'Discard a card'],
    explanation: 'Commander uses the London mulligan, and in multiplayer the first mulligan is free. So feel free to send back a “meh” hand.',
  },
  {
    id: 'commander-damage-kind',
    prompt: 'Which damage counts as commander damage?',
    options: [
      'Only combat damage from the same commander',
      'Any damage your commander deals',
      'Combat damage from all your creatures',
      'Fight damage too (e.g. Bite Down)',
    ],
    explanation: '21 combat damage from the same commander. Trample damage that gets through counts, fight damage and damage to blockers don’t.',
  },
  {
    id: 'commander-damage-21',
    prompt: 'How much commander damage from the same commander makes a player lose?',
    options: ['21', '20', '40', '12'],
    explanation: 'At 21 combat damage from the same commander, the player loses, no matter how much life they have left.',
  },
  {
    id: 'pump-timing',
    prompt: 'When is the best time to cast a sorcery that pumps your team, like Overwhelming Stampede?',
    options: ['In the main phase before combat', 'After blockers are declared', 'In the combat damage step', 'In the end step'],
    explanation: 'A sorcery only works in your main phase. Pump effects belong before combat so they count when you attack.',
  },
  {
    id: 'tax',
    prompt: 'How does commander tax work?',
    options: [
      '+2 generic mana for each previous cast from the command zone',
      '+1 mana per time your commander died',
      '+2 mana per turn your commander sits in the command zone',
      'It doubles the cost',
    ],
    explanation: 'Each previous cast from the command zone makes it {2} more expensive. Cost reductions on your commander lower the tax too.',
  },
  {
    id: 'stack',
    prompt: 'You cast a spell and an opponent responds to it. What resolves first?',
    options: ['The opponent’s response', 'Your spell', 'Both at the same time', 'Whichever cost more mana'],
    explanation: 'The stack works “last in, first out”: whatever was played last resolves first.',
  },
  {
    id: 'combat-steps',
    prompt: 'In what order do the combat steps happen?',
    options: [
      'Attackers → blockers → combat damage',
      'Blockers → attackers → combat damage',
      'Attackers → combat damage → blockers',
      'Combat damage → attackers → blockers',
    ],
    explanation: 'Beginning of combat → declare attackers → declare blockers → combat damage → end of combat.',
  },
  {
    id: 'declare-attack',
    prompt: 'In multiplayer, what do you have to announce for each creature when attacking?',
    options: [
      'Which player or planeswalker it attacks',
      'How much damage it will deal',
      'Which opponent may block',
      'Nothing, the opponents decide',
    ],
    explanation: 'When declaring attackers, you announce for each creature who it attacks, and you do it before anyone blocks.',
  },
  {
    id: 'bracket-2',
    prompt: 'What does Bracket 2 (“Core”) mean?',
    options: [
      'Unoptimized, straightforward decks; wins are telegraphed on the board',
      'Decks with up to three Game Changers',
      'Competitive Commander (cEDH)',
      'Only mono-colored decks',
    ],
    explanation: 'According to Wizards, Bracket 2 means “unoptimized and straightforward”. Expect at least eight turns before anyone wins.',
  },
  {
    id: 'threat',
    prompt: 'Who should you attack first?',
    options: [
      'Whoever is close to winning or building an engine',
      'Whoever has the lowest life total',
      'Whoever attacked you last',
      'Always the player to your left',
    ],
    explanation: 'Life totals aren’t the scoreboard. The dangerous player is the one piling up resources or close to winning.',
  },
  {
    id: 'wipe',
    prompt: 'Your board is big and an opponent has 4 open white lands. What’s usually right?',
    options: [
      'Attack and keep 1–2 big creatures in hand',
      'Play out everything while you can',
      'Don’t attack at all and wait',
      'Hold back all your creatures',
    ],
    explanation: 'Avoid two mistakes: dumping everything and getting swept by the wipe, or not attacking with a big board. The fix: attack and keep reloads in hand.',
  },
  {
    id: 'removal',
    prompt: 'What do you use your limited removal on?',
    options: ['Threats that end the game', 'The first annoying card', 'Always the strongest player', 'As early as possible, before it’s too late'],
    explanation: 'Just because a card is annoying doesn’t mean it deserves removal. Interaction is limited, so use it carefully.',
  },
  {
    id: 'trample-assign',
    prompt: 'Your creature with Trample is blocked by two creatures. How do you assign the damage?',
    options: [
      'Freely, but each blocker needs lethal damage before excess goes to the player',
      'Only to the first blocker, the rest goes to the player',
      'Evenly across all blockers',
      'The defending player decides',
    ],
    explanation: 'Since the Foundations update there’s no damage assignment order anymore: you assign freely, but each blocker must get lethal damage.',
  },
  {
    id: 'upgrade',
    prompt: 'When does the first swap round for your precon make sense?',
    options: ['After about 8 games, starting with 1 card', 'Right away, before the first game', 'After every lost game', 'Only after 50 games'],
    explanation: 'Collect notes first, then swap with purpose: cards that were dead at least 3 times are candidates. Swap one at a time at first so you can see the effect.',
  },
]
