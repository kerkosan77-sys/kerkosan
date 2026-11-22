import { describe, expect, it } from 'vitest'
import { analyzeGame } from './analyzeGame'
import { summarize } from './summary'
import type { MoveAnalysis } from './types'
import { buildPuzzles } from '../puzzles/fromAnalysis'
import type { EngineLine, GameEngine, GameModule, ReadGame, Score } from '../types'
import { chessModule } from '../../games/chess'
import type { GameRecord } from '../../db/types'

const cp = (value: number): Score => ({ kind: 'cp', value })
const mate = (value: number): Score => ({ kind: 'mate', value })
const line = (pv: string[], score: Score): EngineLine => ({ score, pv })

/** Engine stand-in that answers from a table keyed by the first two FEN fields (or the whole position). */
function fakeEngine(table: Record<string, EngineLine[]>) {
  const calls: { position: string; multiPV?: number }[] = []
  const engine: GameEngine = {
    start: async () => undefined,
    newGame: async () => undefined,
    chooseMove: async () => null,
    cancelAll: () => undefined,
    async analyze(position, options) {
      calls.push({ position, multiPV: options.multiPV })
      const key = position.includes(' ') ? position.split(' ').slice(0, 2).join(' ') : position
      const lines = table[key]
      if (!lines) throw new Error(`no fake eval for ${key}`)
      return lines
    },
  }
  return { engine, calls }
}

