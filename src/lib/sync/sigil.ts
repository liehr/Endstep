import qrcode from 'qrcode-generator'
import { normalizeCode } from './code'

// The "sync sigil": the join link drawn as mana orbs on a card. Under the hood it is a QR code
// (high error correction, so round orbs and colors still scan), which means the normal camera
// on an iPhone, iPad or Android phone opens it without a scanner in the app.

/** Five orb colors, one per mana color; all dark enough to read as "dark" for a scanner. */
export const ORB_COLORS = 5

export interface Sigil {
  /** Modules per side. */
  size: number
  /** Top-left corners of the three corner markers (7×7 each). */
  markers: { x: number; y: number }[]
  /** All other dark modules, with an orb color 0–4. */
  orbs: { x: number; y: number; color: number }[]
}

/** The link another device opens to join, e.g. https://…/Endstep/#/sync/K7QM4XTDP9 */
export function syncLink(code: string, appUrl: string): string {
  return `${appUrl.replace(/#.*$/, '')}#/sync/${normalizeCode(code)}`
}

export function makeSigil(text: string): Sigil {
  const qr = qrcode(0, 'Q')
  qr.addData(text)
  qr.make()
  const size = qr.getModuleCount()
  const markers = [
    { x: 0, y: 0 },
    { x: size - 7, y: 0 },
    { x: 0, y: size - 7 },
  ]
  const inMarker = (x: number, y: number) => markers.some((m) => x >= m.x && x < m.x + 7 && y >= m.y && y < m.y + 7)
  const orbs: Sigil['orbs'] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.isDark(y, x) && !inMarker(x, y)) orbs.push({ x, y, color: (x * 7 + y * 13 + ((x * y) % 3)) % ORB_COLORS })
    }
  }
  return { size, markers, orbs }
}
