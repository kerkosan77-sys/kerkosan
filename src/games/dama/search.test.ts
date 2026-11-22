import { describe, expect, it } from 'vitest'
import { decode, encode, initialPosition } from './rules'
import { analyzeDama, evaluate } from './search'

function pos(turn: 'w' | 'b', rows: string[]) {
  return encode(decode(`${turn} ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')} 0`))
}

describe('Dama engine', () => {
  it('sees material from the side to move', () => {
    const p = decode(pos('w', ['........', '........', '........', '...b....', '...w....', '....w...']))
    expect(evaluate(p)).toBeGreaterThan(0)
    expect(evaluate({ ...p, turn: 'b' })).toBe(-evaluate(p))
  })

  it('does not walk into a capture when a safe move exists', () => {
    // White d3 next to black e4: d3-d4 (taken sideways) and d3-e3 (taken from above) both lose the man.
    const p = pos('w', ['........', '........', '........', '........', '....b...', '...w....', '........', '.......w'])
    const [best] = analyzeDama(p, { depth: 4 })
    expect(['d3-d4', 'd3-e3']).not.toContain(best.pv[0])
  })

  it('finds a sacrifice that forces a bigger capture', () => {
    // d3-d4 gives a man: black must take (d5xd3), then c3xe3xg3 takes both black men.
    const p = pos('w', ['........', '........', '........', '...b....', '........', '.www.b..', '........', '........'])
    const [best] = analyzeDama(p, { depth: 4 })
    expect(best.pv.slice(0, 3)).toEqual(['d3-d4', 'd5xd3', 'c3xe3xg3'])
    expect(best.score.kind).toBe('mate')
  })

  it('scores a won position as a forced win', () => {
    // White dama against one black man that it can take at once.
    const p = pos('w', ['........', '........', '........', '...b....', '........', '........', '........', '...W...w'])
    const [best] = analyzeDama(p, { depth: 4 })
    expect(best.pv[0]).toMatch(/^d1xd/)
    expect(best.score).toEqual({ kind: 'mate', value: 1 })
  })

  it('answers quickly from the start position', () => {
    const started = Date.now()
    const lines = analyzeDama(encode(initialPosition()), { depth: 9, multiPV: 3 })
    expect(lines).toHaveLength(3)
    expect(Date.now() - started).toBeLessThan(15000)
  })
})
