# Endstep

Commander-Tracker als PWA (React + TypeScript + Vite + vite-plugin-pwa), gehostet auf GitHub Pages.
UI-Texte und Kommentare sind auf Deutsch.

## Befehle

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` müssen vor jedem Push grün sein.
- Lokaler Build wie in Produktion: `BASE_PATH=/Endstep/ npm run build && BASE_PATH=/Endstep/ npx vite preview`.

## Konventionen

- Daten liegen nur in `localStorage` (`src/lib/data.ts`, Schlüssel `endstep:data`). Alles, was von dort
  oder aus einem Backup kommt, läuft durch `sanitizeData`. Neue Felder dort mit Standardwert ergänzen,
  damit alte Daten weiter laden.
- Logik gehört nach `src/lib/` und bekommt Vitest-Tests (`*.test.ts`); Seiten bleiben dünn.
- Inhalte aus dem Lernplan (Skills, Regeln, Schwellen) stehen zentral in `src/lib/content.ts`.
- Routing per Hash (`#/verlauf`), siehe `src/lib/route.ts`.
- Kartendaten nur über `src/lib/scryfall.ts` (Collection-Endpoint, max. 75 pro Anfrage, 100 ms Abstand,
  `Accept`-Header). Druckversionen (`set`/`number`) immer mitschicken; Fallback wird über `requestedSet`
  markiert. Tests nutzen `scryfall.fixture.ts` statt echter API.
- Simulation (`src/lib/sim/`) und Quiz (`src/lib/quiz/`) sind deterministisch über einen Seed (`mulberry32`);
  neue Fragen in Tests über viele Seeds auf korrekte Antworten prüfen.
- Versionen nicht von Hand ändern: Der Release-Workflow (`.github/workflows/release.yml`) erhöht
  die Version, taggt und deployt.

## Design

- Stil angelehnt an Duolingo: `Button` (3D-Lippe), `Choice` (Antwortkarten), `BottomSheet`,
  `ConfirmSheet` aus `src/components/ui.tsx` verwenden statt eigener Varianten.
- Farben nur über die Tokens in `src/styles.css` (hell + dunkel). Skill-Farben (`--skill-*`) wurden
  mit dem Dataviz-Palette-Validator auf Farbfehlsichtigkeit geprüft; Reihenfolge nicht ändern und
  Skill-Farbe immer zusammen mit Icon und Namen zeigen (`SkillBadge`, `skillStyle`).
- Abläufe (Runde, Bearbeiten) laufen ohne Tab-Leiste mit fester Aktion unten (`flow-footer`).
- `navigate()` aus `src/lib/route.ts` benutzen, nicht `location.hash` direkt setzen.
