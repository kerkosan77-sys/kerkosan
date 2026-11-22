import { describe, expect, it } from 'vitest'
import {
  applyMove,
  boardKey,
  decode,
  encode,
  initialPosition,
  legalMoves,
  moveCode,
  squareIndex,
  squareName,
  statusOf,
} from './rules'

/** Builds a position from rows given from the 8th rank down (missing rows are empty). */
function pos(turn: 'w' | 'b', rows: string[], quiet = 0) {
  const all = [...rows, ...Array(8 - rows.length).fill('........')]
  return decode(`${turn} ${all.join('/')} ${quiet}`)
}
const codes = (p: ReturnType<typeof pos>) => legalMoves(p).map(moveCode).sort()

describe('Dama board', () => {
  it('names squares from white’s side', () => {
    expect(squareName(squareIndex('a1')!)).toBe('a1')
    expect(squareIndex('a8')).toBe(0)
    expect(squareIndex('h1')).toBe(63)
    expect(squareIndex('z9')).toBeNull()
  })

  it('starts with 16 men each on the 2nd-3rd and 6th-7th ranks', () => {
    const start = initialPosition()
    expect(encode(start)).toBe('w ......../bbbbbbbb/bbbbbbbb/......../......../wwwwwwww/wwwwwwww/........ 0')
    expect(encode(decode(encode(start)))).toBe(encode(start))
    expect(() => decode('x ........ 0')).toThrow()
  })

  it('lets men move forward and sideways only', () => {
    // White man alone on d4.
    expect(codes(pos('w', ['........', '........', '........', '........', '...w....']))).toEqual(['d4-c4', 'd4-d5', 'd4-e4'])
    expect(codes(pos('b', ['........', '........', '........', '........', '...b....']))).toEqual(['d4-c4', 'd4-d3', 'd4-e4'])
    // The first moves of the game: only the third-rank men can move, forward.
    expect(legalMoves(initialPosition())).toHaveLength(8)
  })

  it('lets a dama slide along rows and columns', () => {
    const moves = codes(pos('w', ['........', '........', '........', '........', '...W....']))
    expect(moves).toHaveLength(14)
    expect(moves).toContain('d4-d8')
    expect(moves).toContain('d4-a4')
  })
})

describe('Dama captures', () => {
  it('makes capturing compulsory', () => {
    // White d4, black d5: the capture is the only legal move.
    expect(codes(pos('w', ['........', '........', '........', '...b....', '...w....']))).toEqual(['d4xd6'])
  })

  it('never captures backwards with a man', () => {
    expect(codes(pos('w', ['........', '........', '........', '........', '...w....', '...b....']))).not.toContain('d4xd2')
  })

  it('takes the most pieces and removes them at once', () => {
    // White d2 can take d3 then d5 (2 pieces) or c2 (1 piece): only the double capture is legal.
    const p = pos('w', ['........', '........', '........', '...b....', '........', '...b....', '..bw....'])
    expect(codes(p)).toEqual(['d2xd4xd6'])
    const result = applyMove(p, 'd2xd4xd6')!
    expect(result.move.captured.map(squareName)).toEqual(['d3', 'd5'])
    expect(encode(result.position)).toBe('b ......../......../...w..../......../......../......../..b...../........ 0')
  })

  it('lets a dama capture from a distance and land anywhere beyond', () => {
    // White dama a1, black piece a5: it may land on a6, a7 or a8.
    const p = pos('w', ['........', '........', '........', 'b.......', '........', '........', '........', 'W.......'])
    expect(codes(p)).toEqual(['a1xa6', 'a1xa7', 'a1xa8'])
  })

  it('does not let a dama turn back between captures', () => {
    // Dama on d4 takes d6 going up, landing on d7; it may not come back down over d2.
    const p = pos('w', ['........', '........', '...b....', '........', '...W....', '........', '...b....'])
    const moves = codes(p)
    expect(moves.every((m) => m.split('x').length === 2)).toBe(true)
  })

  it('promotes a man during a capture and goes on as a dama', () => {
    // White man c6 takes c7 landing on c8 (promotes), then as a dama takes f8 sideways from a distance.
    const p = pos('w', ['.....b..', '..b.....', '..w.....', '........', '........', '........', '........', 'b.......'])
    expect(codes(p)).toEqual(['c6xc8xg8', 'c6xc8xh8'])
    const result = applyMove(p, 'c6xc8xh8')!
    expect(result.move.promotes).toBe(true)
    expect(result.position.board[squareIndex('h8')!]).toBe(2)
  })
})

describe('Dama game end', () => {
  it('loses with no pieces or no moves', () => {
    expect(statusOf(pos('b', ['........', '........', '........', '...w....']))).toEqual({ winner: 'w', reason: 'no_pieces' })
    // Black man on a1 cannot go further down, and b1-c1 block it sideways (no room to jump).
    const blocked = pos('b', ['........', '........', '........', '........', '........', '........', '........', 'bww.....'])
    expect(statusOf(blocked)).toEqual({ winner: 'w', reason: 'no_moves' })
  })

  it('is drawn with one piece each or after 32 quiet dama moves', () => {
    expect(statusOf(pos('w', ['W.......', '........', '........', '.......b']))?.reason).toBe('one_each')
    const quiet = pos('w', ['W.......', 'W.......', '........', '.......b', '.......b'], 32)
    expect(statusOf(quiet)).toEqual({ winner: 'draw', reason: 'quiet' })
    expect(statusOf(initialPosition())).toBeNull()
  })

  it('counts dama moves without captures', () => {
    const p = pos('w', ['W.......', '........', '........', '.......b', '.......b'], 5)
    expect(applyMove(p, 'a8-a5')!.position.quiet).toBe(6)
    expect(boardKey(p)).toBe('w W......./......../......../.......b/.......b/......../......../........')
  })
})
