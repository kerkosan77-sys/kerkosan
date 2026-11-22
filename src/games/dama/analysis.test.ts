import { describe, expect, it } from 'vitest'
import { analyzeGame } from '../../core/analysis/analyzeGame'
import { buildPuzzles } from '../../core/puzzles/fromAnalysis'
import type { GameEngine, GameModule } from '../../core/types'
import type { GameRecord } from '../../db/types'
import { damaModule } from './index'
import { analyzeDama } from './search'

/** The real Dama search, run in the test instead of a worker. */
const engine: GameEngine = {
  start: async () => undefined,
  newGame: async () => undefined,
  chooseMove: async () => null,
  cancelAll: () => undefined,
  analyze: async (position, options) => analyzeDama(position, { depth: options.depth ?? 7, multiPV: options.multiPV ?? 1 }),
}

describe('Dama analysis with the real engine', () => {
  it('finds and explains a piece left to be taken, and makes a puzzle of it', async () => {
    // 3. a4-a5?? walks next to black a6, which takes it (a6xa4) with nothing to take back.
    const record = 'a3-a4 h6-h5 a4-a5 a6xa4'
    const analysis = await analyzeGame(damaModule as GameModule, engine, record, 'w', { depth: 5 })
    const blunder = analysis.moves[2]
    expect(blunder.label).toBe('a4-a5')
    expect(['mistake', 'blunder']).toContain(blunder.classification)
    expect(blunder.errorType).toBe('allowed_capture')
    expect(blunder.explanation).toContain('rakip a6×a4 ile 1 taşını alabiliyor')

    const game: GameRecord = { id: 'd1', gameType: 'dama', createdAt: 0, source: 'play', record, userSide: 'w', names: { w: 'Sen', b: 'Bilgisayar' }, result: '*', analysis }
    const [puzzle] = buildPuzzles(game, 1)
    expect(puzzle.playedMove).toBe('a4-a5')
    expect(damaModule.puzzleHint(puzzle).marks.length).toBeGreaterThan(0)
  }, 60000)
})
