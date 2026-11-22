import { describe, expect, it } from 'vitest'
import { LEVELS, getLevel, pickHumanMove } from './levels'
import type { InfoLine } from './uci'

const line = (multipv: number, move: string, cp: number): InfoLine => ({
  depth: 4,
  multipv,
  score: { kind: 'cp', value: cp },
  pv: [move],
})

/** Deterministic "random" sequence. */
const sequence = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('pickHumanMove', () => {
  const lines = [line(1, 'd1h5', 900), line(2, 'e2e4', 30), line(3, 'a2a3', -20)]
  const legal = ['d1h5', 'e2e4', 'a2a3', 'h2h3']

  it('almost always takes a free queen-sized gain at low temperature', () => {
    const humanize = { multiPV: 3, temperature: 30, randomMoveChance: 0 }
    expect(pickHumanMove(lines, legal, humanize, sequence(0.999))).toBe('d1h5')
  })

  it('can pick a weaker candidate at high temperature', () => {
    const humanize = { multiPV: 3, temperature: 2000, randomMoveChance: 0 }
    // With a huge temperature the weights are nearly equal, so a high roll lands on the last candidate.
    expect(pickHumanMove(lines, legal, humanize, sequence(0.99))).toBe('a2a3')
  })

  it('plays a random legal move when the random-move roll hits', () => {
    const humanize = { multiPV: 3, temperature: 30, randomMoveChance: 0.5 }
    // first roll 0.1 < 0.5 -> random move; second roll 0.9 picks index 3 of 4.
    expect(pickHumanMove(lines, legal, humanize, sequence(0.1, 0.9))).toBe('h2h3')
  })

  it('treats mate as better than any material', () => {
    const withMate: InfoLine[] = [line(1, 'e2e4', 900), { ...line(2, 'd1h5', 0), score: { kind: 'mate', value: 2 } }]
    const humanize = { multiPV: 2, temperature: 100, randomMoveChance: 0 }
    expect(pickHumanMove(withMate, legal, humanize, sequence(0.5))).toBe('d1h5')
  })

  it('ignores candidates that are not legal and returns null when nothing usable is left', () => {
    const humanize = { multiPV: 3, temperature: 30, randomMoveChance: 0 }
    expect(pickHumanMove([line(1, 'z9z9', 50)], legal, humanize)).toBeNull()
    expect(pickHumanMove(lines, [], humanize)).toBeNull()
  })
})

describe('levels', () => {
  it('has 8 levels with increasing depth', () => {
    expect(LEVELS).toHaveLength(8)
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].depth).toBeGreaterThanOrEqual(LEVELS[i - 1].depth)
    }
  })

  it('falls back to level 3 for unknown ids', () => {
    expect(getLevel(99).id).toBe(3)
  })
})
