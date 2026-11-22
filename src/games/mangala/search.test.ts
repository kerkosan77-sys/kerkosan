import { describe, expect, it } from 'vitest'
import { Searcher, analyzePosition, evaluate, toScore } from './search'
import { applyMove, decode, encode, initialPosition } from './rules'

describe('evaluate', () => {
  it('counts stones in the stores from the side to move', () => {
    const pits = [0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 4]
    expect(evaluate(pits, 'w')).toBe(600)
    expect(evaluate(pits, 'b')).toBe(-600)
  })
})

describe('search', () => {
  it('grabs a big capture', () => {
    // Pit 6 (index 5, 3 stones) ends on b's 11-stone pit and makes it 12: capture.
    const position = encode({ pits: [1, 0, 0, 0, 0, 3, 0, 11, 1, 1, 1, 1, 1, 0], turn: 'w' })
    const [best] = analyzePosition(position, { depth: 4 })
    expect(best.pv[0]).toBe('5')
    expect(best.score.kind === 'cp' ? best.score.value : 99999).toBeGreaterThan(1000)
  })

  it('reports a forced win as a mate score', () => {
    // The single stone in pit 6 reaches the store, w's pits are empty and w takes b's stones: 33-15.
    const position = encode({ pits: [0, 0, 0, 0, 0, 1, 20, 2, 2, 2, 2, 2, 2, 15], turn: 'w' })
    const [best] = analyzePosition(position, { depth: 6 })
    expect(best.pv).toEqual(['5'])
    expect(best.score).toEqual({ kind: 'mate', value: 1 })
  })

  it('reports a forced loss with a negative mate score', () => {
    // w has a single move; it captures b's last stones, which hands the win to b (21-27).
    const position = encode({ pits: [0, 0, 0, 0, 0, 3, 18, 1, 0, 0, 0, 0, 0, 26], turn: 'w' })
    const [best] = analyzePosition(position, { depth: 6 })
    expect(best.score.kind).toBe('mate')
    expect(best.score.value).toBeLessThan(0)
  })

  it('scores every move with multiPV, best first, agreeing with the single best line', () => {
    const start = encode(initialPosition())
    const all = analyzePosition(start, { depth: 8, multiPV: 6 })
    expect(all).toHaveLength(6)
    const values = all.map((line) => (line.score.kind === 'cp' ? line.score.value : 0))
    expect([...values].sort((a, b) => b - a)).toEqual(values)
    const [single] = analyzePosition(start, { depth: 8, multiPV: 1 })
    expect(single.score).toEqual(all[0].score)
  })

  it('returns legal principal variations', () => {
    const start = initialPosition()
    for (const line of analyzePosition(encode(start), { depth: 10, multiPV: 3 })) {
      let position = start
      for (const move of line.pv) {
        const result = applyMove(position, Number(move))
        expect(result).not.toBeNull()
        position = result!.position
      }
    }
  })

  it('returns nothing for a finished game', () => {
    expect(analyzePosition('w:0,0,0,0,0,0,30,0,0,0,0,0,0,18', { depth: 5 })).toEqual([])
  })

  it('stops at the node limit and still returns the last finished depth', () => {
    const { pits, turn } = decode(encode(initialPosition()))
    const searcher = new Searcher()
    const lines = searcher.analyze(pits, turn, { depth: 30, maxNodes: 20_000 })
    expect(lines).toHaveLength(1)
    expect(searcher.nodes).toBeLessThanOrEqual(20_001)
  })
})

describe('toScore', () => {
  it('turns search values into scores', () => {
    expect(toScore(250)).toEqual({ kind: 'cp', value: 250 })
    expect(toScore(100000 - 3)).toEqual({ kind: 'mate', value: 3 })
    expect(toScore(-(100000 - 5))).toEqual({ kind: 'mate', value: -5 })
  })
})
