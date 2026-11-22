import { describe, expect, it } from 'vitest'
import { GAMES } from '../../games/registry'
import { pointsRank, RANK_START, rangeText, rankLadder } from './rank'

const chess = GAMES.find((g) => g.id === 'chess')!

describe('points levels', () => {
  it('gives every game one range per level, starting at zero and growing', () => {
    for (const game of GAMES) {
      const starts = RANK_START[game.id]
      expect(starts.length, game.id).toBe(game.levels.length)
      expect(starts[0], game.id).toBe(0)
      for (let i = 1; i < starts.length; i++) expect(starts[i], game.id).toBeGreaterThan(starts[i - 1])
    }
  })

  it('gives games with more moves wider ranges', () => {
    const top = (id: keyof typeof RANK_START) => RANK_START[id][RANK_START[id].length - 1]
    expect(top('mangala')).toBeLessThan(top('reversi'))
    expect(top('reversi')).toBeLessThan(top('chess'))
    expect(top('chess')).toBeLessThan(top('go'))
  })

  it('lists the ranges without gaps', () => {
    const ladder = rankLadder('chess', chess.levels)
    expect(ladder.map((s) => s.name)).toEqual(chess.levels.map((l) => l.name))
    for (let i = 1; i < ladder.length; i++) expect(ladder[i].min).toBe((ladder[i - 1].max ?? -1) + 1)
    expect(ladder[ladder.length - 1].max).toBeNull()
    expect(rangeText(ladder[1])).toBe('100–249 puan')
    expect(rangeText(ladder[7])).toBe('2.600+ puan')
  })

  it('finds the level of a points total and what is left to the next one', () => {
    expect(pointsRank(0, 'chess', chess.levels)).toMatchObject({ level: 1, name: 'Çok kolay', toNext: 100, progress: 0 })
    expect(pointsRank(100, 'chess', chess.levels)).toMatchObject({ level: 2, name: 'Kolay', toNext: 150 })
    const mid = pointsRank(375, 'chess', chess.levels)
    expect(mid).toMatchObject({ level: 3, name: 'Kolay+', toNext: 125, progress: 0.5 })
    expect(mid.next?.name).toBe('Orta')
    expect(pointsRank(9999, 'chess', chess.levels)).toMatchObject({ level: 8, next: null, toNext: 0, progress: 1 })
    // The same total is a lower level in a game with more moves.
    expect(pointsRank(500, 'go', GAMES.find((g) => g.id === 'go')!.levels).level).toBe(3)
    expect(pointsRank(500, 'mangala', GAMES.find((g) => g.id === 'mangala')!.levels).level).toBe(5)
  })
})