describe('analyzeGame with the chess module', () => {
  // 1.f3 e5 2.g4?? Qh4# — the user is white.
  const pgn = '1. f3 e5 2. g4 Qh4# 0-1'
  const table = {
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [line(['e2e4'], cp(30)), line(['d2d4'], cp(25)), line(['g1f3'], cp(20))],
    'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b': [line(['e7e5'], cp(20))],
    'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w': [line(['e2e4'], cp(-30)), line(['b1c3'], cp(-35)), line(['g2g4'], mate(-1))],
    'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b': [line(['d8h4'], mate(1))],
  }

  it("classifies both players' moves and explains the blunder", async () => {
    const { engine, calls } = fakeEngine(table)
    const progress: number[] = []
    const analysis = await analyzeGame(chessModule as GameModule, engine, pgn, 'w', {
      onProgress: (done) => progress.push(done),
    })

    // Every position except the final mate; the opponent's positions get two lines.
    expect(calls).toHaveLength(4)
    expect(calls[0].multiPV).toBe(3)
    expect(calls[1].multiPV).toBe(2)
    expect(progress).toEqual([0, 1, 2, 3, 4])

    const [f3, e5, g4, qh4] = analysis.moves
    expect(f3).toMatchObject({ classification: 'good', explanation: 'İyi hamle. Daha iyisi e4 idi.' })
    expect(e5).toMatchObject({ classification: 'best', explanation: 'En iyi hamle. Merkezi tutuyor.' })
    expect(qh4).toMatchObject({ classification: 'best', explanation: 'En iyi hamle. Mat! Oyunu bitiriyor.', winAfter: 0 })
    expect(qh4.label).toBe('♕h4#')

    expect(g4).toMatchObject({ classification: 'blunder', errorType: 'allowed_mate', bestLabel: 'e4', winAfter: 0 })
    expect(g4.explanation).toContain('tek hamlede mat oluyorsun')
    // e4 and Nc3 are both close to best; the played move is never a candidate.
    expect(g4.candidates?.map((c) => c.label)).toEqual(['e4', '♘c3'])

    expect(analysis.summary.counts).toMatchObject({ best: 0, good: 1, inaccuracy: 0, mistake: 0, blunder: 1 })
    expect(analysis.summary.opponentCounts).toMatchObject({ best: 2, blunder: 0 })
    expect(analysis.summary.topErrorType).toBe('allowed_mate')
  })

  it("gives zero drop when the user plays the engine's best move", async () => {
    const { engine } = fakeEngine({
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [line(['e2e4'], cp(30))],
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': [line(['c7c5'], cp(60))],
    })
    const analysis = await analyzeGame(chessModule as GameModule, engine, '1. e4 *', 'w')
    expect(analysis.moves[0]).toMatchObject({ classification: 'best', drop: 0, explanation: 'En iyi hamle. Merkezi tutuyor.' })
  })

  it("analyses from black's side and turns mistakes into puzzles", async () => {
    // 1.Nf3 e5?? 2.Nxe5 — the user is black.
    const { engine } = fakeEngine({
      'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b': [line(['d7d5'], cp(-20)), line(['g8f6'], cp(-25))],
      'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w': [line(['f3e5'], cp(200))],
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [line(['e2e4'], cp(30)), line(['g1f3'], cp(25))],
      'rnbqkbnr/pppp1ppp/8/4N3/8/8/PPPPPPPP/RNBQKB1R b': [line(['d8e7'], cp(-180))],
    })
    const record = '1. Nf3 e5 2. Nxe5 *'
    const analysis = await analyzeGame(chessModule as GameModule, engine, record, 'b')
    const e5 = analysis.moves[1]
    expect(e5.isUserMove).toBe(true)
    expect(e5.classification).toBe('mistake')
    // White's knight takes the pawn: the opponent's best move, described.
    expect(analysis.moves[2]).toMatchObject({ isUserMove: false, classification: 'best', explanation: 'En iyi hamle. Piyonu alıyor.' })

    const game: GameRecord = {
      id: 'g1',
      gameType: 'chess',
      createdAt: 0,
      source: 'pgn',
      record,
      userSide: 'b',
      names: { w: 'A', b: 'B' },
      result: '*',
      analysis,
    }
    const puzzles = buildPuzzles(game, 1000)
    expect(puzzles).toHaveLength(1)
    expect(puzzles[0]).toMatchObject({
      id: 'g1:1',
      gameType: 'chess',
      position: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      prevMove: 'g1f3',
      playedMove: 'e7e5',
      bestMove: 'd7d5',
      box: 1,
      dueAt: 1000,
      classification: 'mistake',
    })
    expect(puzzles[0].candidates.map((c) => c.move)).toEqual(['d7d5', 'g8f6'])
  })

  it("explains the opponent's error with the user's best reply", async () => {
    // 1.e4 Nf6?! 2.e5 — the user is white; after Nf6 the engine's best reply e5 attacks the knight.
    const { engine } = fakeEngine({
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w': [line(['e2e4'], cp(30)), line(['d2d4'], cp(25)), line(['g1f3'], cp(20))],
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b': [line(['c7c5'], cp(-30)), line(['e7e5'], cp(-35))],
      'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w': [line(['e4e5'], cp(300)), line(['b1c3'], cp(100)), line(['d2d3'], cp(60))],
      'rnbqkb1r/pppppppp/5n2/4P3/8/8/PPPP1PPP/RNBQKBNR b': [line(['f6d5'], cp(-300)), line(['f6g8'], cp(-350))],
    })
    const analysis = await analyzeGame(chessModule as GameModule, engine, '1. e4 Nf6 2. e5 *', 'w')
    const [e4, nf6, e5] = analysis.moves
    expect(e4.classification).toBe('best')
    expect(nf6).toMatchObject({ isUserMove: false, classification: 'blunder', replyMove: 'e4e5' })
    expect(nf6.explanation).toBe('Rakip büyük bir hata yaptı. Şimdi en iyi cevap e5: ata saldırıyor ve tehlikedeki piyonu kurtarıyor. Sen de bunu buldun!')
    // The user's chances go up after the opponent's error.
    expect(nf6.winAfter!).toBeGreaterThan(nf6.winBefore!)
    // e5 was far better than the next choice (Nc3): the only good move.
    expect(e5).toMatchObject({ classification: 'great', explanation: 'Harika! Tek iyi hamle buydu. Ata saldırıyor ve tehlikedeki piyonu kurtarıyor.' })
  })

  it('rejects a game without moves', async () => {
    const { engine } = fakeEngine({})
    await expect(analyzeGame(chessModule as GameModule, engine, '[Event "x"]\n\n*', 'w')).rejects.toThrow('hiç hamle yok')
  })
})

