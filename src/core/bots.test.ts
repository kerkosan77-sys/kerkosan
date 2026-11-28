import { describe, expect, it } from 'vitest'
import { LEVELS as CHESS } from '../games/chess/engine/levels'
import { LEVELS as DAMA } from '../games/dama/levels'
import { LEVELS as GO } from '../games/go/levels'
import { LEVELS as MANGALA } from '../games/mangala/levels'
import { LEVELS as REVERSI } from '../games/reversi/levels'
import { botMove, depthFor } from './humanize'
import type { EngineLine } from './types'

const line = (move: string, cp: number): EngineLine => ({ score: { kind: 'cp', value: cp }, pv: [move] })

/** Deterministic "random" sequence. */
const sequence = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('botMove', () => {
  it('plays the only legal move without searching', async () => {
    let searched = false
    const move = await botMove({ depth: 5 }, ['a'], () => {
      searched = true
      return []
    })
    expect(move).toBe('a')
    expect(searched).toBe(false)
  })

  it("plays the engine's choice at full strength", async () => {
    expect(await botMove({ depth: 5 }, ['a', 'b'], () => [line('b', 50), line('a', 0)])).toBe('b')
  })

  it('makes a careless move without searching when the roll hits', async () => {
    let searched = false
    const style = { depth: 3, humanize: { multiPV: 4, temperature: 50, randomMoveChance: 0.5 } }
    const move = await botMove(style, ['a', 'b', 'c'], () => {
      searched = true
      return []
    }, sequence(0.1, 0.9))
    expect(move).toBe('c')
    expect(searched).toBe(false)
  })

  it('looks one step deeper as often as the level says', () => {
    expect(depthFor({ depth: 4, deeper: 0.3 }, () => 0.2)).toBe(5)
    expect(depthFor({ depth: 4, deeper: 0.3 }, () => 0.5)).toBe(4)
    expect(depthFor({ depth: 4 }, () => 0)).toBe(4)
  })
})

describe('trained levels', () => {
  const games = { chess: CHESS, dama: DAMA, mangala: MANGALA, reversi: REVERSI }
  for (const [name, levels] of Object.entries(games)) {
    it(`${name}: eight levels, each looking at least as far and erring less than the one below`, () => {
      expect(levels).toHaveLength(8)
      levels.forEach((level, i) => expect(level.id).toBe(i + 1))
      for (let i = 1; i < levels.length; i++) {
        const [weaker, stronger] = [levels[i - 1], levels[i]]
        expect(stronger.depth + (stronger.deeper ?? 0)).toBeGreaterThanOrEqual(weaker.depth + (weaker.deeper ?? 0))
        expect(stronger.humanize?.temperature ?? 0).toBeLessThanOrEqual(weaker.humanize?.temperature ?? 0)
        expect(stronger.humanize?.randomMoveChance ?? 0).toBeLessThanOrEqual(weaker.humanize?.randomMoveChance ?? 0)
      }
    })
  }

  it('go: eight levels with more and more random games', () => {
    expect(GO).toHaveLength(8)
    for (let i = 1; i < GO.length; i++) {
      expect(GO[i].playouts).toBeGreaterThanOrEqual(GO[i - 1].playouts)
      expect(GO[i].humanize?.randomMoveChance ?? 0).toBeLessThanOrEqual(GO[i - 1].humanize?.randomMoveChance ?? 0)
    }
  })
})
