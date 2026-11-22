import { describe, expect, it } from 'vitest'
import { describeChessMove } from './chess/logic/describe'
import { describeDamaMove } from './dama/describe'
import { describeGoMove } from './go/describe'
import { applyMove as goApply, encode as goEncode, initialPosition as goStart } from './go/rules'
import { describeMangalaMove } from './mangala/describe'
import { describeReversiMove } from './reversi/describe'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const ITALIAN = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'
const text = (facts: { text: string | null } | null) => facts?.text ?? null

describe('chess move descriptions', () => {
  it('names captures, checks, castling, forks and mate', () => {
    expect(text(describeChessMove(START, 'e2e4'))).toBe('Merkezi tutuyor.')
    expect(text(describeChessMove(START, 'g1f3'))).toBe('Atı oyuna sokuyor.')
    expect(text(describeChessMove(START, 'a2a3'))).toBeNull()
    expect(text(describeChessMove(ITALIAN, 'e1g1'))).toBe('Rok yapıyor, şah güvenliğe giriyor.')
    expect(text(describeChessMove('2q3k1/8/8/3N4/8/8/8/4K3 w - - 0 1', 'd5e7'))).toBe('Şah çekiyor ve vezire de saldırıyor (çatal).')
    expect(text(describeChessMove('r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', 'b5a4'))).toBe(
      'Tehlikedeki fili kurtarıyor.',
    )
    expect(text(describeChessMove('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'h5f7'))).toBe(
      'Mat! Oyunu bitiriyor.',
    )
  })

  it('tells sacrifices and natural recaptures apart', () => {
    expect(describeChessMove(ITALIAN, 'c4f7')).toMatchObject({ text: 'Piyonu alıyor ve şah çekiyor.', sacrifice: true, obvious: false })
    expect(describeChessMove('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2', 'e4d5')).toMatchObject({
      text: 'Piyonu alıyor.',
      sacrifice: false,
      obvious: true,
    })
    expect(describeChessMove(START, 'z9z9')).toBeNull()
  })
})

describe('Mangala move descriptions', () => {
  const at = (turn: 'w' | 'b', pits: number[]) => `${turn}:${pits.join(',')}`
  const start = at('w', [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0])

  it('names extra turns, captures and stones put in the store', () => {
    expect(text(describeMangalaMove(start, '3'))).toBe('Son taş hazineye düşüyor, bir daha oynuyor.')
    expect(text(describeMangalaMove(start, '4'))).toBe('Hazinesine 1 taş koyuyor.')
    expect(text(describeMangalaMove(start, '0'))).toBeNull()
    // Three stones from the last pit: the last one makes the opponent's 3 into 4.
    expect(text(describeMangalaMove(at('w', [4, 4, 4, 4, 4, 3, 0, 3, 4, 4, 4, 4, 4, 0]), '5'))).toBe('Çift kuralıyla karşıdaki 4 taşı alıyor.')
  })

  it('knows when there was only one move', () => {
    expect(describeMangalaMove(at('w', [0, 0, 0, 0, 0, 2, 20, 4, 4, 4, 4, 4, 4, 2]), '5')?.forced).toBe(true)
    expect(describeMangalaMove(start, '4')?.forced).toBe(false)
  })
})

describe('Go move descriptions', () => {
  // Black E5 is surrounded on three sides by white; black's other stones are far away.
  const play = (...moves: string[]) => moves.reduce((p, m) => goApply(p, m)!.position, goStart())
  const atari = play('E5', 'E4', 'A1', 'D5', 'A3')

  it('names atari, saving stones and captures', () => {
    expect(text(describeGoMove(goEncode(atari), 'F5'))).toBe('Atari yapıyor: karşıdaki taş bir hamle sonra alınabilir.')
    const inAtari = play('E5', 'E4', 'A1', 'D5', 'A3', 'F5')
    expect(text(describeGoMove(goEncode(inAtari), 'E6'))).toBe('Atarideki taşlarını kurtarıyor.')
    const capture = play('E5', 'E4', 'A1', 'D5', 'A3', 'F5', 'A5')
    expect(text(describeGoMove(goEncode(capture), 'E6'))).toBe('1 taş alıyor.')
    expect(text(describeGoMove(goEncode(goStart()), 'pass'))).toBe('Pas geçiyor.')
  })
})

describe('Dama move descriptions', () => {
  const pos = (turn: 'w' | 'b', rows: string[]) => `${turn} ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')} 0`

  it('names captures, promotion and a man close to the last row', () => {
    const promote = pos('w', ['.....b..', '..b.....', '..w.....', '........', '........', '........', '........', 'b.......'])
    expect(describeDamaMove(promote, 'c6xc8xh8')).toMatchObject({ text: '2 taş alıyor ve dama oluyor.', forced: false })
    const single = pos('w', ['.......b', '........', '........', '...b....', '...w....'])
    expect(describeDamaMove(single, 'd4xd6')).toMatchObject({ text: '1 taş alıyor.', forced: true })
    const near = pos('w', ['.......b', '........', '........', '..w.....'])
    expect(text(describeDamaMove(near, 'c5-c6'))).toBe('Dama olmaya yaklaşıyor.')
  })
})

describe('Reversi move descriptions', () => {
  const board = (turn: 'x' | 'o', ...rows: string[]) => `${turn} ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')}`

  it('names corners and discs turned over', () => {
    const corner = board('x', '........', '.o......', '..x.....', '...xo...', '...ox...')
    expect(text(describeReversiMove(corner, 'a1'))).toBe('Köşeyi alıyor, bu taş bir daha çevrilemez. 1 taş çeviriyor.')
    const start = board('x', '........', '........', '........', '...ox...', '...xo...')
    expect(describeReversiMove(start, 'd3')).toMatchObject({ text: '1 taş çeviriyor.', forced: false })
  })
})
