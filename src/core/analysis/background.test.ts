import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { chessModule } from '../../games/chess'
import { getGame, listPuzzles, saveGame } from '../../db/db'
import type { GameRecord } from '../../db/types'
import type { EngineLine, GameEngine, GameModule, Score } from '../types'
import { analysisJob, queueAnalysis, watchAnalysis, type AnalysisJob } from './background'

const cp = (value: number): Score => ({ kind: 'cp', value })
const line = (pv: string[], score: Score): EngineLine => ({ score, pv })

// 1.Nf3 e5?? 2.Nxe5 — the user is black and leaves the pawn to the knight.
const TABLE: Record<string, EngineLine[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [line(['e2e4'], cp(30)), line(['g1f3'], cp(25))],
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b': [line(['d7d5'], cp(-20)), line(['g8f6'], cp(-25))],
  'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w': [line(['f3e5'], cp(200))],
  'rnbqkbnr/pppp1ppp/8/4N3/8/8/PPPPPPPP/RNBQKB1R b': [line(['d8e7'], cp(-180))],
}

const engine: GameEngine = {
  start: async () => undefined,
  newGame: async () => undefined,
  chooseMove: async () => null,
  cancelAll: () => undefined,
  analyze: async (position) => TABLE[position.split(' ').slice(0, 2).join(' ')] ?? [],
}
const module = { ...chessModule, engine: () => engine } as GameModule

describe('background analysis', () => {
  it('analyses a finished game by itself and saves its puzzles with their phase', async () => {
    const record: GameRecord = {
      id: 'bg1',
      gameType: 'chess',
      createdAt: 1,
      source: 'play',
      record: '1. Nf3 e5 2. Nxe5 *',
      userSide: 'b',
      names: { w: 'Bilgisayar', b: 'Sen' },
      result: '*',
    }
    await saveGame(record)
    const seen: AnalysisJob['status'][] = []
    const stop = watchAnalysis('bg1', (job) => seen.push(job.status))

    const first = queueAnalysis(module, 'bg1')
    // Asking again while it runs gives the same job.
    expect(queueAnalysis(module, 'bg1')).toBe(first)
    const analysed = await first
    stop()

    expect(analysed?.analysis?.moves[1].classification).toBe('mistake')
    expect((await getGame('bg1'))?.analysis).toBeDefined()
    const puzzles = await listPuzzles('chess')
    expect(puzzles.map((p) => [p.id, p.phase])).toEqual([['bg1:1', 'opening']])
    expect(analysisJob('bg1')).toMatchObject({ status: 'done', newPuzzles: 1 })
    expect(seen[0]).toBe('waiting')
    expect(seen).toContain('running')
    expect(seen[seen.length - 1]).toBe('done')
  })

  it('reports a game that does not exist', async () => {
    expect(await queueAnalysis(module, 'missing')).toBeNull()
    expect(analysisJob('missing')).toMatchObject({ status: 'error', error: 'Oyun bulunamadı.' })
  })
})
