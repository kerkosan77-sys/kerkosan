import { describe, expect, it } from 'vitest'
import type { ExplainInput, Score } from '../../core/types'
import { damaCoachQuestions, damaCoachWarning } from './coach'
import { explainDamaMove } from './explain'
import { damaPuzzleHint } from './hints'
import { decode, encode } from './rules'

const text = (turn: 'w' | 'b', rows: string[]) => encode(decode(`${turn} ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')} 0`))
const cp = (value: number): Score => ({ kind: 'cp', value })
const squares = (marks: { kind: string; square?: string }[], kind: string) =>
  marks
    .filter((m) => m.kind === kind)
    .map((m) => m.square)
    .sort()

function input(before: string, move: string, best: string[], reply: string[], extra: Partial<ExplainInput> = {}): ExplainInput {
  return {
    before,
    move,
    userSide: decode(before).turn,
    best: { pv: best, score: cp(0) },
    reply: { pv: reply, score: cp(0) },
    winBefore: 50,
    winAfter: 25,
    ...extra,
  }
}

/** White d3 next to black e4: d3-d4 lets e4 take sideways (e4xc4). */
const HANGING = text('w', ['........', '........', '........', '........', '....b...', '...w....', '........', '.......w'])
/** White to move can give d3 (d3-d4): d5xd3 is forced, then c3xe3xg3 takes both black men. */
const COMBINATION = text('w', ['........', '........', '........', '...b....', '........', '.www.b..'])
/** Black to move: f4-f3 walks into that combination. */
const TRAP = text('b', ['........', '........', '........', '...b....', '.....b..', '.www....'])
/** Black c2 is one step from a dama; white c1 blocks it (and d1 would keep a new dama safe). */
const PROMOTION_GUARD = text('w', ['........', '........', '........', '........', '........', '..b.....', '..b.....', '..ww...w'])
/** White d7 can become a dama. */
const NEAR_DAMA = text('w', ['........', '...w....', '........', '.......b', '........', '........', 'w.......'])
/** White d3 under black d4 (backed by d5): black could take it if it were black's turn. */
const THREATENED = text('w', ['........', '........', '........', '...b....', '...b....', '...w....', '........', '.......w'])

describe('Dama explanations', () => {
  it('names the capture a move allows', () => {
    expect(explainDamaMove(input(HANGING, 'd3-d4', ['d3-c3'], ['e4xc4']))).toEqual({
      type: 'allowed_capture',
      text: 'Bu hamleden sonra rakip e4×c4 ile 1 taşını alabiliyor. Daha iyisi d3-c3 idi.',
    })
  })

  it('explains the compulsory-capture trap', () => {
    const result = explainDamaMove(input(TRAP, 'f4-f3', ['f4-g4'], ['d3-d4', 'd5xd3', 'c3xe3xg3']))
    expect(result.type).toBe('allowed_trap')
    expect(result.text).toBe(
      'Bu hamleden sonra rakip d3-d4 ile bir taş veriyor: alma zorunlu olduğu için almak zorundasın, ardından rakip c3×e3×g3 ile 2 taşını alıyor. Daha iyisi f4-g4 idi.',
    )
  })

  it('points out a missed combination', () => {
    const result = explainDamaMove(input(COMBINATION, 'b3-b4', ['d3-d4', 'd5xd3', 'c3xe3xg3'], ['f3-f2']))
    expect(result).toEqual({
      type: 'missed_combination',
      text: 'Burada d3-d4 ile bir taş verip rakibi almaya zorlayabilirdin; ardından c3×e3×g3 ile 2 taş alırdın.',
    })
  })

  it('notices damas allowed and missed', () => {
    expect(explainDamaMove(input(PROMOTION_GUARD, 'c1-b1', ['h1-h2'], ['c2-c1', 'h1-h2', 'c1xa1']))).toEqual({
      type: 'allowed_promotion',
      text: 'Bu hamleden sonra rakip c2-c1 ile taşını son sıraya çıkarıp dama yapabiliyor. Daha iyisi h1-h2 idi.',
    })
    expect(explainDamaMove(input(NEAR_DAMA, 'a2-a3', ['d7-d8'], ['h5-h4']))).toEqual({
      type: 'missed_promotion',
      text: 'Burada d7-d8 ile dama yapabilirdin.',
    })
  })

  it('reports forced results first', () => {
    const lost = explainDamaMove({ ...input(HANGING, 'd3-d4', ['d3-c3'], ['e4xc4']), reply: { pv: ['e4xc4'], score: { kind: 'mate', value: 3 } } })
    expect(lost).toEqual({ type: 'endgame', text: 'Bu hamleden sonra rakip oyunu zorla kazanabiliyor. Daha iyisi d3-c3 idi.' })
    const missed = explainDamaMove({ ...input(COMBINATION, 'b3-b4', ['d3-d4', 'd5xd3', 'c3xe3xg3'], ['f3-f2']), best: { pv: ['d3-d4'], score: { kind: 'mate', value: 3 } } })
    expect(missed).toEqual({ type: 'endgame', text: 'Burada d3-d4 ile oyunu zorla kazanabilirdin.' })
  })

  it('falls back to the better move', () => {
    expect(explainDamaMove(input(HANGING, 'h1-g1', ['d3-c3'], ['e4-e3'], { winBefore: 50, winAfter: 42 })).type).toBe('other')
    expect(explainDamaMove({ ...input(HANGING, 'd3-d4', [], []), before: 'bozuk' })).toEqual({ text: 'Daha iyi bir hamle vardı.', type: 'other' })
  })
})

