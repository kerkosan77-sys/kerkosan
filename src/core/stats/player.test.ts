import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../../db/types'
import { emptyCounts } from '../analysis/summary'
import type { MoveAnalysis } from '../analysis/types'
import type { GamePhase } from '../types'
import { playerSummary } from './player'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, name: `L${id}`, description: '' }))
const module = {
  levels: LEVELS,
  defaultLevel: 3,
  // The test positions are named after their phase.
  phaseOf: (position: string) => position as GamePhase,
  errorTypes: [
    { id: 'hung_piece', label: 'Taş bırakma' },
    { id: 'other', label: 'Diğer' },
  ],
}

let id = 0
function game(level: number, result: string, analysis?: { moves: [string, MoveAnalysis['classification']][]; types?: Record<string, number> }): GameRecord {
  id++
  const moves = (analysis?.moves ?? []).map(
    ([phase, classification], ply): MoveAnalysis => ({ ply, label: '', code: '', side: 'w', before: phase, after: '', isUserMove: true, classification }),
  )
  const counts = emptyCounts()
  for (const m of moves) if (m.classification) counts[m.classification]++
  return {
    id: `g${id}`,
    gameType: 'chess',
    createdAt: 1000 - id,
    source: 'play',
    record: '',
    userSide: 'w',
    names: { w: 'Sen', b: 'Bot' },
    result,
    level,
    ...(analysis
      ? { analysis: { version: 6, depth: 1, analyzedAt: 0, moves, summary: { userMoves: moves.length, counts, errorTypes: analysis.types ?? {} } } }
      : {}),
  }
}

describe('player summary', () => {
  it('starts from the default level without games', () => {
    const summary = playerSummary([], module)
    expect(summary).toMatchObject({ level: null, recommended: 3, weakest: null, recent: [], topErrors: [] })
  })

  it('places the player by results against the bots and suggests the next bot', () => {
    // Newest first: two wins against level 3, then a loss against level 4.
    const summary = playerSummary([game(3, '1-0'), game(3, '1-0'), game(4, '0-1')], module)
    expect(summary.level).toBe(4) // (4 + 4 + 3) / 3
    expect(summary.recommended).toBe(4)
    expect(summary.reason).toContain('2 tanesini kazandın')
    const down = playerSummary([game(5, '0-1'), game(5, '0-1')], module)
    expect(down.recommended).toBe(4)
    expect(down.level).toBe(4)
  })

  it('finds the part of the game with the most errors and the commonest error types', () => {
    const summary = playerSummary(
      [
        game(3, '0-1', {
          moves: [
            ['opening', 'best'],
            ['opening', 'good'],
            ['opening', 'best'],
            ['opening', 'excellent'],
            ['opening', 'inaccuracy'],
            ['middlegame', 'blunder'],
            ['middlegame', 'best'],
            ['middlegame', 'mistake'],
            ['middlegame', 'good'],
            ['middlegame', 'best'],
            ['endgame', 'blunder'],
          ],
          types: { hung_piece: 2, other: 1 },
        }),
      ],
      module,
    )
    expect(summary.phases.find((p) => p.phase === 'middlegame')).toMatchObject({ moves: 5, errors: 2, per10: 4 })
    // The endgame has only one move: too few to judge.
    expect(summary.weakest).toBe('middlegame')
    expect(summary.topErrors).toEqual([
      ['hung_piece', 2],
      ['other', 1],
    ])
    expect(summary.recent[0]).toMatchObject({ outcome: 'loss', level: 3, errors: 3 })
    // The moves are worth -7 and the loss against level 3 -18: the total stays at zero.
    expect(summary.recent[0].points).toBe(0)
    expect(summary.points).toBe(0)
    expect(summary.errorRate).toBeCloseTo((3 / 11) * 10, 5)
  })
})
