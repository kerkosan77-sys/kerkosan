import { describe, expect, it } from 'vitest'
import { guessUserColor, parsePgn, PgnError } from './pgn'
import { outcomeFor } from '../../../core/records'

const chessComPgn = `[Event "Live Chess"]
[Site "Chess.com"]
[White "kullanici700"]
[Black "Rakip"]
[Result "1-0"]

1. e4 {[%clk 0:09:58.1]} 1... e5 {[%clk 0:09:57.2]} 2. Qh5 {[%clk 0:09:50]} 2... Nc6 3. Bc4 Nf6 4. Qxf7# 1-0`

describe('parsePgn', () => {
  it('reads a Chess.com PGN with clock comments', () => {
    expect(parsePgn(chessComPgn)).toMatchObject({ white: 'kullanici700', black: 'Rakip', result: '1-0', moveCount: 7 })
  })

  it('keeps only the first of several pasted games', () => {
    const parsed = parsePgn(`${chessComPgn}\n\n[Event "Second"]\n[White "x"]\n[Black "y"]\n\n1. d4 d5 *`)
    expect(parsed.white).toBe('kullanici700')
  })

  it('rejects text that is not a PGN, with a Turkish message', () => {
    expect(() => parsePgn('merhaba dünya')).toThrow(PgnError)
    expect(() => parsePgn('   ')).toThrow('Önce bir PGN yapıştır.')
  })
})

describe('guessUserColor', () => {
  it('guesses the user color from known names, case-insensitively', () => {
    expect(guessUserColor('Kullanici700', 'Rakip', ['kullanici700'])).toBe('w')
    expect(guessUserColor('Rakip', 'Sen', ['', 'Sen'])).toBe('b')
    expect(guessUserColor('A', 'B', ['kullanici700'])).toBeNull()
  })
})

describe('outcomeFor', () => {
  it("maps results to the user's outcome", () => {
    expect(outcomeFor('1-0', 'w')).toBe('win')
    expect(outcomeFor('1-0', 'b')).toBe('loss')
    expect(outcomeFor('1/2-1/2', 'b')).toBe('draw')
    expect(outcomeFor('*', 'w')).toBe('unknown')
  })
})
