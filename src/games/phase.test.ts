import { describe, expect, it } from 'vitest'
import { chessPhase } from './chess/logic/describe'
import { damaPhase } from './dama/describe'
import { encode as damaEncode, initialPosition as damaStart } from './dama/rules'
import { goPhase } from './go/describe'
import { encode as goEncode, initialPosition as goStart } from './go/rules'
import { mangalaPhase } from './mangala/describe'
import { reversiPhase } from './reversi/describe'
import { encode as reversiEncode, initialPosition as reversiStart } from './reversi/rules'

describe('game phases for puzzle sections', () => {
  it('chess: opening, middlegame, endgame', () => {
    expect(chessPhase('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe('opening')
    expect(chessPhase('r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 14')).toBe('middlegame')
    expect(chessPhase('8/5pk1/6p1/8/3R4/6P1/r4PK1/8 w - - 0 40')).toBe('endgame')
  })

  it('mangala: full pits early, few stones late', () => {
    expect(mangalaPhase('w:4,4,4,4,4,4,0,4,4,4,4,4,4,0', 0)).toBe('opening')
    expect(mangalaPhase('w:2,3,4,4,4,5,6,1,3,4,4,2,1,5', 14)).toBe('middlegame')
    expect(mangalaPhase('w:0,1,2,0,0,3,20,1,0,2,0,1,0,18', 40)).toBe('endgame')
  })

  it('go, dama and reversi start in the opening', () => {
    expect(goPhase(goEncode(goStart()))).toBe('opening')
    expect(damaPhase(damaEncode(damaStart()))).toBe('opening')
    expect(reversiPhase(reversiEncode(reversiStart()))).toBe('opening')
  })

  it('dama and reversi endgames', () => {
    const rows = (...r: string[]) => [...r, ...Array(8 - r.length).fill('........')].join('/')
    expect(damaPhase(`w ${rows('.......b', '........', '..b.....', '...w....', '....w...')} 0`)).toBe('endgame')
    const nearlyFull = Array(7).fill('xxxxoooo').concat('xo......').join('/')
    expect(reversiPhase(`x ${nearlyFull}`)).toBe('endgame')
  })
})
