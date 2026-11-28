import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { chessModule, type ChessState } from './index'

const playAll = (state: ChessState, moves: string[]): ChessState =>
  moves.reduce((current, move) => {
    const next = chessModule.play(current, move)
    if (!next) throw new Error(`illegal move ${move}`)
    return next
  }, state)

/** The same game replayed by chess.js alone, for comparing. */
function replayed(moves: string[]): Chess {
  const chess = new Chess()
  for (const move of moves) chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
  return chess
}

// Castling on both sides, captures, checks, and a pawn promoted to a queen that is taken at once.
const GAME = [
  'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1', 'd7d5', 'e4d5', 'f6d5', 'd2d4', 'e5d4',
  'f3d4', 'c6d4', 'd1d4', 'c8e6', 'c4d5', 'd8d5', 'd4d5', 'e6d5', 'b1c3', 'e8c8', 'c3d5', 'd8d5',
  'c1f4', 'f8d6', 'f4d6', 'd5d6', 'a1d1', 'd6d1', 'f1d1', 'h8e8', 'h2h4', 'e8e2', 'h4h5', 'e2c2',
  'h5h6', 'g7h6', 'g2g4', 'c2b2', 'g4g5', 'h6g5', 'd1d7', 'b2a2', 'd7f7', 'g5g4', 'f7h7', 'g4g3',
  'h7h8', 'c8d7', 'h8h1', 'g3f2', 'g1g2', 'f2f1q', 'g2f1', 'a2a3', 'h1h7', 'd7e6', 'h7c7', 'a7a5',
  'c7b7', 'a5a4', 'b7b6', 'e6d5', 'f1e2', 'a3a2', 'e2d3', 'a4a3',
]

describe('chess game states', () => {
  it('keep the position, history and rules of the game replayed by chess.js', () => {
    let state = chessModule.newState({})
    for (let i = 0; i < GAME.length; i++) {
      state = playAll(state, [GAME[i]])
      const reference = replayed(GAME.slice(0, i + 1))
      expect(chessModule.position(state)).toBe(reference.fen())
      expect(state.game.moves().sort()).toEqual(reference.moves().sort())
      expect(state.game.inCheck()).toBe(reference.inCheck())
    }
    expect(chessModule.history(state).map((m) => m.code)).toEqual(GAME)
    expect(state.game.history()).toEqual(replayed(GAME).history())
  })

  it('stay unchanged when later states are played on, read back or replayed by chess.js', () => {
    // White may castle here; in the later states both kings have castled and a pawn was promoted.
    const early = playAll(chessModule.newState({}), GAME.slice(0, 6))
    const fen = chessModule.position(early)
    const moves = early.game.moves().sort()
    expect(moves).toContain('O-O')
    const later = playAll(early, GAME.slice(6))
    // pgn() and history() take every move back and play it again inside chess.js.
    later.game.pgn()
    later.game.history({ verbose: true })
    playAll(early, ['e1g1', 'a7a6'])
    early.game.pgn()
    expect(chessModule.position(early)).toBe(fen)
    expect(early.game.moves().sort()).toEqual(moves)
    expect(early.game.pgn()).toBe(replayed(GAME.slice(0, 6)).pgn())
    expect(chessModule.position(later)).toBe(replayed(GAME).fen())
    expect(later.game.pgn()).toBe(replayed(GAME).pgn())
  })

  it('count repeated positions for the draw', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8']
    const state = playAll(chessModule.newState({}), [...shuffle, ...shuffle])
    expect(state.game.isThreefoldRepetition()).toBe(true)
    expect(chessModule.end(state, 'w')?.outcome).toBe('draw')
  })

  it('save and load the game', () => {
    const state = playAll(chessModule.newState({}), GAME)
    const loaded = chessModule.stateFromRecord(chessModule.stateToRecord(state))
    expect(chessModule.position(loaded)).toBe(chessModule.position(state))
    expect(chessModule.history(loaded).map((m) => m.code)).toEqual(GAME)
  })
})
