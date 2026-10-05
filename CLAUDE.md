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
- Versionen nicht von Hand ändern: Der Release-Workflow (`.github/workflows/release.yml`) erhöht
  die Version, taggt und deployt.
