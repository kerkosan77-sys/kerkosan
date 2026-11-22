import { describe, expect, it } from 'vitest'
import { analyzeGame } from '../../core/analysis/analyzeGame'
import type { GameEngine, GameModule } from '../../core/types'
import { analyzeGo } from './bot'
import { hashString, makeRng } from './fastboard'
import { goModule } from './index'

/** The real Go search, run in the test instead of a worker (seeded like the worker). */
const engine: GameEngine = {
  start: async () => undefined,
  newGame: async () => undefined,
  chooseMove: async () => null,
  cancelAll: () => undefined,
  async analyze(position, options) {
    const playouts = (options.depth ?? 10) * 400
    return analyzeGo(position, { playouts, multiPV: options.multiPV ?? 1 }, makeRng(hashString(`${position} ${playouts}`))).lines
  },
}

describe('Go analysis with the real engine', () => {
  it('explains leaving a group in atari', async () => {
    // Black D5-E5 is in atari (last liberty E4) and black plays J1 instead of escaping.
    const sgf = '(;GM[1]FF[4]SZ[9]KM[7.5]PL[B]AB[de][ee][cc][gc][cg][gg]AW[ce][dd][ed][fe][df];B[ii];W[ef])'
    const analysis = await analyzeGame(goModule as GameModule, engine, sgf, 'w')
    const j1 = analysis.moves[0]
    expect(j1.bestMove).toBe('E4')
    expect(['mistake', 'blunder']).toContain(j1.classification)
    expect(j1.errorType).toBe('lost_group')
    expect(j1.explanation).toContain('D5 ve E5 taşlarının tek nefesi kalmıştı')
  }, 60000)

  it('explains a missed capture', async () => {
    // White D5-E5 is in atari (last liberty E4) and black plays J1 instead of taking it.
    const sgf = '(;GM[1]FF[4]SZ[9]KM[7.5]PL[B]AB[ce][dd][ed][fe][df]AW[de][ee][cc][gc][cg][gg];B[ii];W[ef])'
    const analysis = await analyzeGame(goModule as GameModule, engine, sgf, 'w')
    const j1 = analysis.moves[0]
    expect(j1.bestMove).toBe('E4')
    expect(['mistake', 'blunder']).toContain(j1.classification)
    expect(j1.errorType).toBe('missed_capture')
    expect(j1.explanation).toContain('E4 noktasına oynayıp onları yakalayabilirdin')
  }, 60000)
})
