import { describe, expect, it } from 'vitest'
import { damaModule, damaWinPercent, parseRecord, type DamaState } from './index'
import { decode, encode } from './rules'

const position = (turn: 'w' | 'b', rows: string[]) =>
  decode(`${turn} ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')} 0`)

function play(state: DamaState, ...moves: string[]): DamaState {
  return moves.reduce((s, move) => {
    const next = damaModule.play(s, move)
    if (!next) throw new Error(`illegal ${move}`)
    return next
  }, state)
}

describe('Dama module', () => {
  it('labels moves and refuses illegal ones', () => {
    const state = play(damaModule.newState(), 'c3-c4', 'f6-f5')
    expect(damaModule.history(state).map((m) => m.label)).toEqual(['c3-c4', 'f6-f5'])
    expect(damaModule.turn(state)).toBe('w')
    expect(damaModule.play(state, 'c4-c3')).toBeNull()
    expect(damaModule.moveTitle(0, 'w', 'c3-c4')).toBe('1. hamle · Beyaz c3-c4')
  })

  it('round-trips a game record with its headers', () => {
    const state = play(damaModule.newState(), 'c3-c4', 'f6-f5', 'a3-a4')
    const record = damaModule.stateToRecord(state, { names: { w: 'Sen', b: 'Bilgisayar' }, result: '*' })
    expect(record).toContain('[Beyaz "Sen"]')
    expect(parseRecord(record).moves).toEqual(['c3-c4', 'f6-f5', 'a3-a4'])
    const again = damaModule.stateFromRecord(record)
    expect(damaModule.position(again)).toBe(damaModule.position(state))
    expect(() => damaModule.readGame('c3-c5')).toThrow(/Geçersiz Dama hamlesi/)
  })

  it('says when a capture is compulsory', () => {
    const state: DamaState = { position: position('w', ['........', '........', '........', '...b....', '...w....']), moves: [] }
    expect(damaModule.statusNote(state, 'w')).toContain('Alma zorunlu')
    expect(damaModule.statusNote(state, 'b')).toBeNull()
  })

  it('ends the game when the last piece is taken', () => {
    const before = encode(position('w', ['........', '........', '........', '...b....', '...w....', '.......w']))
    expect(damaModule.playAt(before, 'd4xd6')).toMatchObject({ label: 'd4×d6', ended: 'win' })
    const won: DamaState = { position: decode(damaModule.playAt(before, 'd4xd6')!.position), moves: [] }
    expect(damaModule.end(won, 'w')).toMatchObject({ outcome: 'win', result: '1-0' })
    expect(damaModule.end(won, 'b')).toMatchObject({ outcome: 'loss', detail: expect.stringContaining('Bütün taşların alındı') })
  })

  it('draws on a threefold repetition', () => {
    const a = position('w', ['W.......', '........', '........', '........', '.......b', '.......b'])
    const b = decode(encode({ ...a, turn: 'b' }))
    const move = (from: typeof a, to: typeof a) => ({ code: 'x', label: 'x', side: from.turn, before: encode(from), after: encode(to) })
    const moves = [move(a, b), move(b, a), move(a, b), move(b, a), move(a, b), move(b, a)]
    const end = damaModule.end({ position: a, moves }, 'w')
    expect(end).toMatchObject({ outcome: 'draw', detail: 'Aynı pozisyon üç kez tekrarlandı: oyun berabere.' })
  })

  it('turns material into winning chances', () => {
    expect(damaWinPercent({ kind: 'cp', value: 0 })).toBe(50)
    expect(damaWinPercent({ kind: 'cp', value: 100 })).toBeCloseTo(64.6, 1)
    expect(damaWinPercent({ kind: 'cp', value: 300 })).toBeCloseTo(85.8, 1)
    expect(damaWinPercent({ kind: 'mate', value: -2 })).toBe(0)
  })
})
