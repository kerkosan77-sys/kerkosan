import { describe, expect, it } from 'vitest'
import { goPuzzleHint } from './hints'
import { encode, initialPosition } from './rules'

const board = (...rows: string[]) => [...rows, ...Array(9 - rows.length).fill('.........')].join('/')
const puzzle = (position: string, bestMove: string, errorType = 'other') => ({ position, bestMove, playedMove: 'J1', errorType })
const squares = (marks: { square?: string }[]) => marks.map((m) => m.square).sort()

const WHITE_IN_ATARI = `x ${board('.........', '.........', '.........', '...xx....', '..xoox...', '...x.....')} - 0 7.5`
const BLACK_IN_ATARI = `x ${board('.........', '.........', '.........', '...oo....', '..oxxo...', '...o.....')} - 0 7.5`
/** White D5-E5 has two liberties (F5, E4). */
const WHITE_TWO_LIBERTIES = `x ${board('.........', '.........', '.........', '...xx....', '..xoo....', '...x.....')} - 0 7.5`

describe('Go puzzle hints', () => {
  it('points at stones that can be captured', () => {
    const hint = goPuzzleHint(puzzle(WHITE_IN_ATARI, 'E4'))
    expect(hint.text).toContain('turuncu işaretli taşlarının tek nefesi kaldı')
    expect(squares(hint.marks)).toEqual(['D5', 'E5'])
    expect(hint.marks.every((m) => m.kind === 'threat')).toBe(true)
  })

  it('points at stones to save', () => {
    const hint = goPuzzleHint(puzzle(BLACK_IN_ATARI, 'E4'))
    expect(hint.text).toContain('Kırmızı işaretli taşlarının tek nefesi kaldı')
    expect(squares(hint.marks)).toEqual(['D5', 'E5'])
    expect(hint.marks.every((m) => m.kind === 'danger')).toBe(true)
  })

  it('points at stones to put into atari', () => {
    const hint = goPuzzleHint(puzzle(WHITE_TWO_LIBERTIES, 'F5'))
    expect(hint.text).toContain('atariye sokabilirsin')
    expect(squares(hint.marks)).toEqual(['D5', 'E5'])
  })

  it('otherwise shows the part of the board to look at', () => {
    const empty = encode(initialPosition())
    const hint = goPuzzleHint(puzzle(empty, 'C7'))
    expect(hint.text).toBe('İpucu: Doğru hamle tahtanın sol üst köşesinde. İşaretli bölgeye bak.')
    expect(squares(hint.marks)).toEqual(['A7', 'A8', 'A9', 'B7', 'B8', 'B9', 'C7', 'C8', 'C9'])
    expect(hint.marks.every((m) => m.kind === 'hint')).toBe(true)

    expect(goPuzzleHint(puzzle(empty, 'E5', 'early_pass')).text).toBe(
      'İpucu: Pas geçmek için erken. Doğru hamle tahtanın ortasında. İşaretli bölgeye bak.',
    )
    expect(goPuzzleHint(puzzle(empty, 'pass')).text).toContain('işe yarar bir yer kalmamıştır')
  })
})
