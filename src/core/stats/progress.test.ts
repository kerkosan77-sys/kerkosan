import { describe, expect, it } from 'vitest'
import { blunderStats, blunderStatsByMode, formatDecimal, puzzleStats } from './progress'
import { modeSummary } from '../records'
import type { AttemptRecord, GameRecord } from '../../db/types'
import type { GameAnalysis } from '../analysis/types'
import { emptyCounts } from '../analysis/summary'

function game(id: number, blunders: number | null, playedAt?: number): GameRecord {
  const analysis: GameAnalysis | undefined =
    blunders === null
      ? undefined
      : {
          version: 2,
          depth: 14,
          analyzedAt: 0,
          moves: [],
          summary: { userMoves: 20, counts: { ...emptyCounts(), good: 20, blunder: blunders }, errorTypes: {} },
        }
  return {
    id: String(id),
    gameType: 'chess',
    createdAt: id,
    playedAt,
    source: 'play',
    record: '',
    userSide: 'w',
    names: { w: 'Sen', b: 'Bot' },
    result: '*',
    analysis,
  }
}

describe('blunderStats', () => {
  it('has no average without analysed games', () => {
    expect(blunderStats([game(1, null)])).toEqual({ average: null, games: 0, previous: null })
  })

  it('averages blunders over the 10 most recent analysed games', () => {
    // 12 games: the two oldest have 5 blunders, the newest has 3, the rest 1.
    const games = Array.from({ length: 12 }, (_, i) => game(i + 1, i === 11 ? 3 : i < 2 ? 5 : 1))
    const stats = blunderStats(games)
    expect(stats.games).toBe(10)
    expect(stats.average).toBeCloseTo((3 + 9 * 1) / 10)
    // Only 2 older games: not enough for a comparison.
    expect(stats.previous).toBeNull()
  })

  it('compares with the 10 games before when there are enough', () => {
    const older = Array.from({ length: 10 }, (_, i) => game(i + 1, 3))
    const newer = Array.from({ length: 10 }, (_, i) => game(i + 11, 1))
    expect(blunderStats([...newer, ...older])).toMatchObject({ average: 1, previous: 3 })
  })

  it('orders by the date the game was played when known', () => {
    // Imported last (createdAt 99) but played long ago.
    const oldImport = game(99, 10, 1)
    const recent = Array.from({ length: 10 }, (_, i) => game(i + 1, 0, 1000 + i))
    expect(blunderStats([oldImport, ...recent]).average).toBe(0)
  })

  it('ignores games that were not analysed', () => {
    expect(blunderStats([game(1, 2), game(2, null)])).toMatchObject({ average: 2, games: 1 })
  })
})

describe('blunderStatsByMode', () => {
  it('separates learning-mode games from unassisted ones (playing mode and imported games)', () => {
    const learn = { ...game(1, 0), mode: 'learn' as const }
    const play = { ...game(2, 3), mode: 'play' as const }
    const imported = game(3, 1)
    const stats = blunderStatsByMode([learn, play, imported])
    expect(stats.learn).toMatchObject({ average: 0, games: 1 })
    expect(stats.unassisted).toMatchObject({ average: 2, games: 2 })
  })

  it('has no average for a mode without games', () => {
    expect(blunderStatsByMode([{ ...game(1, 2), mode: 'play' as const }]).learn.average).toBeNull()
  })
})

describe('modeSummary', () => {
  it('describes the mode and how much the coach helped', () => {
    expect(modeSummary({ mode: 'play' })).toBe('Oynama modunda oynandı (yardımsız).')
    expect(modeSummary({ mode: 'learn', coachStats: { warnings: 3, takebacks: 2 } })).toBe(
      'Öğrenme modunda oynandı · Koç 3 kez uyardı, 2 kez geri aldın.',
    )
    expect(modeSummary({ mode: 'learn', coachStats: { warnings: 1, takebacks: 0 } })).toBe(
      'Öğrenme modunda oynandı · Koç 1 kez uyardı, hiç geri almadın.',
    )
    expect(modeSummary({ mode: 'learn', coachStats: { warnings: 0, takebacks: 0 } })).toContain('uyarı vermedi')
    expect(modeSummary({})).toBeNull()
  })
})

describe('puzzleStats', () => {
  const attempt = (result: AttemptRecord['result']): AttemptRecord => ({ gameType: 'chess', puzzleId: 'p', at: 0, result })

  it('has no rate without attempts', () => {
    expect(puzzleStats([])).toEqual({ rate: null, attempts: 0 })
  })

  it('counts only first-try solutions as successes', () => {
    const stats = puzzleStats([attempt('correct'), attempt('hint'), attempt('failed'), attempt('correct')])
    expect(stats).toEqual({ rate: 50, attempts: 4 })
  })

  it('uses only the most recent 50 attempts', () => {
    const attempts = [...Array(50).fill(attempt('correct')), ...Array(30).fill(attempt('failed'))]
    expect(puzzleStats(attempts)).toEqual({ rate: 100, attempts: 50 })
  })
})

describe('formatDecimal', () => {
  it('uses a Turkish decimal comma and at most one decimal', () => {
    expect(formatDecimal(1.25)).toBe('1,3')
    expect(formatDecimal(2)).toBe('2')
    expect(formatDecimal(0.5)).toBe('0,5')
  })
})
