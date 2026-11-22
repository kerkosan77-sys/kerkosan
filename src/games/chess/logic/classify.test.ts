import { describe, expect, it } from 'vitest'
import { classifyDrop, winDrop } from '../../../core/classify'
import { negateScore, scoreToCp, winPercent } from './winPercent'
import type { Score } from '../../../core/types'

const cp = (value: number): Score => ({ kind: 'cp', value })
const mate = (value: number): Score => ({ kind: 'mate', value })

describe('winPercent', () => {
  it('is 50% for an equal position and symmetric', () => {
    expect(winPercent(cp(0))).toBe(50)
    expect(winPercent(cp(300)) + winPercent(cp(-300))).toBeCloseTo(100, 6)
  })

  it('grows with the evaluation but flattens out when far ahead', () => {
    expect(winPercent(cp(100))).toBeGreaterThan(55)
    expect(winPercent(cp(100))).toBeLessThan(62)
    // +8 and +10 pawns are both "completely winning".
    expect(winPercent(cp(1000)) - winPercent(cp(800))).toBeLessThan(3)
    expect(winPercent(cp(200)) - winPercent(cp(0))).toBeGreaterThan(15)
  })

  it('treats mate as 100% / 0%', () => {
    expect(winPercent(mate(3))).toBe(100)
    expect(winPercent(mate(-1))).toBe(0)
    expect(winPercent(mate(0))).toBe(0)
  })
})

describe('scoreToCp / negateScore', () => {
  it('ranks shorter mates above longer mates and above any material', () => {
    expect(scoreToCp(mate(1))).toBeGreaterThan(scoreToCp(mate(5)))
    expect(scoreToCp(mate(5))).toBeGreaterThan(scoreToCp(cp(2000)))
    expect(scoreToCp(mate(-1))).toBeLessThan(scoreToCp(mate(-5)))
  })

  it('flips the point of view', () => {
    expect(negateScore(cp(120))).toEqual(cp(-120))
    expect(negateScore(mate(2))).toEqual(mate(-2))
    expect(winPercent(negateScore(mate(0)))).toBe(100)
  })
})

describe('classifyDrop', () => {
  it('maps drops to classes at the thresholds', () => {
    expect(classifyDrop(0)).toBe('good')
    expect(classifyDrop(4.9)).toBe('good')
    expect(classifyDrop(5)).toBe('inaccuracy')
    expect(classifyDrop(10)).toBe('mistake')
    expect(classifyDrop(19.9)).toBe('mistake')
    expect(classifyDrop(20)).toBe('blunder')
    expect(classifyDrop(80)).toBe('blunder')
  })
})

describe('move classification by winning chances', () => {
  const classify = (best: Score, played: Score) => classifyDrop(winDrop(winPercent(best), winPercent(played)))

  it('calls a free minor piece in an equal position a blunder', () => {
    expect(classify(cp(0), cp(-300))).toBe('blunder')
  })

  it('calls losing two pawns a mistake and one pawn an inaccuracy', () => {
    expect(classify(cp(0), cp(-200))).toBe('mistake')
    expect(classify(cp(0), cp(-100))).toBe('inaccuracy')
  })

  it('does not punish "winning less" in a completely won position', () => {
    // +9 instead of +12: same result, still crushing.
    expect(classify(cp(1200), cp(900))).toBe('good')
    // A forced mate replaced by a huge material advantage is still fine.
    expect(classify(mate(4), cp(1500))).toBe('good')
  })

  it('flags walking into a forced mate as a blunder', () => {
    expect(classify(cp(50), mate(-2))).toBe('blunder')
  })

  it('flags throwing away a won game as a blunder', () => {
    expect(classify(mate(3), cp(0))).toBe('blunder')
    expect(classify(cp(500), cp(-100))).toBe('blunder')
  })

  it('treats any move in an already lost position as good (nothing left to lose)', () => {
    expect(classify(mate(-2), mate(-1))).toBe('good')
  })

  it('never reports a negative drop when the played move scores better', () => {
    expect(winDrop(winPercent(cp(0)), winPercent(cp(80)))).toBe(0)
  })
})