describe('Dama puzzle hints', () => {
  const puzzle = (position: string, bestMove: string, playedMove = 'h1-h2') => ({ position, bestMove, playedMove, errorType: 'other' })

  it('gives the idea first', () => {
    const dama = damaPuzzleHint(puzzle(NEAR_DAMA, 'd7-d8', 'a2-a3'))
    expect(dama.text).toContain('dama olabilir')
    expect(squares(dama.marks, 'hint')).toEqual(['d7'])

    const sacrifice = damaPuzzleHint(puzzle(COMBINATION, 'd3-d4', 'b3-b4'))
    expect(sacrifice.text).toContain('Bir taşını vermek')
    expect(squares(sacrifice.marks, 'hint')).toEqual(['d3'])
  })

  it('shows the piece the game move left to be taken', () => {
    const hint = damaPuzzleHint(puzzle(HANGING, 'd3-c3', 'd3-d4'))
    expect(hint.text).toContain('kırmızı işaretli taşın alınıyordu')
    expect(squares(hint.marks, 'danger')).toEqual(['d3'])
  })

  it('otherwise marks the piece to move', () => {
    const hint = damaPuzzleHint(puzzle(PROMOTION_GUARD, 'h1-h2', 'h1-g1'))
    expect(hint).toEqual({ text: 'İpucu: Yeşil işaretli taşla oynamalısın.', marks: [{ kind: 'hint', square: 'h1' }] })
  })
})

describe('Dama coach', () => {
  it('warns before giving a piece away', () => {
    const warning = damaCoachWarning(decode(HANGING), 'd3-d4')!
    expect(warning.text).toBe('Bu hamleden sonra rakip e4×c4 ile 1 taşını alabilir.')
    expect(squares(warning.marks, 'danger')).toEqual(['d4'])
    expect(squares(warning.marks, 'threat')).toEqual(['e4'])
    expect(damaCoachWarning(decode(HANGING), 'd3-c3')).toBeNull()
  })

  it('warns before walking into a trap', () => {
    const warning = damaCoachWarning(decode(TRAP), 'f4-f3')!
    expect(warning.text).toContain('bir taş verip seni almaya zorlar')
  })

  it('warns before letting the opponent make a dama', () => {
    expect(damaCoachWarning(decode(PROMOTION_GUARD), 'c1-b1')?.text).toBe('Bu hamleden sonra rakip c2-c1 ile dama yapabilir.')
  })

  it('asks questions that fit the position', () => {
    expect(damaCoachQuestions(decode(text('w', ['........', '........', '........', '...b....', '...w....'])))[0]).toContain('Alma zorunlu')
    expect(damaCoachQuestions(decode(THREATENED))[0]).toContain('sıra rakibinde olsaydı taş alabilirdi')
    expect(damaCoachQuestions(decode(NEAR_DAMA))[1]).toBe('Dama yapmaya yakın bir taşın var. Yolu açık mı?')
    expect(damaCoachQuestions(decode(PROMOTION_GUARD))[1]).toContain('Rakibinin dama yapmaya yakın bir taşı var')
    expect(damaCoachQuestions(decode(COMBINATION))[2]).toContain('Rakibini zorlayarak taş kazanabileceğin bir hamle var')
  })
})
