import { useMemo } from 'react'
import { formatCode } from '../lib/sync/code'
import { makeSigil } from '../lib/sync/sigil'

/** Orb colors in mana order (W, U, B, R, G); dark shades so the camera reads them as "dark". */
const ORB_FILLS = ['var(--orb-w)', 'var(--orb-u)', 'var(--orb-b)', 'var(--orb-r)', 'var(--orb-g)']
/** Empty modules around the code, which scanners need. */
const QUIET = 3

/** A card with the join link drawn as mana orbs. The phone camera opens it like any QR code. */
export function SyncSigil({ link, code }: { link: string; code: string }) {
  const sigil = useMemo(() => makeSigil(link), [link])
  const box = sigil.size + QUIET * 2
  return (
    <figure className="sigil-card" aria-label={`Sync sigil for code ${formatCode(code)}`}>
      <div className="sigil-title">
        <span>Endstep Sync</span>
        <span className="sigil-pips" aria-hidden="true">
          {ORB_FILLS.map((fill) => (
            <i key={fill} style={{ background: fill }} />
          ))}
        </span>
      </div>
      <svg className="sigil-art" viewBox={`${-QUIET} ${-QUIET} ${box} ${box}`} role="img" aria-hidden="true">
        <rect x={-QUIET} y={-QUIET} width={box} height={box} fill="var(--sigil-bg)" />
        {sigil.markers.map((m) => (
          <g key={`${m.x},${m.y}`}>
            <rect x={m.x} y={m.y} width={7} height={7} rx={1.6} fill="var(--orb-b)" />
            <rect x={m.x + 1} y={m.y + 1} width={5} height={5} rx={1.1} fill="var(--sigil-bg)" />
            <rect x={m.x + 2} y={m.y + 2} width={3} height={3} rx={0.9} fill="var(--orb-b)" />
          </g>
        ))}
        {sigil.orbs.map((o) => (
          <circle key={`${o.x},${o.y}`} cx={o.x + 0.5} cy={o.y + 0.5} r={0.47} fill={ORB_FILLS[o.color]} />
        ))}
      </svg>
      <figcaption className="sigil-type">Sigil — Link a device</figcaption>
      <div className="sigil-code">{formatCode(code)}</div>
    </figure>
  )
}
