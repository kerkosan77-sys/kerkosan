import { describe, expect, it } from 'vitest'
import { indexOf } from './rules'
import { parseSgf, writeSgf } from './sgf'

describe('reading SGF', () => {
  it('reads the main line and skips other variations', () => {
    const game = parseSgf('(;GM[1]FF[4]SZ[9]KM[6.5]PB[Ali]PW[Ayşe];B[ee](;W[cc];B[gg])(;W[dd]))')
    expect(game.size).toBe(9)
    expect(game.komi).toBe(6.5)
    expect(game.info.PB).toBe('Ali')
    expect(game.info.PW).toBe('Ayşe')
    expect(game.moves).toEqual([
      { side: 'w', move: 'E5' },
      { side: 'b', move: 'C7' },
      { side: 'w', move: 'G3' },
    ])
  })

  it('understands passes, escaped text and compressed point lists', () => {
    const game = parseSgf('(;GM[1]SZ[9]C[iki \\] köşeli]AB[aa:bb]AW[ii];W[];B[tt];W[ee]DD[ee][aa])')
    expect(game.setup.black).toHaveLength(4)
    expect(game.setup.white).toEqual([indexOf('J1', 9)])
    expect(game.info.C).toBe('iki ] köşeli')
    expect(game.moves.map((m) => m.move)).toEqual(['pass', 'pass', 'E5'])
    expect(game.dead).toEqual([indexOf('E5', 9), indexOf('A9', 9)])
  })

  it('rejects files that are not Go games', () => {
    expect(() => parseSgf('merhaba')).toThrow()
    expect(() => parseSgf('(;GM[2]SZ[8];B[aa])')).toThrow(/Go oyunu değil/)
  })
})

describe('writing SGF', () => {
  it('writes a file that reads back the same', () => {
    const text = writeSgf({
      size: 9,
      komi: 7.5,
      info: { PB: 'Sen', PW: 'Bilgisayar [Orta]', RE: 'B+3.5' },
      moves: [
        { side: 'w', move: 'D4' },
        { side: 'b', move: 'E5' },
        { side: 'w', move: 'pass' },
        { side: 'b', move: 'pass' },
      ],
      dead: [indexOf('E5', 9)!],
    })
    expect(text).toContain(';B[df];W[ee];B[];W[]DD[ee]')
    const game = parseSgf(text)
    expect(game.info.PW).toBe('Bilgisayar [Orta]')
    expect(game.info.RE).toBe('B+3.5')
    expect(game.komi).toBe(7.5)
    expect(game.moves.map((m) => m.move)).toEqual(['D4', 'E5', 'pass', 'pass'])
    expect(game.dead).toEqual([indexOf('E5', 9)])
  })
})
