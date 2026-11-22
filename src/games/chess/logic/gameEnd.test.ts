import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { detectGameEnd, pgnDate, resignation } from './gameEnd'

function play(...moves: string[]) {
  const game = new Chess()
  for (const move of moves) game.move(move)
  return game
}

describe('detectGameEnd', () => {
  it('returns null for an ongoing game', () => {
    expect(detectGameEnd(play('e4', 'e5'), 'w')).toBeNull()
  })

  it('reports a loss when the user is checkmated (fool\'s mate)', () => {
    const game = play('f3', 'e5', 'g4', 'Qh4#')
    expect(detectGameEnd(game, 'w')).toMatchObject({ result: '0-1', outcome: 'loss' })
    expect(detectGameEnd(game, 'b')).toMatchObject({ result: '0-1', outcome: 'win' })
  })

  it('reports stalemate as a draw', () => {
    const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(detectGameEnd(game, 'w')).toMatchObject({ result: '1/2-1/2', outcome: 'draw' })
  })

  it('reports insufficient material as a draw', () => {
    const game = new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1')
    expect(detectGameEnd(game, 'w')?.outcome).toBe('draw')
  })
})

describe('resignation', () => {
  it('gives the point to the opponent', () => {
    expect(resignation('w').result).toBe('0-1')
    expect(resignation('b').result).toBe('1-0')
  })
})

describe('pgn output', () => {
  it('formats the PGN date and writes the result header into the PGN', () => {
    expect(pgnDate(new Date(2026, 0, 5))).toBe('2026.01.05')
    const game = play('f3', 'e5', 'g4', 'Qh4#')
    game.setHeader('Result', '0-1')
    expect(game.pgn()).toContain('[Result "0-1"]')
    expect(game.pgn().trim().endsWith('0-1')).toBe(true)
  })
})
