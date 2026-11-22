import { describe, expect, it } from 'vitest'
import { analyzeGame } from '../../core/analysis/analyzeGame'
import type { GameEngine, GameModule } from '../../core/types'
import { cornersFor } from './explain'
import { parseRecord, reversiModule, reversiWinPercent, type ReversiState } from './index'
import { applyMove, cornerNear, decode, encode, initialPosition, legalMoves, opponentOf, squareName } from './rules'
import { analyzeReversi } from './search'

function play(state: ReversiState, ...moves: string[]): ReversiState {
  return moves.reduce((s, move) => {
    const next = reversiModule.play(s, move)
    if (!next) throw new Error(`illegal ${move}`)
    return next
  }, state)
}

describe('Reversi module', () => {
  it('labels moves with the discs they turn over', () => {
    const state = play(reversiModule.newState(), 'd3', 'c5')
    expect(reversiModule.history(state).map((m) => m.label)).toEqual(['d3 (+1)', 'c5 (+1)'])
    expect(reversiModule.moveTitle(0, 'w', 'd3 (+1)')).toBe('1. hamle · Siyah d3 (+1)')
    expect(reversiModule.play(state, 'a1')).toBeNull()
    expect(reversiModule.sideColors).toEqual({ w: 'b', b: 'w' })
  })

  it('round-trips a record with its headers', () => {
    const state = play(reversiModule.newState(), 'f5', 'd6', 'c3')
    const record = reversiModule.stateToRecord(state, { names: { w: 'Sen', b: 'Bilgisayar' }, result: '*' })
    expect(record).toContain('[Siyah "Sen"]')
    expect(parseRecord(record).moves).toEqual(['f5', 'd6', 'c3'])
    expect(reversiModule.position(reversiModule.stateFromRecord(record))).toBe(reversiModule.position(state))
    expect(() => reversiModule.readGame('a1')).toThrow(/Geçersiz Reversi hamlesi/)
  })

  it('says when a player had to pass', () => {
    const position = decode(encode(initialPosition()))
    const record = (side: 'w' | 'b') => ({ code: 'd3', label: 'd3', side, before: '', after: '' })
    expect(reversiModule.statusNote({ position, moves: [record('w')] }, 'w')).toContain('tekrar sen oynuyorsun')
    expect(reversiModule.statusNote({ position, moves: [record('b'), record('b')] }, 'w')).toContain('rakip iki kez oynadı')
    expect(reversiModule.statusNote({ position, moves: [record('b')] }, 'w')).toBeNull()
  })

  it('counts a finished game', () => {
    const full = decode(`o ${Array(4).fill('xxxxxxxx').concat(Array(4).fill('oooooooo')).join('/')}`)
    full.board[63] = 1 // black 33, white 31
    const end = reversiModule.end({ position: full, moves: [] }, 'w')!
    expect(end).toMatchObject({ outcome: 'win', result: '1-0', detail: 'Senin taşların: 33 · Rakibinin: 31. 2 farkla kazandın. Tebrikler!' })
    expect(reversiModule.end({ position: full, moves: [] }, 'b')?.outcome).toBe('loss')
    expect(reversiModule.end(reversiModule.newState(), 'w')).toBeNull()
  })

  it('turns the evaluation into winning chances', () => {
    expect(reversiWinPercent({ kind: 'cp', value: 0 })).toBe(50)
    expect(reversiWinPercent({ kind: 'cp', value: 100 })).toBeCloseTo(62.2, 1)
    expect(reversiWinPercent({ kind: 'mate', value: 3 })).toBe(100)
  })
})

/** Seeded random generator so the test game is always the same. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

const engine: GameEngine = {
  start: async () => undefined,
  newGame: async () => undefined,
  chooseMove: async () => null,
  cancelAll: () => undefined,
  analyze: async (position, options) => analyzeReversi(position, { depth: options.depth ?? 7, multiPV: options.multiPV ?? 1 }),
}

describe('Reversi analysis with the real engine', () => {
  it('catches a move that hands over a corner', async () => {
    // Random moves until black can give a corner from the diagonal square next to it; black does.
    const random = rng(7)
    let position = initialPosition()
    const moves: string[] = []
    let found = false
    while (!found && legalMoves(position).length > 0 && moves.length < 60) {
      const legal = legalMoves(position)
      const giving =
        position.turn === 'w'
          ? legal.find((m) => {
              const near = cornerNear(m.square)
              const after = applyMove(position, squareName(m.square))!.position
              return near?.kind === 'x' && cornersFor(after, opponentOf('w')).includes(near.corner)
            })
          : undefined
      const move = giving ?? legal[Math.floor(random() * legal.length)]
      if (giving) found = true
      moves.push(squareName(move.square))
      position = applyMove(position, squareName(move.square))!.position
    }
    expect(found).toBe(true)

    const analysis = await analyzeGame(reversiModule as GameModule, engine, moves.join(' '), 'w', { depth: 5 })
    const last = analysis.moves[analysis.moves.length - 1]
    expect(last.isUserMove).toBe(true)
    expect(['inaccuracy', 'mistake', 'blunder']).toContain(last.classification)
    expect(last.errorType).toBe('gave_corner')
    expect(last.explanation).toMatch(/köşe/)
  }, 60000)
})
