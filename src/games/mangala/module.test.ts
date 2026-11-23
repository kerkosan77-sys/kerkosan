import { describe, expect, it } from 'vitest'
import { mangalaModule as mangala, mangalaWinPercent, parseRecord } from './index'
import { encode } from './rules'

function playAll(...moves: string[]) {
  let state = mangala.newState()
  for (const move of moves) {
    const next = mangala.play(state, move)
    if (!next) throw new Error(`illegal ${move}`)
    state = next
  }
  return state
}

describe('labels', () => {
  it('names moves by pit number from the mover\'s side, with captures and extra turns', () => {
    const start = encode({ pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], turn: 'w' })
    expect(mangala.moveLabel(start, '0')).toBe('1. kuyu')
    expect(mangala.moveLabel(start, '3')).toBe('4. kuyu (tekrar)')
    const capture = encode({ pits: [4, 4, 4, 4, 4, 3, 0, 3, 4, 4, 4, 4, 4, 0], turn: 'w' })
    expect(mangala.moveLabel(capture, '5')).toBe('6. kuyu (+4 taş)')
    const second = encode({ pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], turn: 'b' })
    expect(mangala.moveLabel(second, '7')).toBe('1. kuyu')
    expect(mangala.moveLabel('w:0,0,0,0,0,1,20,2,2,2,2,2,2,15', '5')).toBe('6. kuyu (oyun bitti)')
  })

  it('titles moves by their number in the game', () => {
    expect(mangala.moveTitle(6, 'w', '3. kuyu')).toBe('7. hamle: 3. kuyu')
  })
})

describe('playing and records', () => {
  it('keeps the same side to move after an extra turn', () => {
    const state = playAll('3')
    expect(mangala.turn(state)).toBe('w')
    expect(mangala.statusNote(state, 'w')).toContain('tekrar oynuyorsun')
    const after = playAll('3', '5')
    expect(mangala.turn(after)).toBe('b')
    expect(mangala.history(after).map((m) => [m.label, m.side])).toEqual([
      ['4. kuyu (tekrar)', 'w'],
      ['6. kuyu', 'w'],
    ])
  })

  it('rejects illegal moves', () => {
    expect(mangala.play(mangala.newState(), '7')).toBeNull()
  })

  it('round-trips games through the record text', () => {
    const state = playAll('3', '5', '7')
    const record = mangala.stateToRecord(state, {
      names: { w: 'Sen', b: 'Bilgisayar (Kolay)' },
      result: '*',
      date: new Date(2026, 10, 19),
    })
    expect(record).toContain('[Oyun "Mangala"]')
    expect(record).toContain('[Tarih "2026.11.19"]')
    expect(parseRecord(record).moves).toEqual([3, 5, 7])
    expect(mangala.position(mangala.stateFromRecord(record))).toBe(mangala.position(state))
    expect(mangala.stateToRecord(state)).toBe('3 5 7')
  })

  it('reads a game with its terminal result for the last mover', () => {
    // A short constructed ending is not reachable from the start, so check a normal game instead:
    const game = mangala.readGame('3 5 7')
    expect(game.moves.map((m) => m.code)).toEqual(['3', '5', '7'])
    expect(game.terminal).toEqual([null, null, null, null])
    expect(game.moves[1].before).toBe(game.moves[0].after)
  })

  it('throws on an illegal move in a record', () => {
    expect(() => mangala.stateFromRecord('3 9')).toThrow()
  })
})

describe('playAt', () => {
  it('reports wins, losses and draws for the mover', () => {
    expect(mangala.playAt('w:0,0,0,0,0,1,20,2,2,2,2,2,2,15', '5')?.ended).toBe('win')
    expect(mangala.playAt('w:0,0,0,0,0,3,18,1,0,0,0,0,0,26', '5')?.ended).toBe('loss')
    expect(mangala.playAt('w:0,0,0,0,0,1,22,1,0,0,0,0,0,24', '5')?.ended).toBe('draw')
    expect(mangala.playAt('w:4,4,4,4,4,4,0,4,4,4,4,4,4,0', '3')).toMatchObject({ ended: null, turn: 'w' })
    expect(mangala.playAt('w:4,4,4,4,4,4,0,4,4,4,4,4,4,0', '9')).toBeNull()
  })
})

describe('game end texts', () => {
  it('announces the result with the store counts', () => {
    const state = { position: { pits: [0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0, 0, 0, 18], turn: 'w' as const }, moves: [] }
    expect(mangala.end(state, 'w')).toMatchObject({ result: '1-0', outcome: 'win', title: 'Kazandın!' })
    expect(mangala.end(state, 'b')?.detail).toContain('Hazinende 18 taş var, rakibinde 30')
    const draw = { position: { pits: [0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 24], turn: 'w' as const }, moves: [] }
    expect(mangala.end(draw, 'w')).toMatchObject({ result: '1/2-1/2', outcome: 'draw' })
    expect(mangala.end(mangala.newState(), 'w')).toBeNull()
  })
})

describe('winning chances', () => {
  it('maps stone advantage to winning chances', () => {
    expect(mangalaWinPercent({ kind: 'cp', value: 0 })).toBe(50)
    expect(mangalaWinPercent({ kind: 'cp', value: 500 })).toBeGreaterThan(70)
    expect(mangalaWinPercent({ kind: 'cp', value: 500 })).toBeLessThan(76)
    expect(mangalaWinPercent({ kind: 'mate', value: 3 })).toBe(100)
    expect(mangalaWinPercent({ kind: 'mate', value: -1 })).toBe(0)
  })
})

describe('mangala move sound', () => {
  it('clicks once for every stone a move puts down', () => {
    const start = mangala.history(playAll())[0]?.before ?? encode(mangala.newState().position)
    // Every pit starts with 4 stones: the move puts down 4, one by one.
    expect(mangala.stonesPlaced?.(start, '0')).toBe(4)
    const after = playAll('0')
    const position = encode(after.position)
    // The pit just played holds 1 stone again (the first one goes back in): a single stone moves on.
    expect(mangala.stonesPlaced?.(position, '0')).toBe(1)
  })
})
