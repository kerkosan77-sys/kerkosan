import { describe, expect, it } from 'vitest'
import type { ExplainInput } from '../../core/types'
import { explainGoMove, pointsLost, stonesPhrase } from './explain'
import { encode, indexOf, initialPosition } from './rules'

const board = (...rows: string[]) => [...rows, ...Array(9 - rows.length).fill('.........')].join('/')
const cp = (value: number) => ({ kind: 'cp' as const, value })

function input(before: string, move: string, best: string[], reply: string[], extra: Partial<ExplainInput> = {}): ExplainInput {
  return {
    before,
    move,
    userSide: 'w',
    best: { pv: best, score: cp(0) },
    reply: { pv: reply, score: cp(0) },
    winBefore: 50,
    winAfter: 25,
    ...extra,
  }
}

/** Black D5 has two liberties (D4, E5); E5 is walled in by white on three sides. */
const SELF_ATARI = `x ${board('.........', '.........', '.........', '...oo....', '..ox.o...', '....o....')} - 0 7.5`
/** Black D5-E5 is in atari: its last liberty is E4. */
const BLACK_IN_ATARI = `x ${board('.........', '.........', '.........', '...oo....', '..oxxo...', '...o.....')} - 0 7.5`
/** The same shape with the colours swapped: white D5-E5 is in atari, black to move. */
const WHITE_IN_ATARI = `x ${board('.........', '.........', '.........', '...xx....', '..xoox...', '...x.....')} - 0 7.5`
/** Black E5-E4 has two liberties (F5, F4). */
const TWO_LIBERTIES = `x ${board('.........', '.........', '.........', '....o....', '...ox....', '...ox....', '....o....')} - 0 7.5`
const WALLS = Array(9).fill('....xo...').join('/')

describe('naming stones', () => {
  it('uses the right Turkish endings', () => {
    const at = (...coords: string[]) => coords.map((c) => indexOf(c, 9)!)
    expect(stonesPhrase(at('D4'), 9, 'acc')).toBe('D4 taşını')
    expect(stonesPhrase(at('D5', 'D4'), 9, 'acc')).toBe('D5 ve D4 taşlarını')
    expect(stonesPhrase(at('D5', 'D4', 'E4'), 9, 'gen')).toBe('D5, D4 ve E4 taşlarının')
    expect(stonesPhrase(at('C5', 'D5', 'E5', 'D4', 'D6'), 9, 'acc')).toBe('D5 çevresindeki 5 taşını')
  })

  it('turns winning chances back into points', () => {
    expect(pointsLost(50, 26.9)).toBe(8)
    expect(pointsLost(50, 60)).toBe(0)
    expect(pointsLost(100, 0)).toBe(0)
  })
})

describe('Go explanations', () => {
  it('spots a move that puts its own stones into atari', () => {
    const result = explainGoMove(input(SELF_ATARI, 'E5', ['D4'], ['D4']))
    expect(result.type).toBe('self_atari')
    expect(result.text).toContain('kendi 2 taşını atariye soktu')
    expect(result.text).toContain('tek nefesleri D4 kaldı')
    expect(result.text).toContain('Daha iyisi D4 idi.')
  })

  it('spots stones left in atari', () => {
    const result = explainGoMove(input(BLACK_IN_ATARI, 'J1', ['E4'], ['E4']))
    expect(result.type).toBe('lost_group')
    expect(result.text).toBe(
      'Senin D5 ve E5 taşlarının tek nefesi kalmıştı (atari) ama başka yere oynadın: rakip E4 noktasına oynayıp onları yakalayabiliyor. Daha iyisi E4 ile taşlarını kaçırmaktı.',
    )
  })

  it('spots stones the opponent can take a few moves later', () => {
    const result = explainGoMove(input(TWO_LIBERTIES, 'J1', ['F5'], ['F5', 'A1', 'F4']))
    expect(result.type).toBe('lost_group')
    expect(result.text).toBe(
      'Bu hamleden sonra rakip F5 ile başlayıp birkaç hamlede senin E5 ve E4 taşlarını yakalayabiliyor. Daha iyisi F5 idi.',
    )
  })

  it('spots a capture the user missed', () => {
    const result = explainGoMove(input(WHITE_IN_ATARI, 'J1', ['E4'], ['E4']))
    expect(result.type).toBe('missed_capture')
    expect(result.text).toBe('Rakibin D5 ve E5 taşlarının tek nefesi kalmıştı (atari). E4 noktasına oynayıp onları yakalayabilirdin.')
  })

  it('explains passing too early', () => {
    const empty = encode(initialPosition())
    const early = explainGoMove(input(empty, 'pass', ['E5'], ['E5'], { winBefore: 50, winAfter: 26.9 }))
    expect(early).toEqual({
      type: 'early_pass',
      text: 'Pas geçmek için erkendi: tahtada hâlâ sahibi belli olmayan değerli yerler vardı. Yaklaşık 8 alan kaybettirdi. Daha iyisi E5 idi.',
    })
    const afterOpponentPass = { ...initialPosition(), passes: 1 }
    const ended = explainGoMove({ ...input(encode(afterOpponentPass), 'pass', ['E5'], []), reply: null })
    expect(ended.type).toBe('early_pass')
    expect(ended.text).toContain('sen de pas geçtin ve oyun bitti')
  })

  it('calls an early move on the edge small', () => {
    const result = explainGoMove(input(encode(initialPosition()), 'A1', ['E5'], ['E5'], { winBefore: 50, winAfter: 35 }))
    expect(result.type).toBe('small_move')
    expect(result.text).toBe(
      'Oyunun başında kenara bu kadar yakın oynamak az alan getirir. E5 ortaya daha yakın ve daha çok alan çevirir. Yaklaşık 5 alan kaybettirdi.',
    )
  })

  it('notices a move inside an area that was already the user’s', () => {
    const result = explainGoMove(input(`x ${WALLS} - 0 7.5`, 'B5', ['pass'], ['pass']))
    expect(result.type).toBe('small_move')
    expect(result.text).toContain('Bu nokta zaten senin alanındaydı')
    expect(result.text).toContain('Burada pas geçmek daha iyiydi.')
  })

  it('falls back to the better move', () => {
    const result = explainGoMove(input('bozuk', 'E5', ['D4'], []))
    expect(result).toEqual({ text: 'Daha iyi bir hamle vardı.', type: 'other' })
  })
})
