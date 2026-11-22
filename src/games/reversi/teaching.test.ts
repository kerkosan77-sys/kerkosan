import { describe, expect, it } from 'vitest'
import type { ExplainInput, Score } from '../../core/types'
import { reversiCoachQuestions, reversiCoachWarning, reversiPuzzleHint } from './coach'
import { explainReversiMove } from './explain'
import { decode, encode, initialPosition } from './rules'

const board = (turn: 'x' | 'o', ...rows: string[]) => `${turn} ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')}`
const cp = (value: number): Score => ({ kind: 'cp', value })
const squares = (marks: { kind: string; square?: string }[], kind: string) =>
  marks
    .filter((m) => m.kind === kind)
    .map((m) => m.square)
    .sort()

function input(before: string, move: string, best: string[], reply: string[], extra: Partial<ExplainInput> = {}): ExplainInput {
  return { before, move, userSide: 'w', best: { pv: best, score: cp(0) }, reply: { pv: reply, score: cp(0) }, winBefore: 50, winAfter: 25, ...extra }
}

/** Black b2 (taking c2) lets white take a1 through b2-c3 up to d4; c1 is the safe way to take c2. */
const GIVE_CORNER = board('x', '........', '..ox....', '..x.....', '...o....')
/** Black can take a1 (closing b2 against c3). */
const FREE_CORNER = board('x', '........', '.o......', '..x.....', '...xo...', '...ox...')
/** Black b2 is legal (taking c3) and leaves a1 empty but not yet takeable. */
const X_SQUARE = board('x', '........', '........', '..o.....', '...xo...', '...o....')
/** f4 turns over four discs; c5 only one. */
const GREEDY = board('x', '........', '........', '........', 'xoooo...', '........', '..o.....', '..x.....')

describe('Reversi explanations', () => {
  it('explains a corner given away from the square next to it', () => {
    expect(explainReversiMove(input(GIVE_CORNER, 'b2', ['c1'], ['a1']))).toEqual({
      type: 'gave_corner',
      text: 'b2 köşenin çaprazındaki bir kare: buraya oynayınca rakip a1 köşesini alabiliyor. Köşedeki taş bir daha çevrilemez. Daha iyisi c1 (+1) idi.',
    })
  })

  it('points out a missed corner', () => {
    expect(explainReversiMove(input(FREE_CORNER, 'f4', ['a1'], ['f5']))).toEqual({
      type: 'missed_corner',
      text: 'Burada a1 köşesini alabilirdin. Köşedeki taşlar bir daha çevrilemez ve çevrelerini de güçlendirir.',
    })
  })

  it('warns about the diagonal square next to an empty corner', () => {
    const result = explainReversiMove(input(X_SQUARE, 'b2', ['f4'], ['e3']))
    expect(result.type).toBe('gave_corner')
    expect(result.text).toBe('b2 köşenin çaprazındaki kare: buraya oynamak çoğu zaman rakibe a1 köşesini açar. Daha iyisi f4 (+1) idi.')
  })

  it('explains flipping too many discs early', () => {
    const result = explainReversiMove(input(GREEDY, 'f4', ['c5'], []))
    expect(result.type).toBe('greedy')
    expect(result.text).toContain('Daha az taş çeviren c5 daha iyiydi.')
  })

  it('reports results counted to the end', () => {
    const lost = explainReversiMove({ ...input(GIVE_CORNER, 'b2', ['c1'], ['a1']), reply: { pv: ['a1'], score: { kind: 'mate', value: 5 } } })
    expect(lost.type).toBe('endgame')
    expect(lost.text).toContain('rakip en iyi oynarsa kesin kazanıyor')
    const missed = explainReversiMove({ ...input(FREE_CORNER, 'f4', ['a1'], ['f5']), best: { pv: ['a1'], score: { kind: 'mate', value: 7 } } })
    expect(missed).toEqual({ type: 'endgame', text: 'Burada a1 ile oyunu kesin kazanabilirdin (bilgisayar oyunun sonuna kadar hesapladı).' })
  })

  it('falls back to the better move', () => {
    const start = encode(initialPosition())
    expect(explainReversiMove(input(start, 'c4', ['d3'], ['c3'], { winBefore: 50, winAfter: 44 }))).toEqual({
      type: 'other',
      text: 'Bu hamleden sonra rakibin durumu güçlendi. Daha iyisi d3 (+1) idi.',
    })
  })
})

describe('Reversi puzzle hints and coach', () => {
  const puzzle = (position: string, bestMove: string, playedMove: string) => ({ position, bestMove, playedMove, errorType: 'other' })

  it('points at corners first, then the quarter of the board', () => {
    expect(squares(reversiPuzzleHint(puzzle(FREE_CORNER, 'a1', 'f4')).marks, 'hint')).toEqual(['a1', 'a8', 'h1', 'h8'])
    const given = reversiPuzzleHint(puzzle(GIVE_CORNER, 'c1', 'b2'))
    expect(given.text).toContain('kırmızı işaretli köşeyi')
    expect(squares(given.marks, 'danger')).toEqual(['a1'])
    const quarter = reversiPuzzleHint(puzzle(encode(initialPosition()), 'd3', 'c4'))
    expect(quarter.text).toBe('İpucu: Doğru hamle tahtanın sol üst çeyreğinde, işaretli karelerden biri.')
    expect(squares(quarter.marks, 'hint')).toEqual(['c4', 'd3'])
  })

  it('warns before giving a corner or playing next to an empty one', () => {
    expect(reversiCoachWarning(decode(GIVE_CORNER), 'b2')).toEqual({
      text: 'Bu hamleden sonra rakip a1 köşesini alabilir. Köşedeki taş bir daha çevrilemez.',
      marks: [{ kind: 'threat', square: 'a1' }],
    })
    expect(reversiCoachWarning(decode(GIVE_CORNER), 'c1')).toBeNull()
    expect(reversiCoachWarning(decode(X_SQUARE), 'b2')?.text).toBe('b2 köşenin çaprazındaki kare: buraya oynamak çoğu zaman rakibe a1 köşesini açar.')
    expect(reversiCoachWarning(initialPosition(), 'd3')).toBeNull()
  })

  it('asks about corners, options and the disc count', () => {
    expect(reversiCoachQuestions(decode(FREE_CORNER))[0]).toBe('Alabileceğin bir köşe var. Bulabilir misin?')
    const threatened = board('x', '........', '.xxx....', '..x.....', '...o....')
    expect(reversiCoachQuestions(decode(threatened))[0]).toContain('rakibin bir köşeyi alabilecek durumda')
    const start = reversiCoachQuestions(initialPosition())
    expect(start[0]).toContain('Köşelerin yanındaki karelere')
    expect(start[2]).toContain('Çok taş çevirmek')
    const late = board('x', 'xxxxxxxx', 'oooooooo', 'xxxxxxxx', 'oooooooo', 'xxxxxxxx', 'oooooooo', 'xxxx....', '........')
    expect(reversiCoachQuestions(decode(late))[2]).toContain('artık taş sayısı önemli')
  })
})
