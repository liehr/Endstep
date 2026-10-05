import { defaultSettings, emptyInput } from './data'
import type { Game } from './types'

let counter = 0

export function makeGame(overrides: Partial<Game> = {}): Game {
  counter++
  return {
    ...emptyInput(defaultSettings(), 'mulligan'),
    id: `game-${counter}`,
    playedAt: '2026-10-01',
    createdAt: `2026-10-01T20:00:${String(counter % 60).padStart(2, '0')}.000Z`,
    updatedAt: `2026-10-01T20:00:${String(counter % 60).padStart(2, '0')}.000Z`,
    ...overrides,
  }
}
