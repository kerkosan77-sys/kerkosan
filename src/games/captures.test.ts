import { describe, expect, it } from 'vitest'
import { chessModule } from './chess'
import { damaModule } from './dama'
import { goModule } from './go'
import { mangalaModule } from './mangala'
import { reversiModule } from './reversi'
import type { GameModule } from '../core/types'

function playAll<S>(game: GameModule<S>, moves: string[]): S {
  return moves.reduce((state, move) => {
    const next = game.play(state, move)
    if (!next) throw new Error(`illegal ${move}`)
    return next
  }, game.newState())
}

const summary = (info: { pieces: { name: string; count: number }[]; lead: number }) => ({
  taken: info.pieces.map((p) => `${p.count} ${p.name}`).join(', '),
  lead: info.lead,
})

describe('taken pieces', () => {
  it('chess: nothing at the start, then the taken pieces and the material lead', () => {
    const start = chessModule.newState()
    const none = chessModule.captures!(chessModule.position(start), [])
    expect(summary(none.w)).toEqual({ taken: '', lead: 0 })
    expect(summary(none.b)).toEqual({ taken: '', lead: 0 })

    // 1. e4 d5 2. exd5 Qxd5 3. Nc3 Qxg2 4. Nb5 Qxh1
    const state = playAll(chessModule, ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5g2', 'c3b5', 'g2h1'])
    const taken = chessModule.captures!(chessModule.position(state), chessModule.history(state))
    expect(summary(taken.w)).toEqual({ taken: '1 piyon', lead: 0 })
    expect(summary(taken.b)).toEqual({ taken: '2 piyon, 1 kale', lead: 6 })
    // The pieces taken by white are black ones.
    expect(taken.w.color).toBe('b')
    expect(taken.b.color).toBe('w')
  })

  it('chess: a promoted pawn was not taken', () => {
    // White has a second queen and seven pawns; black lost its h-pawn.
    const taken = chessModule.captures!('rnbqkbnr/ppppppp1/8/8/8/Q7/PPPPPPP1/RNBQKBNR w KQkq - 0 1', [])
    expect(summary(taken.w)).toEqual({ taken: '1 piyon', lead: 9 })
    expect(summary(taken.b)).toEqual({ taken: '', lead: 0 })
  })

  it('Go: counts the stones each player took', () => {
    // Black (the first player) takes the white stone in the corner: B1 (+1 taş).
    const state = playAll(goModule, ['A2', 'A1', 'B1', 'pass'])
    const taken = goModule.captures!(goModule.position(state), goModule.history(state))
    expect(taken.w.pieces).toEqual([{ glyph: '●', name: 'taş', count: 1 }])
    expect(taken.w.color).toBe('w') // white stones
    expect(taken.b.pieces).toEqual([])
    expect(taken.w.lead).toBe(0)
  })

  it('Dama: counts the pieces taken and who has more left', () => {
    const state = damaModule.newState()
    const position = damaModule.position(state)
    expect(summary(damaModule.captures!(position, []).w)).toEqual({ taken: '', lead: 0 })
    // White has taken three black men.
    const rows = position.split(' ')[1].split('/')
    rows[1] = '...bbbbb'
    const after = `w ${rows.join('/')} 0`
    const taken = damaModule.captures!(after, [])
    expect(summary(taken.w)).toEqual({ taken: '3 taş', lead: 3 })
    expect(summary(taken.b)).toEqual({ taken: '', lead: 0 })
  })

  it('Mangala and Reversi show no taken pieces', () => {
    expect(mangalaModule.captures).toBeUndefined()
    expect(reversiModule.captures).toBeUndefined()
  })
})