describe('analyzeGame for engines that compare after the best move', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b'
  const afterD4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b'
  const module = { ...chessModule, compareAfterBest: true, analysisRevision: 2 } as GameModule

  it('measures the drop against a search of the position after the best move', async () => {
    // The root number for d4 (+30) is optimistic; after d4 the opponent's search says +100 for white.
    const { engine, calls } = fakeEngine({
      [start]: [line(['d2d4'], cp(30))],
      [afterE4]: [line(['c7c5'], cp(150))],
      [afterD4]: [line(['d7d5'], cp(-100))],
    })
    const progress: [number, number][] = []
    const analysis = await analyzeGame(module, engine, '1. e4 *', 'w', { onProgress: (done, total) => progress.push([done, total]) })
    expect(calls.map((c) => c.position.split(' ').slice(0, 2).join(' '))).toEqual([start, afterD4, afterE4])
    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ])
    const e4 = analysis.moves[0]
    expect(e4.winBefore).toBe(Math.round((100 - chessModule.winPercent(cp(-100))) * 10) / 10)
    expect(e4.drop).toBeCloseTo(e4.winBefore! - e4.winAfter!, 0)
    expect(analysis.version).toBe(2006)
  })

  it('skips the extra search when the played move was searched next to the best one', async () => {
    const { engine, calls } = fakeEngine({
      [start]: [line(['d2d4'], cp(30)), line(['e2e4'], cp(-200))],
      [afterE4]: [line(['c7c5'], cp(150))],
    })
    const analysis = await analyzeGame(module, engine, '1. e4 *', 'w')
    expect(calls).toHaveLength(2)
    expect(analysis.moves[0].winAfter).toBe(Math.round(chessModule.winPercent(cp(-200)) * 10) / 10)
  })
})

describe('analyzeGame with extra turns (toy game)', () => {
  // The user ("w") moves twice in a row, then the opponent. Positions are plain names.
  const record: ReadGame = {
    moves: [
      { code: 'x', label: 'x', side: 'w', before: 'p0', after: 'p1' },
      { code: 'y', label: 'y', side: 'w', before: 'p1', after: 'p2' },
      { code: 'z', label: 'z', side: 'b', before: 'p2', after: 'p3' },
    ],
    terminal: [null, null, null, null],
  }
  const toy = {
    analysisDepth: 4,
    errorTypes: [{ id: 'other', label: 'Diğer' }],
    readGame: () => record,
    winPercent: (score: Score) => (score.kind === 'mate' ? (score.value > 0 ? 100 : 0) : 50 + score.value / 10),
    moveLabel: (_position: string, move: string) => move,
    explain: () => ({ text: 'açıklama', type: 'other' }),
  } as unknown as GameModule

  it('reads the position after an extra-turn move from the user\'s own point of view', async () => {
    const { engine } = fakeEngine({
      p0: [line(['a'], cp(0))],
      // Still the user's turn after "x": -300 here is bad for the user (not for the opponent).
      p1: [line(['b'], cp(-300))],
      p2: [line(['c'], cp(0))],
      p3: [line(['d'], cp(0))],
    })
    const analysis = await analyzeGame(toy, engine, 'toy', 'w')
    expect(analysis.moves[0]).toMatchObject({ winBefore: 50, winAfter: 20, classification: 'blunder' })
    // "y" is played from p1 (user to move) and leads to p2 (opponent to move, even).
    expect(analysis.moves[1]).toMatchObject({ winBefore: 20, winAfter: 50, classification: 'best' })
    expect(analysis.moves[2]).toMatchObject({ isUserMove: false, classification: 'best' })
  })
})

describe('summarize', () => {
  const move = (classification: MoveAnalysis['classification'], errorType?: string): MoveAnalysis => ({
    ply: 0,
    label: 'e4',
    code: 'e2e4',
    side: 'w',
    before: '',
    after: '',
    isUserMove: true,
    classification,
    errorType,
  })
  const priority = ['hung_piece', 'missed_capture', 'missed_mate', 'other']

  it('counts classes and finds the most common error type among mistakes and blunders', () => {
    const summary = summarize(
      [
        move('good'),
        move('inaccuracy', 'other'),
        move('mistake', 'missed_capture'),
        move('blunder', 'hung_piece'),
        move('blunder', 'hung_piece'),
        { ...move('blunder', 'missed_mate'), isUserMove: false },
      ],
      priority,
    )
    expect(summary.counts).toMatchObject({ best: 0, good: 1, inaccuracy: 1, mistake: 1, blunder: 2 })
    expect(summary.opponentCounts).toMatchObject({ blunder: 1 })
    expect(summary.userMoves).toBe(5)
    expect(summary.errorTypes).toEqual({ missed_capture: 1, hung_piece: 2 })
    expect(summary.topErrorType).toBe('hung_piece')
  })

  it('breaks ties in favour of the more basic habit, never "other"', () => {
    expect(summarize([move('mistake', 'other'), move('mistake', 'hung_piece')], priority).topErrorType).toBe('hung_piece')
    expect(summarize([move('mistake', 'other'), move('mistake', 'unknown_type')], priority).topErrorType).toBe('unknown_type')
  })

  it('has no top error type when there were no mistakes', () => {
    expect(summarize([move('good'), move('inaccuracy', 'other')], priority).topErrorType).toBeUndefined()
  })
})
