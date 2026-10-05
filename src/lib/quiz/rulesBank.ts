// Feste Regel- und Strategiefragen aus dem Lernplan. Die erste Option ist jeweils richtig;
// die Reihenfolge wird beim Abfragen gemischt.

export interface StaticQuestion {
  id: string
  prompt: string
  options: [string, ...string[]]
  explanation: string
}

export const RULES_BANK: StaticQuestion[] = [
  {
    id: 'free-mulligan',
    prompt: 'Was kostet dich der erste Mulligan im Multiplayer-Commander?',
    options: ['Nichts: neue 7 Karten, keine unter die Bibliothek', 'Eine Karte unter die Bibliothek', '2 Lebenspunkte', 'Eine Karte abwerfen'],
    explanation: 'Commander nutzt den London-Mulligan, und im Multiplayer ist der erste Mulligan gratis. Eine „naja“-Hand also ruhig zurückschicken.',
  },
  {
    id: 'commander-damage-kind',
    prompt: 'Welcher Schaden zählt als Commander-Schaden?',
    options: [
      'Nur Kampfschaden vom selben Commander',
      'Jeder Schaden, den dein Commander verursacht',
      'Kampfschaden von allen deinen Kreaturen',
      'Auch Fight-Schaden (z. B. Bite Down)',
    ],
    explanation: '21 Kampfschaden vom selben Commander. Durchgekommener Trample-Schaden zählt mit, Fight-Schaden und Schaden an Blockern nicht.',
  },
  {
    id: 'commander-damage-21',
    prompt: 'Ab wie viel Commander-Schaden vom selben Commander verliert ein Spieler?',
    options: ['21', '20', '40', '12'],
    explanation: 'Bei 21 Kampfschaden vom selben Commander verliert der Spieler, egal wie viele Lebenspunkte er noch hat.',
  },
  {
    id: 'pump-timing',
    prompt: 'Wann spielst du Overwhelming Stampede am besten?',
    options: ['Im Hauptzug vor dem Kampf', 'Nach dem Deklarieren der Blocker', 'Im Kampfschadensschritt', 'Im Endschritt'],
    explanation: 'Overwhelming Stampede ist eine Hexerei: Sie geht nur im Hauptzug. Pump-Effekte gehören vor den Kampf, damit sie beim Angriff wirken.',
  },
  {
    id: 'tax',
    prompt: 'Wie funktioniert die Commander-Steuer?',
    options: [
      '+2 generisches Mana für jeden früheren Cast aus der Command Zone',
      '+1 Mana pro gestorbenem Commander',
      '+2 Mana pro Runde, die der Commander in der Command Zone liegt',
      'Sie verdoppelt die Kosten',
    ],
    explanation: 'Jeder frühere Cast aus der Command Zone macht ihn um {2} teurer. Ghaltas Reduktion senkt auch die Steuer mit.',
  },
  {
    id: 'stack',
    prompt: 'Du castest einen Spruch, ein Gegner antwortet darauf. Was wird zuerst verrechnet?',
    options: ['Die Antwort des Gegners', 'Dein Spruch', 'Beides gleichzeitig', 'Was mehr Mana gekostet hat'],
    explanation: 'Der Stack arbeitet nach „last in, first out“: Was zuletzt gespielt wurde, wird zuerst verrechnet.',
  },
  {
    id: 'combat-steps',
    prompt: 'In welcher Reihenfolge laufen die Kampfschritte?',
    options: [
      'Angreifer → Blocker → Kampfschaden',
      'Blocker → Angreifer → Kampfschaden',
      'Angreifer → Kampfschaden → Blocker',
      'Kampfschaden → Angreifer → Blocker',
    ],
    explanation: 'Beginn des Kampfes → Angreifer deklarieren → Blocker deklarieren → Kampfschaden → Ende des Kampfes.',
  },
  {
    id: 'declare-attack',
    prompt: 'Was musst du im Multiplayer beim Angreifen für jede Kreatur ansagen?',
    options: [
      'Welchen Spieler oder Planeswalker sie angreift',
      'Wie viel Schaden sie machen wird',
      'Welcher Gegner blocken darf',
      'Nichts, die Gegner entscheiden',
    ],
    explanation: 'Beim Deklarieren sagst du für jede Kreatur an, wen sie angreift, und zwar bevor jemand blockt.',
  },
  {
    id: 'bracket-2',
    prompt: 'Was bedeutet Bracket 2 („Core“)?',
    options: [
      'Unoptimierte, geradlinige Decks; Siege kündigen sich auf dem Board an',
      'Decks mit bis zu drei Game Changers',
      'Kompetitives Commander (cEDH)',
      'Nur Decks mit einer Farbe',
    ],
    explanation: 'Bracket 2 heißt laut Wizards „unoptimized and straightforward“. Man erwartet mindestens acht Züge, bevor jemand gewinnt.',
  },
  {
    id: 'threat',
    prompt: 'Wen solltest du zuerst angreifen?',
    options: [
      'Wer kurz vor dem Sieg steht oder eine Engine aufbaut',
      'Wer die wenigsten Lebenspunkte hat',
      'Wer dich zuletzt angegriffen hat',
      'Immer den Spieler links von dir',
    ],
    explanation: 'Lebenspunkte sind nicht der Punktestand. Gefährlich ist, wer Ressourcen anhäuft oder kurz vor dem Sieg steht.',
  },
  {
    id: 'wipe',
    prompt: 'Dein Board ist dick, ein Gegner hat 4 offene Länder in Weiß. Was ist meist richtig?',
    options: [
      'Angreifen und 1–2 dicke Kreaturen auf der Hand behalten',
      'Alles ausspielen, solange es geht',
      'Gar nicht angreifen und abwarten',
      'Alle Kreaturen zurückhalten',
    ],
    explanation: 'Zwei Fehler vermeiden: alles hinlegen und vom Wipe weggefegt werden, oder mit dickem Board nicht angreifen. Lösung: angreifen und Nachschub behalten.',
  },
  {
    id: 'removal',
    prompt: 'Wofür setzt du dein weniges Removal ein?',
    options: ['Für Bedrohungen, die das Spiel beenden', 'Für die erste nervige Karte', 'Immer gegen den stärksten Spieler', 'Möglichst früh, bevor es zu spät ist'],
    explanation: 'Nur weil eine Karte nervt, verdient sie noch kein Removal. Dein Deck hat wenig Interaktion, also gezielt einsetzen.',
  },
  {
    id: 'trample-assign',
    prompt: 'Ghalta mit Trample wird von zwei Kreaturen geblockt. Wie verteilst du den Schaden?',
    options: [
      'Frei, aber jeder Blocker braucht tödlichen Schaden, bevor Überschuss zum Spieler geht',
      'Nur auf den ersten Blocker, der Rest geht zum Spieler',
      'Gleichmäßig auf alle Blocker',
      'Der verteidigende Spieler entscheidet',
    ],
    explanation: 'Seit dem Foundations-Update gibt es keine Schadensreihenfolge mehr: Du verteilst frei, jeder Blocker muss aber tödlichen Schaden bekommen.',
  },
  {
    id: 'upgrade',
    prompt: 'Wann ist die erste Upgrade-Runde für dein Precon sinnvoll?',
    options: ['Nach etwa 8 Spielen, erst mit 1 Karte', 'Sofort vor dem ersten Spiel', 'Nach jedem verlorenen Spiel', 'Erst nach 50 Spielen'],
    explanation: 'Erst Notizen sammeln, dann gezielt tauschen: Karten, die mindestens 3× tot waren, sind Kandidaten. Anfangs einzeln tauschen, damit du die Wirkung siehst.',
  },
]
