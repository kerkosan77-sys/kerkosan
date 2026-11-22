import { describe, expect, it } from 'vitest'
import { goCoachQuestions, goCoachWarning } from './coach'
import { goModule } from './index'
import { decode, initialPosition } from './rules'

const board = (...rows: string[]) => [...rows, ...Array(9 - rows.length).fill('.........')].join('/')
const at = (turn: 'x' | 'o', rows: string, passes = 0) => decode(`${turn} ${rows} - ${passes} 7.5`)
const squares = (marks: { kind: string; square?: string }[], kind: string) =>
  marks
    .filter((m) => m.kind === kind)
    .map((m) => m.square)
    .sort()

/** Black D5 has two liberties (D4, E5); E5 is walled in by white on three sides. */
const SELF_ATARI = board('.........', '.........', '.........', '...oo....', '..ox.o...', '....o....')
/** E5 is surrounded by white on three sides. */
const LONE_POINT = board('.........', '.........', '.........', '....o....', '...o.o...')
/** Black D5-E5 is in atari (last liberty E4) and can escape there. */
const BLACK_IN_ATARI = board('.........', '.........', '.........', '...oo....', '..oxxo...', '...o.....')
/** Black D5-E5 is in atari and cannot escape: E4 is walled in too. */
const TRAPPED = board('.........', '.........', '.........', '...oo....', '..oxxo...', '...o.o...', '....o....')
/** Black can take the white stone on C5 at D5 (a ko). */
const KO = board('.........', '.........', '.........', '..xo.....', '.xo.o....', '..xo.....')
const WHITE_IN_ATARI = board('.........', '.........', '.........', '...xx....', '..xoox...', '...x.....')
const BLACK_TWO_LIBERTIES = board('.........', '.........', '.........', '....o....', '...ox....', '...ox....', '....o....')
const WHITE_TWO_LIBERTIES = board('.........', '.........', '.........', '...xx....', '..xoo....', '...x.....')
const WALLS = Array(9).fill('....xo...').join('/')
/** Black owns A-E, white G-J; column F is still nobody's. */
const NEUTRAL_COLUMN = Array(9).fill('....x.o..').join('/')

describe('Go coach warnings', () => {
  it('warns before putting stones into atari', () => {
    const warning = goCoachWarning(at('x', SELF_ATARI), 'E5')!
    expect(warning.text).toBe('Bu hamle 2 taşını atariye sokar: tek nefesleri D4 kalır ve rakip oraya oynayıp hepsini yakalayabilir.')
    expect(squares(warning.marks, 'danger')).toEqual(['D5', 'E5'])
    expect(squares(warning.marks, 'threat')).toEqual(['D4'])

    const lone = goCoachWarning(at('x', LONE_POINT), 'E5')!
    expect(lone.text).toBe('Bu taşın tek nefesi kalır (atari): rakip E4 noktasına oynayıp hemen yakalayabilir.')
  })

  it('does not warn about taking a ko', () => {
    expect(goCoachWarning(at('x', KO), 'D5')).toBeNull()
  })

  it('warns when a group in atari that could escape is left behind', () => {
    const warning = goCoachWarning(at('x', BLACK_IN_ATARI), 'J1')!
    expect(warning.text).toBe('Senin D5 ve E5 taşlarının tek nefesi kaldı (atari). Bu hamleden sonra rakip E4 noktasına oynayıp onları yakalayabilir.')
    expect(squares(warning.marks, 'danger')).toEqual(['D5', 'E5'])
    expect(squares(warning.marks, 'threat')).toEqual(['E4'])
    // Escaping is fine; a group that cannot escape anyway is not worth a warning.
    expect(goCoachWarning(at('x', BLACK_IN_ATARI), 'E4')).toBeNull()
    expect(goCoachWarning(at('x', TRAPPED), 'J1')).toBeNull()
  })

  it('stays quiet for ordinary moves', () => {
    expect(goCoachWarning(initialPosition(), 'E5')).toBeNull()
    expect(goCoachWarning(at('x', WHITE_IN_ATARI), 'E4')).toBeNull()
  })

  it('warns about passing while points are open', () => {
    const early = goCoachWarning(initialPosition(), 'pass')!
    expect(early.text).toBe('Tahtada hâlâ sahibi belli olmayan yerler var. Pas geçersen rakibin oralara oynayıp alan kazanabilir.')
    expect(early.marks).toEqual([])

    const late = goCoachWarning(at('x', NEUTRAL_COLUMN), 'pass')!
    expect(late.text).toContain('(yeşil kareler)')
    expect(late.note).toContain('henüz kimseye ait olmayan')
    expect(squares(late.marks, 'hint')).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'])

    expect(goCoachWarning(at('x', WALLS), 'pass')).toBeNull()
    expect(goModule.coachWarning(goModule.newState(), 'pass')).not.toBeNull()
  })

  it('warns about ending the game with a pass only when it would be lost', () => {
    const losing = goCoachWarning(at('o', NEUTRAL_COLUMN, 1), 'pass')!
    expect(losing.text).toContain('Sen de pas geçersen oyun biter ve şu anki sayıma göre 10,5 farkla kaybedersin.')
    expect(goCoachWarning(at('x', NEUTRAL_COLUMN, 1), 'pass')).toBeNull()
  })
})

describe('Go coach questions', () => {
  it('asks about stones in danger first', () => {
    expect(goCoachQuestions(at('x', BLACK_IN_ATARI))[0]).toContain('tek nefesi kalan (atari) taşların var')
    expect(goCoachQuestions(at('x', BLACK_TWO_LIBERTIES))[0]).toContain('İki nefesi kalan bir grubun var')
  })

  it('points at chances without naming the move', () => {
    expect(goCoachQuestions(at('x', WHITE_IN_ATARI))[1]).toBe('Rakibinin tek nefesi kalan (atari) taşları var. Yakalayabilir misin?')
    expect(goCoachQuestions(at('x', WHITE_TWO_LIBERTIES))[1]).toContain('iki nefesi kalan bir grubu var')
  })

  it('falls back to general questions and suggests passing when everything is walled in', () => {
    expect(goCoachQuestions(initialPosition())).toEqual([
      'Rakibinin son hamlesi neyi hedefliyor? Taşlarından birinin nefesini azaltıyor mu?',
      'Tahtada henüz kimsenin olmayan en büyük boş bölge nerede?',
      'Bu hamle kendi taşlarının nefesini azaltıyor mu?',
    ])
    expect(goCoachQuestions(at('x', WALLS))[2]).toContain('Bütün alanlar kapanmış görünüyor')
  })
})
