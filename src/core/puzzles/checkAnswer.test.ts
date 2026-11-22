import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { bestWinOf, checkAnswer, engineEvaluator, isAcceptable, matchCandidate } from './checkAnswer'
import type { GameEngine, PlayedMove, Score } from '../types'
import { chessModule } from '../../games/chess'

// After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4: the user (white) played 4.Nxe5? here.
const position = (() => {
  const chess = new Chess()
  for (const move of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4']) chess.move(move)
  return chess.fen()
})()

const puzzle = {
  position,
  userSide: 'w' as const,
  playedMove: 'f3e5',
  bestMove: 'f3d4',
  candidates: [
    { move: 'f3d4', label: '♘xd4', win: 61 },
    { move: 'e1g1', label: 'O-O', win: 59.5 },
  ],
}

/** Evaluator that must not be called. */
const noEngine = async () => {
  throw new Error('engine should not be needed')
}

describe('matching and margins', () => {
  it('finds stored candidates case-insensitively', () => {
    expect(matchCandidate(puzzle, 'F3D4')?.label).toBe('♘xd4')
    expect(matchCandidate(puzzle, 'b1c3')).toBeNull()
  })

  it('accepts moves within 3 winning-chance points of the best', () => {
    expect(isAcceptable(61, 58)).toBe(true)
    expect(isAcceptable(61, 57.9)).toBe(false)
    expect(isAcceptable(99.6, 99.1)).toBe(true)
  })

  it('takes the best stored winning chance', () => {
    expect(bestWinOf(puzzle)).toBe(61)
  })
})

describe('checkAnswer (chess)', () => {
  it('accepts the best move without asking the engine', async () => {
    expect(await checkAnswer(chessModule, puzzle, 'f3d4', noEngine)).toEqual({ correct: true, isBest: true, label: '♘xd4' })
  })

  it('accepts a stored near-equal alternative', async () => {
    expect(await checkAnswer(chessModule, puzzle, 'e1g1', noEngine)).toEqual({ correct: true, isBest: false, label: 'O-O' })
  })

  it('rejects the original mistake without asking the engine', async () => {
    expect(await checkAnswer(chessModule, puzzle, 'f3e5', noEngine)).toEqual({ correct: false, label: '♘xe5' })
  })

  it('rejects illegal moves', async () => {
    expect(await checkAnswer(chessModule, puzzle, 'e1e3', noEngine)).toEqual({ correct: false, label: null })
  })

  it('asks the engine about other moves and accepts them if they are about as good', async () => {
    const seen: PlayedMove[] = []
    const verdict = await checkAnswer(chessModule, puzzle, 'd2d3', async (played, solver) => {
      seen.push(played)
      expect(solver).toBe('w')
      return 59
    })
    expect(verdict).toEqual({ correct: true, isBest: false, label: 'd3' })
    expect(seen[0].turn).toBe('b')
  })

  it('rejects other moves that are clearly worse', async () => {
    expect(await checkAnswer(chessModule, puzzle, 'a2a3', async () => 50)).toEqual({ correct: false, label: 'a3' })
  })

  it('always accepts a checkmate', async () => {
    const mateIn1 = {
      position: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
      userSide: 'w' as const,
      playedMove: 'h2h3',
      bestMove: 'g1f1',
      candidates: [{ move: 'g1f1', label: '♔f1', win: 99 }],
    }
    expect(await checkAnswer(chessModule, mateIn1, 'a1a8', noEngine)).toMatchObject({ correct: true, isBest: false })
  })
})

describe('checkAnswer with compareAfterBest', () => {
  const game = {
    compareAfterBest: true,
    playAt: (_position: string, move: string): PlayedMove => ({ position: move, label: move.toUpperCase(), turn: 'b', ended: null }),
  }
  const goPuzzle = {
    position: 'start',
    userSide: 'w' as const,
    playedMove: 'j1',
    bestMove: 'e5',
    // Root numbers from the analysis are higher than what a search after any move says.
    candidates: [{ move: 'e5', label: 'E5', win: 70 }],
  }
  const evaluate = async (played: PlayedMove) => ({ e5: 60, d5: 56, c3: 50 })[played.position] ?? 0

  it('compares the answer with a search after the best move', async () => {
    expect(await checkAnswer(game, goPuzzle, 'd5', evaluate)).toEqual({ correct: true, isBest: false, label: 'D5' })
    expect(await checkAnswer(game, goPuzzle, 'c3', evaluate)).toEqual({ correct: false, label: 'C3' })
  })
})

describe('engineEvaluator', () => {
  const fakeEngine = (score: Score): GameEngine => ({
    start: async () => undefined,
    newGame: async () => undefined,
    chooseMove: async () => null,
    cancelAll: () => undefined,
    analyze: async () => [{ score, pv: ['e7e5'] }],
  })
  const played = (turn: 'w' | 'b', ended: PlayedMove['ended'] = null): PlayedMove => ({ position: 'x', label: 'x', turn, ended })

  it("converts the opponent's score into the solver's winning chances", async () => {
    // The opponent (to move) is clearly worse: the solver is clearly better.
    const win = await engineEvaluator(chessModule, fakeEngine({ kind: 'cp', value: -300 }), 14)(played('b'), 'w')
    expect(win).toBeGreaterThan(70)
  })

  it('keeps the score as is when the solver is to move again (extra turns)', async () => {
    const win = await engineEvaluator(chessModule, fakeEngine({ kind: 'cp', value: -300 }), 14)(played('w'), 'w')
    expect(win).toBeLessThan(30)
  })

  it('returns 100 for a win and 50 for a draw without searching', async () => {
    const evaluate = engineEvaluator(chessModule, fakeEngine({ kind: 'cp', value: 0 }), 14)
    expect(await evaluate(played('b', 'win'), 'w')).toBe(100)
    expect(await evaluate(played('b', 'draw'), 'w')).toBe(50)
  })
})
