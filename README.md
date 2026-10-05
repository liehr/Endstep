# Endstep

**Track your Commander games and get better with every one.**

Endstep is a small phone app built around the learning plan "Commander from the ground up".
It started with the Tramplesaurus Rex (Ghalta) precon and now works with any Commander deck:

- **Pick your deck:** on first launch, search all Commander precons (by name, commander, set or year)
  or paste your own list from Moxfield, Archidekt, MTGGoldfish or any text list. Links to deck sites
  can't be read from the browser, so the app explains how to copy the list as text instead.
  Switch decks any time under **More → Play a different deck**; games stay, and stats, swaps and the
  upgrade chest follow the active deck.

- **Before the game:** the next focus skill in the rotation (Mulligan → Sequencing → Threat
  Assessment → Combat Math → Board Wipe Discipline → Removal Timing → Reading the Table / Politics),
  plus your line for the table.
- **During the game:** the wrath question, the Ghalta calculator for Ghalta decks,
  "Who do I attack?" and a rules cheat sheet.
- **After the game (2 minutes):** the three questions: Why did the winner win? Which one decision
  would you make differently? Which cards were dead or overperformed?
- **Turn counter:** tap "Next turn" and "<Commander> cast!" during the game. Commander turn, game length and
  commander tax end up in your notes automatically.
- **Training:** short Duolingo-style lessons (pick an answer → check → explanation, mistakes come back
  at the end):
  - *Combat & Trample*, *Commander Rules*, plus *Ghalta Math* for Ghalta decks
  - *Mulligan Trainer:* real opening hands from your deck, rated by the rule of thumb from the learning plan
    (enough mana, early plays in the right colors; big-creature decks like Ghalta want an early big creature)
  - *When Does Your Commander Land?:* simulated turns with your deck and your commander's real cost and colors
  - *Know Your Cards:* parts of a card are hidden (name, cost, power, a bit of text). Guess them or
    build the card from tiles; plus the card's role in the game plan (Ramp, Big creature, Card
    advantage, Interaction, Protection, Finisher).
  - *Card Rulings:* official rulings (from Scryfall) for the cards in your deck: which card is it about?
  - **Question memory:** the app remembers every answer. Wrong answers come back in the next lesson,
    right ones only after 1, 3, 7 and 16 days, and new questions come before ones you already know.
- **Goldfish Lab:** 1,000 simulated games show on which turn your commander lands. Run it again
  after a swap round: did the deck get faster?
- **Deck & swap rounds:** decklist with card images, swap rounds ("out" / "in") with a log and undo,
  win rate per deck version.
- **Stats:** win rate, skills, recurring mistakes ("patterns" from 3×), dead cards as upgrade
  candidates, and the upgrade chest (a swap round every 8 games, with a Bracket check after 64 games).

## Tech in one sentence

Endstep is a **Progressive Web App (PWA)**: a web app you install on your phone. It has its own icon
on the home screen, runs full screen without a browser bar and works offline. It is hosted for free
on **GitHub Pages**. No app store needed.

## Getting the app on your phone

Address: **https://liehr.github.io/Endstep/**

**iPhone (Safari):** open the address → **Share** (square with arrow) → **"Add to Home Screen"** →
leave "Open as Web App" on (if shown) → **Add**.

**Android (Chrome):** open the address → tap **"Install app"** (banner in the app or the ⋮ menu) →
confirm.

After that, always start Endstep from the icon. The app loads new versions by itself and shows
**"New version available"**.

### Card data (Scryfall)

