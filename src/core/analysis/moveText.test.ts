import { describe, expect, it } from 'vitest'
import { classifyMove, type MoveClassInput } from '../classify'
import { factsSentence, goodMoveText, opponentErrorText } from './moveText'

const base: MoveClassInput = { drop: 0, isTopMove: true, winBest: 55, winAfter: 55, secondGap: 3 }

describe('classifyMove', () => {
  it('sorts moves into Chess.com-like classes', () => {
    expect(classifyMove(base)).toBe('best')
    expect(classifyMove({ ...base, isTopMove: false, drop: 0.3 })).toBe('best')
    expect(classifyMove({ ...base, isTopMove: false, drop: 1.5 })).toBe('excellent')
    expect(classifyMove({ ...base, isTopMove: false, drop: 3 })).toBe('good')
    expect(classifyMove({ ...base, isTopMove: false, drop: 7 })).toBe('inaccuracy')
    expect(classifyMove({ ...base, isTopMove: false, drop: 12 })).toBe('mistake')
    expect(classifyMove({ ...base, isTopMove: false, drop: 25 })).toBe('blunder')
  })

  it('finds only moves, sacrifices and forced moves', () => {
    expect(classifyMove({ ...base, secondGap: 20 })).toBe('great')
    // Taking a piece back is the natural move, not a great find; nor is holding a lost game.
    expect(classifyMove({ ...base, secondGap: 20, obvious: true })).toBe('best')
    expect(classifyMove({ ...base, secondGap: 20, winAfter: 10, winBest: 10 })).toBe('best')
    expect(classifyMove({ ...base, sacrifice: true })).toBe('brilliant')
    // A sacrifice in a game already won, or one that does not work, is not brilliant.
    expect(classifyMove({ ...base, sacrifice: true, winBest: 97, winAfter: 97 })).toBe('best')
    expect(classifyMove({ ...base, sacrifice: true, isTopMove: false, drop: 15 })).toBe('mistake')
    expect(classifyMove({ ...base, forced: true, secondGap: null })).toBe('forced')
  })
})

describe('move texts', () => {
  it('joins facts into one short sentence', () => {
    expect(factsSentence(['Atı alıyor', 'Şah çekiyor', 'Merkezi tutuyor'])).toBe('Atı alıyor ve şah çekiyor.')
    expect(factsSentence([])).toBeNull()
    expect(factsSentence(['Mat! Oyunu bitiriyor.'])).toBe('Mat! Oyunu bitiriyor.')
    expect(factsSentence(['2 taş alıyor', 'Atari yapıyor: karşıdaki taş alınabilir'])).toBe('2 taş alıyor. Atari yapıyor: karşıdaki taş alınabilir.')
  })

  it('names the better move only when it matters', () => {
    expect(goodMoveText('best', 'Atı alıyor.', null)).toBe('En iyi hamle. Atı alıyor.')
    expect(goodMoveText('excellent', null, '♘f3')).toBe('Çok iyi hamle. En iyisi ♘f3 idi.')
    expect(goodMoveText('good', 'Merkezi tutuyor.', 'e4')).toBe('İyi hamle. Merkezi tutuyor. Daha iyisi e4 idi.')
    expect(goodMoveText('forced', 'Şah çekiyor.', null)).toBe('Başka yasal hamle yoktu. Şah çekiyor.')
  })

  it("explains the opponent's error from the user's side", () => {
    expect(opponentErrorText('mistake', { label: '♘xe5', facts: 'Piyonu alıyor.', found: false }, null)).toBe(
      'Rakip hata yaptı. Şimdi en iyi cevap ♘xe5: piyonu alıyor.',
    )
    expect(opponentErrorText('inaccuracy', { label: 'd4', facts: null, found: true }, null)).toBe(
      'Rakibin küçük bir yanlışlığı. Şimdi en iyi cevap d4. Sen de bunu buldun!',
    )
    expect(opponentErrorText('mistake', { label: 'H4', facts: 'Atari yapıyor: karşıdaki taş alınabilir.', found: false }, null)).toBe(
      'Rakip hata yaptı. Şimdi en iyi cevap H4. Atari yapıyor: karşıdaki taş alınabilir.',
    )
    expect(opponentErrorText('blunder', null, '3. kuyu')).toBe('Rakip büyük bir hata yaptı. Daha iyisi 3. kuyu idi.')
  })
})
