import { describe, expect, it } from 'vitest'
import { analyzeReversi } from './search'
import {
  applyMove,
  cornerNear,
  countsBySide,
  decode,
  encode,
  initialPosition,
  legalMoves,
  squareIndex,
  squareName,
  winnerOf,
} from './rules'

const codes = (text: string) => legalMoves(decode(text)).map((m) => squareName(m.square)).sort()

describe('Reversi rules', () => {
  it('starts with four discs and black to move', () => {
    const start = initialPosition()
    expect(encode(start)).toBe('x ......../......../......../...ox.../...xo.../......../......../........')
    expect(encode(decode(encode(start)))).toBe(encode(start))
    expect(codes(encode(start))).toEqual(['c4', 'd3', 'e6', 'f5'])
    expect(squareName(squareIndex('h8')!)).toBe('h8')
    expect(squareIndex('a1')).toBe(0)
  })

  it('turns over every closed line', () => {
    const result = applyMove(initialPosition(), 'd3')!
    expect(result.move.flips.map(squareName)).toEqual(['d4'])
    expect(countsBySide(result.position.board)).toEqual({ w: 4, b: 1 })
    expect(result.position.turn).toBe('b')
    expect(applyMove(initialPosition(), 'a1')).toBeNull()
  })

  it('lets the same player move again when the opponent cannot move', () => {
    // White's only disc is b1; after black a1xb1? No: black plays c1 closing b1 between a1 and c1 -> white has no discs.
    const text = 'x xo....../......../......../......../......../......../......../.......o'
    const result = applyMove(decode(text), 'c1')!
    expect(result.position.board[squareIndex('b1')!]).toBe(1)
    // White still has h8 but no legal move; black has none either -> game over.
    expect(result.over).toBe(true)
    expect(winnerOf(result.position)).toBe('w')
  })

  it('knows the squares next to corners', () => {
    expect(cornerNear(squareIndex('b2')!)).toEqual({ corner: 0, kind: 'x' })
    expect(cornerNear(squareIndex('g8')!)).toEqual({ corner: 63, kind: 'c' })
    expect(cornerNear(squareIndex('d4')!)).toBeNull()
  })
})

describe('Reversi engine', () => {
  it('takes a free corner', () => {
    // Black to move can take a1 by closing b2 (white) against c3 (black).
    const text = 'x ......../.o....../..x...../...xo.../...ox.../......../......../........'
    expect(codes(text)).toContain('a1')
    expect(analyzeReversi(text, { depth: 3 })[0].pv[0]).toBe('a1')
  })

  it('counts the end of the game exactly', () => {
    // One empty square left (h8): black takes it and wins.
    const rows = ['xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'xxxxxxxx', 'oooooooo', 'oooooooo', 'oooooooo', 'ooooooo.']
    const lines = analyzeReversi(`x ${rows.join('/')}`, { depth: 2 })
    expect(lines[0].pv[0]).toBe('h8')
    expect(lines[0].score).toEqual({ kind: 'mate', value: 1 })
  })

  it('answers quickly from the start', () => {
    const started = Date.now()
    expect(analyzeReversi(encode(initialPosition()), { depth: 6, multiPV: 3 })).toHaveLength(3)
    expect(Date.now() - started).toBeLessThan(5000)
  })
})
