import type { CSSProperties } from 'react'
import { RANKS } from '../lib/content'

// Rank emblems like Duolingo's league badges: every rank has its own shape (not only its own
// colour, so the ranks stay apart with colour vision deficiency) and a 3D lip underneath.
// Always shown together with the rank name.

const SHAPES: string[] = [
  // Bronze: round medal
  'M32 8a23 23 0 1 1 0 46a23 23 0 1 1 0-46z',
  // Silver: shield
  'M32 6l22 8v16c0 14-10 23-22 28C20 53 10 44 10 30V14z',
  // Gold: wide shield
  'M32 6l24 7v15c0 16-11 25-24 30C19 53 8 44 8 28V13z',
  // Platinum: hexagon
  'M32 5l23 13v26L32 57L9 44V18z',
  // Diamond: cut gem
  'M17 9h30l12 15l-27 33L5 24z',
  // Master: octagon crest
  'M22 5h20l15 15v21L42 56H22L7 41V20z',
  // Grandmaster: crown
  'M6 16l14 13l12-21l12 21l14-13l-5 38H11z',
]

const CHEVRON = (y: number) => `M20 ${y}l12 7l12-7v6l-12 7l-12-7z`
const STAR = 'M32 18l4.1 8.6l9.4 1.2l-6.9 6.5l1.8 9.3L32 39.1l-8.4 4.5l1.8-9.3l-6.9-6.5l9.4-1.2z'

const GLYPHS: string[][] = [
  [CHEVRON(25)],
  [CHEVRON(21), CHEVRON(31)],
  [CHEVRON(17), CHEVRON(27), CHEVRON(37)],
  [STAR],
  [STAR],
  [STAR],
  [STAR],
]

/** CSS variables for a rank's colour: --c (face), --c-ink (glyph), --lip (3D edge). */
export function rankStyle(rank: number): CSSProperties {
  const id = RANKS[rank].id
  return { '--c': `var(--rank-${id})`, '--c-ink': `var(--rank-${id}-ink)`, '--lip': `var(--rank-${id}-lip)` } as CSSProperties
}

export function RankEmblem({ rank, size = 56, locked = false }: { rank: number; size?: number; locked?: boolean }) {
  const shape = SHAPES[rank]
  return (
    <svg
      className={`rank-emblem ${locked ? 'locked' : ''}`}
      style={rankStyle(rank)}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <path d={shape} className="rank-lip" transform="translate(0 4)" />
      <path d={shape} className="rank-face" />
      <path d={shape} className="rank-shine" transform="translate(32 30) scale(0.72) translate(-32 -30)" />
      {GLYPHS[rank].map((d) => (
        <path key={d} d={d} className="rank-glyph" />
      ))}
    </svg>
  )
}
