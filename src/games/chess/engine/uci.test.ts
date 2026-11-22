import { describe, expect, it } from 'vitest'
import { mergeInfo, parseBestMove, parseInfo, type InfoLine } from './uci'

describe('parseInfo', () => {
  it('reads depth, multipv, centipawn score and pv', () => {
    const info = parseInfo(
      'info depth 12 seldepth 18 multipv 2 score cp -35 nodes 12345 nps 500000 hashfull 3 time 25 pv e7e5 g1f3 b8c6',
    )
    expect(info).toEqual({ depth: 12, multipv: 2, score: { kind: 'cp', value: -35 }, pv: ['e7e5', 'g1f3', 'b8c6'] })
  })

  it('reads mate scores, including negative ones', () => {
    expect(parseInfo('info depth 20 score mate 3 pv d1h5 g7g6 h5e5')?.score).toEqual({ kind: 'mate', value: 3 })
    expect(parseInfo('info depth 20 score mate -2 pv e1e2 d8h4')?.score).toEqual({ kind: 'mate', value: -2 })
  })

  it('marks bound scores', () => {
    expect(parseInfo('info depth 9 score cp 50 lowerbound pv e2e4')?.bound).toBe('lower')
    expect(parseInfo('info depth 9 score cp 50 upperbound pv e2e4')?.bound).toBe('upper')
  })

  it('handles wdl numbers between score and pv', () => {
    const info = parseInfo('info depth 10 multipv 1 score cp 20 wdl 120 800 80 nodes 1 pv d2d4')
    expect(info?.score).toEqual({ kind: 'cp', value: 20 })
    expect(info?.pv).toEqual(['d2d4'])
  })

  it('ignores lines without a usable score or pv', () => {
    expect(parseInfo('info string NNUE evaluation using nn-xyz.nnue')).toBeNull()
    expect(parseInfo('info depth 5 currmove e2e4 currmovenumber 1')).toBeNull()
    expect(parseInfo('info depth 0 score mate 0')).toBeNull()
    expect(parseInfo('bestmove e2e4')).toBeNull()
  })
})

describe('parseBestMove', () => {
  it('reads the best move and ignores ponder', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ move: 'e2e4' })
    expect(parseBestMove('bestmove e7e8q')).toEqual({ move: 'e7e8q' })
  })

  it('returns null move when there is none', () => {
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null })
  })

  it('returns undefined for other lines', () => {
    expect(parseBestMove('info depth 1 score cp 0 pv e2e4')).toBeUndefined()
  })
})

describe('mergeInfo', () => {
  const line = (depth: number, value: number, bound?: InfoLine['bound']): InfoLine => ({
    depth,
    multipv: 1,
    score: { kind: 'cp', value },
    pv: ['e2e4'],
    ...(bound ? { bound } : {}),
  })

  it('keeps an exact score over a newer bound score', () => {
    const lines = new Map<number, InfoLine>()
    mergeInfo(lines, line(10, 30))
    mergeInfo(lines, line(11, 80, 'lower'))
    expect(lines.get(1)?.score).toEqual({ kind: 'cp', value: 30 })
    mergeInfo(lines, line(11, 45))
    expect(lines.get(1)?.score).toEqual({ kind: 'cp', value: 45 })
  })
})
