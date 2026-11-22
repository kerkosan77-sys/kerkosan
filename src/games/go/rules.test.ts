import { describe, expect, it } from 'vitest'
import {
  PASS_MOVE,
  applyMove,
  areaScore,
  coordOf,
  decode,
  encode,
  estimateDead,
  finalScore,
  groupAt,
  indexOf,
  initialPosition,
  legalPoints,
  toggleDead,
  winnerOf,
} from './rules'

/** 9x9 board: black owns the left five columns, white the right four. */
const WALLS = Array(9).fill('....xo...').join('/')

describe('coordinates', () => {
  it('names points like a Go board (no letter I)', () => {
    expect(coordOf(0, 9)).toBe('A9')
    expect(coordOf(80, 9)).toBe('J1')
    expect(coordOf(indexOf('D4', 9)!, 9)).toBe('D4')
    expect(indexOf('I5', 9)).toBeNull()
    expect(indexOf('K1', 9)).toBeNull()
    expect(indexOf('a9', 9)).toBe(0)
  })
})

describe('positions', () => {
  it('round-trips through the text form', () => {
    const text = `o ${WALLS} - 1 7.5`
    expect(encode(decode(text))).toBe(text)
    expect(encode(initialPosition())).toBe(`x ${Array(9).fill('.........').join('/')} - 0 7.5`)
  })

  it('rejects broken positions', () => {
    expect(() => decode('x ..../... - 0')).toThrow()
  })
})

describe('moves', () => {
  it('captures a stone with no liberties left', () => {
    const position = decode('x ...../..x../.xo../..x../..... - 0 0.5')
    const result = applyMove(position, 'D3')!
    expect(result.captured).toEqual([indexOf('C3', 5)])
    expect(result.position.board[indexOf('C3', 5)!]).toBe(0)
    expect(result.position.turn).toBe('b')
  })

  it('forbids suicide but allows a move that captures', () => {
    const suicide = decode('o .x.../x..../...../...../..... - 0 0.5')
    expect(applyMove(suicide, 'A5')).toBeNull()
    expect(legalPoints(suicide)).not.toContain(indexOf('A5', 5))

    const capturing = decode('o .xo../xo.../o..../...../..... - 0 0.5')
    const result = applyMove(capturing, 'A5')!
    expect(result.captured.sort()).toEqual([indexOf('A4', 5), indexOf('B5', 5)].sort())
  })

  it('forbids taking back a ko at once', () => {
    const position = decode('x .xo../xo.o./.xo../...../..... - 0 0.5')
    const take = applyMove(position, 'C4')!
    expect(take.captured).toEqual([indexOf('B4', 5)])
    expect(applyMove(take.position, 'B4')).toBeNull()
    // After playing elsewhere the ko may be taken back.
    const away = applyMove(applyMove(take.position, 'E1')!.position, 'A1')!
    const back = applyMove(away.position, 'B4')!
    expect(back.captured).toEqual([indexOf('C4', 5)])
  })

  it('ends the game after two passes in a row', () => {
    const one = applyMove(initialPosition(), PASS_MOVE)!
    expect(one.over).toBe(false)
    const stone = applyMove(one.position, 'E5')!
    expect(stone.position.passes).toBe(0)
    const two = applyMove(applyMove(stone.position, PASS_MOVE)!.position, PASS_MOVE)!
    expect(two.over).toBe(true)
    expect(applyMove(two.position, 'D4')).toBeNull()
  })

  it('finds groups and their liberties', () => {
    const position = decode('x ...../.xx../..x../...../..... - 0 0.5')
    const group = groupAt(position.board, 5, indexOf('B4', 5)!)!
    expect(group.stones).toHaveLength(3)
    expect(group.liberties).toHaveLength(7)
  })
})

describe('counting', () => {
  it('counts stones and surrounded points (Chinese rules)', () => {
    const score = areaScore(decode(`x ${WALLS} - 2 7.5`), [])
    expect(score.black).toBe(45)
    expect(score.white).toBe(36)
    expect(score.margin).toBe(1.5)
    expect(winnerOf(score)).toBe('w')
  })

  it('gives the points of dead stones to the other side', () => {
    const rows = Array(9).fill('....xo...')
    rows[4] = '.o..xo.x.'
    const position = decode(`x ${rows.join('/')} - 2 7.5`)
    const asIs = areaScore(position, [])
    // Live as they stand, the lone stones spoil both areas.
    expect(asIs.black).toBeLessThan(45)
    const dead = [indexOf('B5', 9)!, indexOf('H5', 9)!]
    const counted = areaScore(position, dead)
    expect(counted.black).toBe(45)
    expect(counted.white).toBe(36)
  })

  it('estimates which stones are dead', () => {
    const rows = Array(9).fill('....xo...')
    rows[4] = '.o..xo.x.'
    const position = decode(`x ${rows.join('/')} - 2 7.5`)
    expect(estimateDead(position)).toEqual([indexOf('B5', 9)!, indexOf('H5', 9)!].sort((a, b) => a - b))
    expect(finalScore(position).margin).toBe(1.5)
    // The estimate is deterministic.
    expect(estimateDead(decode(encode(position)))).toEqual(estimateDead(position))
  })

  it('lets the user mark a group dead or alive again', () => {
    const rows = Array(9).fill('....xo...')
    rows[4] = '.oo.xo...'
    const position = decode(`x ${rows.join('/')} - 2 7.5`)
    const marked = toggleDead(position, [], indexOf('B5', 9)!)!
    expect(marked).toEqual([indexOf('B5', 9), indexOf('C5', 9)])
    expect(toggleDead(position, marked, indexOf('C5', 9)!)).toEqual([])
    expect(toggleDead(position, [], indexOf('A1', 9)!)).toBeNull()
  })
})
