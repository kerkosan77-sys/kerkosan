import { describe, expect, it } from 'vitest'
import type { GameRecord } from '../../db/types'
import { emptyCounts } from '../analysis/summary'
import type { MoveAnalysis } from '../analysis/types'
import { gamePoints, pointsTotal, resultPoints, signed } from './points'

function game(id: string, result: string, level: number | undefined, classes: MoveAnalysis['classification'][] = [], analysed = true): GameRecord {
  const moves = classes.map((classification, ply): MoveAnalysis => ({ ply, label: '', code: '', side: 'w', before: '', after: '', isUserMove: true, classification }))
  return {
    id,
    gameType: 'chess',
    createdAt: 0,
    source: 'play',
    record: '',
    userSide: 'w',
    names: { w: 'Sen', b: 'Bot' },
    result,
    level,
    ...(analysed ? { analysis: { version: 6, depth: 1, analyzedAt: 0, moves, summary: { userMoves: moves.length, counts: emptyCounts(), errorTypes: {} } } } : {}),
  }
}

describe('points', () => {
  it('rewards good moves, punishes errors and weighs results by the bot level', () => {
    expect(gamePoints(game('a', '1-0', 4, ['best', 'great', 'mistake', 'blunder', 'inaccuracy']))).toEqual({
      moves: 2 + 3 - 3 - 5 - 1,
      result: 20,
      total: 16,
      analysed: true,
    })
    expect(resultPoints('loss', 8)).toBe(-3)
    expect(resultPoints('loss', 1)).toBe(-24)
    expect(resultPoints('draw', 3)).toBe(6)
    // Imported games (no bot level) only count their moves.
    expect(gamePoints({ ...game('b', '0-1', undefined, ['best']), source: 'pgn' }).total).toBe(2)
  })

  it('adds up oldest first and never goes below zero', () => {
    // Newest first: a win after two heavy losses.
    const { total, perGame } = pointsTotal([game('3', '1-0', 2), game('2', '0-1', 1), game('1', '0-1', 1)])
    expect(perGame.get('1')).toBe(0)
    expect(perGame.get('2')).toBe(0)
    expect(perGame.get('3')).toBe(10)
    expect(total).toBe(10)
    expect(signed(5)).toBe('+5')
    expect(signed(-3)).toBe('-3')
  })
})
