import { describe, expect, it } from 'vitest'
import { analyzeGo, chooseGoMove } from './bot'
import { makeRng } from './fastboard'
import { getLevel } from './levels'
import { decode, encode, hasContestedPoints, initialPosition, legalPoints, indexOf } from './rules'

const WALLS = Array(9).fill('....xo...').join('/')
/** The white group D6-G6 has one liberty left (G5) and would escape through it; black to move. */
const ATARI = `x ........./........./...xxxx../..xoooox./...xxx.../........./........./........./......... - 0 7.5`

describe('computer moves', () => {
  it('captures a big group in atari', () => {
    expect(chooseGoMove(ATARI, getLevel(6), makeRng(3))).toBe('G5')
  })

  it('reports the capture as the best line with a positive score', () => {
    const { lines, ownership } = analyzeGo(ATARI, { playouts: 3000, multiPV: 3 }, makeRng(4))
    expect(lines[0].pv[0]).toBe('G5')
    expect(lines[0].score.kind).toBe('cp')
    expect(lines[0].score.value).toBeGreaterThan(0)
    expect(ownership).toHaveLength(81)
  })

  it('plays on an open board instead of passing', () => {
    const position = encode(initialPosition())
    expect(hasContestedPoints(decode(position))).toBe(true)
    const move = chooseGoMove(position, getLevel(1), makeRng(1))
    expect(move).not.toBe('pass')
    expect(legalPoints(decode(position))).toContain(indexOf(move, 9))
  })

  it('passes when every area is walled in', () => {
    const position = `x ${WALLS} - 0 7.5`
    expect(hasContestedPoints(decode(position))).toBe(false)
    expect(chooseGoMove(position, getLevel(8), makeRng(2))).toBe('pass')
  })

  it('accepts the end when the opponent passed and the count favours it', () => {
    // Black leads by 1.5 after komi.
    expect(chooseGoMove(`x ${WALLS} - 1 7.5`, getLevel(8), makeRng(2))).toBe('pass')
  })

  it('keeps playing for neutral points between the walls', () => {
    const rows = Array(9).fill('....x.o..')
    expect(hasContestedPoints(decode(`o ${rows.join('/')} - 0 7.5`))).toBe(true)
  })
})

describe('analysis of finished positions', () => {
  it('gives the exact count and recommends passing once everything is walled in', () => {
    const before = analyzeGo(`x ${WALLS} - 0 7.5`, { playouts: 2000, multiPV: 3 })
    expect(before.lines).toEqual([{ score: { kind: 'cp', value: 150 }, pv: ['pass', 'pass'] }])
    // After black passes, white sees the same count from its side: passing cost black nothing.
    const after = analyzeGo(`o ${WALLS} - 1 7.5`, { playouts: 2000, multiPV: 1 })
    expect(after.lines[0].score).toEqual({ kind: 'cp', value: -150 })
  })
})
