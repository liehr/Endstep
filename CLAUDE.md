# Endstep

Commander tracker as a PWA (React + TypeScript + Vite + vite-plugin-pwa), hosted on GitHub Pages.
UI text and code comments are in English.

## Commands

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` must be green before every push.
- Local build like production: `BASE_PATH=/Endstep/ npm run build && BASE_PATH=/Endstep/ npx vite preview`.

## Conventions

- Data lives only in `localStorage` (`src/lib/data.ts`, key `endstep:data`). Everything coming from there
  or from a backup goes through `sanitizeData`. Add new fields there with a default value so old data
  still loads.
- Logic belongs in `src/lib/` and gets Vitest tests (`*.test.ts`); pages stay thin.
- Learning-plan content (skills, rules, thresholds) lives centrally in `src/lib/content.ts`.
- Hash routing (`#/verlauf`), see `src/lib/route.ts`. Route slugs are internal and stay as they are.
- Card data only via `src/lib/scryfall.ts` (collection endpoint, max. 75 per request, 100 ms spacing,
  `Accept` header). Always send printings (`set`/`number`); a fallback is marked via `requestedSet`.
  Tests use `scryfall.fixture.ts` instead of the real API.
- Simulation (`src/lib/sim/`) and quiz (`src/lib/quiz/`) are deterministic via a seed (`mulberry32`);
  check new questions in tests across many seeds for correct answers.
- Don't change versions by hand: the release workflow (`.github/workflows/release.yml`) bumps
  the version, tags and deploys.

## Design

- Style inspired by Duolingo: use `Button` (3D lip), `Choice` (answer cards), `BottomSheet`,
  `ConfirmSheet` from `src/components/ui.tsx` instead of custom variants.
- Colors only via the tokens in `src/styles.css` (light + dark). Skill colors (`--skill-*`) were
  checked for color vision deficiency with the dataviz palette validator; don't change their order and
  always show a skill color together with its icon and name (`SkillBadge`, `skillStyle`).
- Flows (game, editing) run without the tab bar, with a fixed action at the bottom (`flow-footer`).
- Use `navigate()` from `src/lib/route.ts`, don't set `location.hash` directly.
