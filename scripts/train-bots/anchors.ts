// The training ladder of each game: bots from very weak to full strength. Training measures how strong
// each one really is, then places the eight levels on it (in between two bots, settings are blended).
// The first bot is level 1 ("Çok kolay"), the last one level 8 ("Usta").
import type { Bot } from './games'

const h = (multiPV: number, temperature: number, randomMoveChance: number) => ({ multiPV, temperature, randomMoveChance })

export const ANCHORS: Record<string, Bot[]> = {
  mangala: [
    { depth: 1, humanize: h(6, 300, 0.3) },
    { depth: 1, humanize: h(6, 200, 0.15) },
    { depth: 2, humanize: h(6, 140, 0.08) },
    { depth: 3, humanize: h(6, 90, 0.04) },
    { depth: 4, humanize: h(6, 55, 0.02) },
    { depth: 5, humanize: h(6, 30, 0.01) },
    { depth: 6, humanize: h(4, 12, 0) },
    { depth: 7 },
    { depth: 9 },
    { depth: 11 },
    { depth: 14 },
  ],
  dama: [
    { depth: 1, humanize: h(8, 300, 0.3) },
    { depth: 1, humanize: h(8, 200, 0.15) },
    { depth: 2, humanize: h(8, 140, 0.08) },
    { depth: 3, humanize: h(8, 90, 0.04) },
    { depth: 4, humanize: h(6, 55, 0.02) },
    { depth: 5, humanize: h(6, 30, 0.01) },
    { depth: 6, humanize: h(4, 12, 0) },
    { depth: 6 },
    { depth: 7 },
    { depth: 8 },
    // Deeper searches without a time limit take many seconds on a phone.
    { depth: 14, maxMs: 3500 },
  ],
  reversi: [
    { depth: 1, humanize: h(8, 150, 0.3) },
    { depth: 1, humanize: h(8, 100, 0.15) },
    { depth: 2, humanize: h(8, 70, 0.08) },
    { depth: 3, humanize: h(8, 45, 0.04) },
    { depth: 4, humanize: h(6, 28, 0.02) },
    { depth: 5, humanize: h(6, 15, 0.01) },
    { depth: 5, humanize: h(4, 6, 0) },
    { depth: 6 },
    { depth: 7 },
    { depth: 8 },
    // Deeper searches without a time limit take many seconds on a phone.
    { depth: 12, maxMs: 3000 },
  ],
  go: [
    { depth: 0, playouts: 150, humanize: h(10, 800, 0.3) },
    { depth: 0, playouts: 300, humanize: h(8, 550, 0.15) },
    { depth: 0, playouts: 600, humanize: h(8, 380, 0.08) },
    { depth: 0, playouts: 1000, humanize: h(8, 250, 0.04) },
    { depth: 0, playouts: 2000, humanize: h(6, 150, 0.02) },
    { depth: 0, playouts: 4000, humanize: h(6, 70, 0.01) },
    { depth: 0, playouts: 6000, humanize: h(4, 25, 0) },
    { depth: 0, playouts: 9000 },
    { depth: 0, playouts: 14000 },
    { depth: 0, playouts: 20000 },
    { depth: 0, playouts: 30000 },
  ],
  chess: [
    { depth: 2, humanize: h(8, 250, 0.22) },
    { depth: 2, humanize: h(8, 180, 0.12) },
    { depth: 3, humanize: h(6, 130, 0.07) },
    { depth: 4, humanize: h(5, 90, 0.04) },
    { depth: 5, humanize: h(4, 60, 0.02) },
    { depth: 6, humanize: h(3, 35, 0.01) },
    { depth: 7, humanize: h(3, 15, 0) },
    { depth: 8 },
    { depth: 10 },
    { depth: 12 },
    { depth: 14 },
  ],
}