Card images and text come from the [Scryfall API](https://scryfall.com/docs/api). The app only
requests the cards in your deck (two requests to `/cards/collection`), stores them on the phone and
works offline afterwards. Scryfall's bulk data (over 100 MB) would be too big for a phone.

To show the **right images**, the app loads the printing from the precon list (MTGJSON has set and
collector number for every card). If a card doesn't exist in that set, it shows another printing and points that out on
the deck page. It is most accurate if you paste your list from Moxfield with set and collector
number (e.g. `1 Llanowar Elves (FDC) 227`).

Precon lists come from [MTGJSON](https://mtgjson.com), which allows requests from the browser. The
searchable index of all precons is bundled in `src/lib/precons.json`; refresh it with
`node scripts/precons.mjs` when new precons come out. Compare the list with your own deck under
**More → Decklist & swaps**.

### Your data

All games stay **only on your phone**. There is no server and no account. Under
**More → Save backup** you can create a backup file now and then (e.g. in iCloud Drive or Google
Drive). That's also how you move your data to a new phone (**Restore backup**).

## One-time setup on GitHub

1. Repository → **Settings → Pages** → under **Source** choose "**GitHub Actions**".
2. Done. From now on everything runs through GitHub Actions.

## Rolling out a new version

1. Changes land on `master` via pull request. The **CI** workflow checks every PR automatically.
2. Repository → **Actions → Release → Run workflow** → pick the type of change:
   - `patch`: small fix (0.1.0 → 0.1.1)
   - `minor`: new feature (0.1.0 → 0.2.0)
   - `major`: big change (0.1.0 → 1.0.0)
3. The workflow checks the app, bumps the version number, creates a GitHub release with a change list
   and rolls the version out. It's live after 1–2 minutes.

A merge to `master` alone does **not** change the app on your phone. Only what was published through
a release goes live.

### Back to an older version (rollback)

**Actions → Deploy → Run workflow** → enter the old tag under "Version" (e.g. `v0.1.0`). All versions
are listed under **Releases**.

## Development

Requirement: Node.js 22 (see `.nvmrc`).

```bash
npm install
npm run dev        # dev server, also reachable from your phone on the same Wi-Fi
npm test           # unit tests (Vitest)
npm run typecheck  # check TypeScript
npm run lint       # oxlint
npm run build      # production build to dist/
```

To change the app icon: replace `public/logo.png` (square, at least 512 px) and run `npm run generate-icons`.

### Structure

```
src/
  lib/          Logic without UI: data types, storage, stats, Ghalta math, learning-plan content,
                decklist, Scryfall access
  lib/sim/      Goldfish simulation (autopilot) and mulligan rule of thumb
  lib/quiz/     Quiz lessons and card quiz (roles, blanks, tiles)
  components/   Reusable building blocks (form, Ghalta calculator, card image, card frame …)
  pages/        The screens: Home, Game, Training, Lesson, History, Stats, Deck, More
.github/workflows/
  ci.yml        Checks PRs and master
  release.yml   Bump version + release + roll out (start manually)
  deploy.yml    Roll out a specific version (also for rollbacks)
```

Stack: React + TypeScript + Vite, `vite-plugin-pwa` for offline use and updates,
Phosphor icons and the Nunito font (both bundled locally, works offline).

### Design

Inspired by learning apps like Duolingo:

- **One thing per screen:** after the game, each question comes on its own, with a progress bar.
  Single-choice questions advance automatically; everything except the result can be skipped.
- **Learning path instead of a list:** the focus rotation is a path of nodes; the next skill pulses.
- **Thumb zone:** the main action is always at the bottom; extra info opens as a bottom sheet.
- **Tactile elements:** buttons and cards have a 3D "lip" and sink in when tapped, with a short
  vibration on Android.
- **Reward:** weekly streak (🔥), celebration screen with confetti after every game.
- **Colors:** every skill has a fixed color plus icon. The palette is checked for color vision
  deficiency (light and dark); colors never stand alone, always with icon and text.

### Possible later

- **Sync between devices** (e.g. with Cloudflare Workers + D1 on the free tier). That would need a login.
- **Real store app:** the same code can be packaged as an Android/iOS app with Capacitor. The iOS App
  Store requires an Apple Developer account ($99/year).
