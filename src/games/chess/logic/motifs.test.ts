import { describe, expect, it } from 'vitest'
import { firstCaptureBy, forkTargets, lineMaterial, uciToSan } from './motifs'
import { formatSan, joinTurkish } from './pieces'

describe('lineMaterial', () => {
  const start = 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'

  it('adds up captures for and against a side', () => {
    // Nxe5 dxe5: +1 -3
    expect(lineMaterial(start, ['f3e5', 'd6e5'], 'w')).toBe(-2)
    expect(lineMaterial(start, ['f3e5', 'd6e5'], 'b')).toBe(2)
  })

  it('follows an exchange past the ply limit instead of stopping mid-way', () => {
    // Nxe5 at ply 1 of a 1-ply limit, but dxe5 is a capture too, so it is included.
    expect(lineMaterial(start, ['f3e5', 'd6e5'], 'w', 1)).toBe(-2)
  })

  it('counts promotions', () => {
    const fen = '8/P6k/8/8/8/8/8/K7 w - - 0 1'
    expect(lineMaterial(fen, ['a7a8q'], 'w')).toBe(8)
  })

  it('stops at an illegal move', () => {
    expect(lineMaterial(start, ['f3e5', 'a1a8'], 'w')).toBe(1)
  })
})

describe('forkTargets', () => {
  it('finds a knight fork of king and rook', () => {
    const fen = '4k3/8/8/8/8/8/2n4P/R3K3 w - - 0 1'
    expect(forkTargets(fen, 'c2').map((t) => t.type)).toEqual(['k', 'r'])
  })

  it('does not count defended pieces worth less than the attacker', () => {
    // White queen d4 attacks pawns b6 (defended by a7... here c7) and f6 (defended by g7): not targets.
    const fen = '4k3/2p3p1/1p3p2/8/3Q4/8/8/4K3 b - - 0 1'
    expect(forkTargets(fen, 'd4')).toEqual([])
  })
})

describe('firstCaptureBy', () => {
  it('finds the first capture of the given side in a line', () => {
    const fen = '4k3/8/8/8/3n4/8/7P/R3K3 b - - 0 1'
    const capture = firstCaptureBy(fen, ['d4c2', 'e1d2', 'c2a1'], 'b')
    expect(capture?.index).toBe(2)
    expect(capture?.move.captured).toBe('r')
  })
})

describe('notation helpers', () => {
  it('converts UCI to SAN and SAN to figurines', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(uciToSan(start, 'g1f3')).toBe('Nf3')
    expect(formatSan('Nxe5+')).toBe('♘xe5+')
    expect(formatSan('exd8=Q#')).toBe('exd8=♕#')
    expect(formatSan('O-O')).toBe('O-O')
  })

  it('joins Turkish lists', () => {
    expect(joinTurkish(['şahına'])).toBe('şahına')
    expect(joinTurkish(['şahına', 'kalene'])).toBe('şahına ve kalene')
    expect(joinTurkish(['şahına', 'vezirine', 'kalene'])).toBe('şahına, vezirine ve kalene')
  })
})
