import { describe, expect, it } from 'vitest'
import { attackersOf, coachQuestions, hangingWarningText } from './coach'
import type { LeftHanging } from './hanging'

const base: LeftHanging = {
  piece: { square: 'e5', type: 'n', loss: 3, defended: false },
  netLoss: 3,
  isMovedPiece: true,
  wasHangingBefore: false,
  removedDefender: false,
}

describe('hangingWarningText', () => {
  it('describes a moved piece left undefended', () => {
    expect(hangingWarningText(base)).toBe('Bu hamleyle atın e5 karesinde korumasız kalıyor. Rakip onu bedavaya alabilir.')
  })

  it('describes a moved piece that is defended but not enough', () => {
    const text = hangingWarningText({ ...base, piece: { ...base.piece, type: 'q', defended: true } })
    expect(text).toBe('e5 karesinde vezirin yeterince korunmuyor. Rakip onu alıp kazançlı çıkar.')
  })

  it('describes removing a defender', () => {
    const text = hangingWarningText({
      ...base,
      isMovedPiece: false,
      removedDefender: true,
      piece: { square: 'd5', type: 'b', loss: 3, defended: false },
    })
    expect(text).toBe('Bu hamle d5 karesindeki filinin korumasını kaldırıyor. Rakip onu alabilir.')
  })

  it('describes ignoring an attack', () => {
    const text = hangingWarningText({
      ...base,
      isMovedPiece: false,
      wasHangingBefore: true,
      piece: { square: 'a4', type: 'r', loss: 5, defended: false },
    })
    expect(text).toBe('a4 karesindeki kalen saldırı altında ve bu hamle onu kurtarmıyor.')
  })
})

describe('coachQuestions', () => {
  it("asks about the opponent's last move when there is one", () => {
    expect(coachQuestions('♘f6')).toEqual([
      'Rakibin son hamlesi (♘f6) neyi tehdit ediyor?',
      'Oynayacağın hamle bir taşını korumasız bırakıyor mu?',
    ])
  })

  it('only asks the second question at the very start', () => {
    expect(coachQuestions(null)).toEqual(['Oynayacağın hamle bir taşını korumasız bırakıyor mu?'])
  })
})

describe('attackersOf', () => {
  it('lists the enemy pieces attacking a square', () => {
    const fen = '3qk3/8/8/3B4/8/8/1N6/4K3 b - - 0 1'
    expect(attackersOf(fen, 'd5', 'b')).toEqual(['d8'])
  })
})
