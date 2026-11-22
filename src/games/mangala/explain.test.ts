import { describe, expect, it } from 'vitest'
import { explainMangalaMove } from './explain'
import { mangalaPuzzleHint, mostThreatenedPit } from './hints'
import type { ExplainInput, Score } from '../../core/types'

const cp = (value: number): Score => ({ kind: 'cp', value })
const mate = (value: number): Score => ({ kind: 'mate', value })
const START = 'w:4,4,4,4,4,4,0,4,4,4,4,4,4,0'

function explain(input: Partial<ExplainInput> & Pick<ExplainInput, 'before' | 'move'>) {
  return explainMangalaMove({
    userSide: 'w',
    best: null,
    reply: null,
    winBefore: 50,
    winAfter: 30,
    ...input,
  })
}

describe('explainMangalaMove', () => {
  it('points out a missed extra turn', () => {
    const result = explain({
      before: START,
      move: '0',
      best: { pv: ['3', '5'], score: cp(100) },
      reply: { pv: ['7'], score: cp(0) },
    })
    expect(result).toEqual({
      type: 'missed_extra_turn',
      text: 'Burada 4. kuyundan oynasaydın son taş hazinene düşer ve tekrar oynardın.',
    })
  })

  it('points out a missed even capture', () => {
    const result = explain({
      before: 'w:4,4,4,4,4,3,0,3,4,4,4,4,4,0',
      move: '0',
      best: { pv: ['5'], score: cp(400) },
      reply: { pv: ['8'], score: cp(0) },
    })
    expect(result).toEqual({
      type: 'missed_capture',
      text: 'Burada 6. kuyundan oynayıp rakibin 1. kuyusundaki 4 taşı çift kuralıyla alabilirdin.',
    })
  })

  it('describes a capture that needs an extra turn first', () => {
    // 4th pit ends in the store, then the 6th pit makes the opponent's 3rd pit even (3 -> 4).
    const result = explain({
      before: 'w:4,4,4,4,4,4,0,4,4,3,4,4,4,0',
      move: '0',
      best: { pv: ['3', '5'], score: cp(400) },
      reply: { pv: ['7'], score: cp(0) },
    })
    expect(result).toEqual({
      type: 'missed_capture',
      text: 'Burada önce 4. kuyundan oynayıp tekrar oynama hakkı kazanarak rakibin 3. kuyusundaki 4 taşı çift kuralıyla alabilirdin.',
    })
  })

  it('does not blame a one-stone empty-pit capture', () => {
    // After 1. kuyu the opponent's single stone lands in its own empty pit facing just 1 of the user's stones.
    const result = explain({
      before: 'w:2,0,0,0,1,0,10,1,0,2,2,0,2,10',
      move: '0',
      best: { pv: ['4', '7'], score: cp(0) },
      reply: { pv: ['7'], score: cp(150) },
      winBefore: 50,
      winAfter: 42,
    })
    expect(result.type).not.toBe('allowed_capture')
  })

  it('mentions stones the move took before the stones it gave away', () => {
    // 6. kuyu takes 4 stones (even rule), but then the opponent's 7-stone 6th pit makes the user's 5th pit even.
    const result = explain({
      before: 'w:0,0,0,0,5,3,10,3,0,2,2,0,7,10',
      move: '5',
      best: { pv: ['4'], score: cp(300) },
      reply: { pv: ['12'], score: cp(400) },
    })
    expect(result.type).toBe('allowed_capture')
    expect(result.text).toBe(
      '4 taş aldın ama bu hamleden sonra rakip 6. kuyusundan oynayıp senin 5. kuyundaki 6 taşı çift kuralıyla alabiliyor. Daha iyisi şuydu: 5. kuyu.',
    )
  })

  it('numbers pits from the second player\'s side when the user moves second', () => {
    const result = explain({
      before: 'b:3,4,4,4,4,4,0,4,4,4,4,4,3,0',
      move: '7',
      userSide: 'b',
      best: { pv: ['12'], score: cp(400) },
      reply: { pv: ['1'], score: cp(0) },
    })
    expect(result.text).toBe('Burada 6. kuyundan oynayıp rakibin 1. kuyusundaki 4 taşı çift kuralıyla alabilirdin.')
  })

  it('explains an even capture the move allows, and the capture it missed', () => {
    const result = explain({
      before: 'w:3,0,0,0,1,0,10,0,5,5,5,0,3,10',
      move: '4',
      best: { pv: ['0', '12'], score: cp(-50) },
      reply: { pv: ['12'], score: cp(300) },
    })
    expect(result.type).toBe('allowed_capture')
    expect(result.text).toBe(
      'Bu hamleden sonra rakip 6. kuyusundan oynayıp senin 1. kuyundaki 4 taşı çift kuralıyla alabiliyor. ' +
        'Ayrıca burada 1. kuyundan oynayıp boş kuyu kuralıyla rakibin 4. kuyusundaki 5 taşı alabilirdin.',
    )
  })

  it('explains an empty-pit capture the move allows', () => {
    const result = explain({
      before: 'w:2,0,0,0,6,0,10,1,0,2,2,0,2,10',
      move: '0',
      best: { pv: ['4', '7'], score: cp(0) },
      reply: { pv: ['7'], score: cp(500) },
    })
    expect(result).toEqual({
      type: 'allowed_capture',
      text: 'Bu hamleden sonra rakip 1. kuyusundan oynayıp boş kuyu kuralıyla senin 5. kuyundaki 6 taşı alabiliyor. Daha iyisi şuydu: 5. kuyu.',
    })
  })

  it('explains letting the opponent move several times in a row', () => {
    const result = explain({
      before: 'w:2,1,0,0,0,8,0,3,3,3,3,3,2,0',
      move: '0',
      best: { pv: ['5', '7'], score: cp(0) },
      reply: { pv: ['12', '11'], score: cp(200) },
    })
    expect(result).toEqual({
      type: 'allowed_extra_turn',
      text: 'Bu hamleden sonra rakip 6. kuyusundan oynayıp son taşını hazinesine düşürerek art arda oynayabiliyor. Daha iyisi şuydu: 6. kuyu.',
    })
  })

  it('reminds that an extra turn is not always best', () => {
    const result = explain({
      before: START,
      move: '3',
      best: { pv: ['4'], score: cp(100) },
      // Still the user's turn after the extra-turn move.
      reply: { pv: ['0'], score: cp(-200) },
    })
    expect(result.type).toBe('other')
    expect(result.text).toBe(
      'Tekrar oynama hakkı kazanmak her zaman en iyisi değildir: bu sefer birkaç hamle sonra taş kaybettiriyor. Daha iyisi şuydu: 5. kuyu.',
    )
  })

  it('points out a missed forced win', () => {
    const result = explain({
      before: START,
      move: '0',
      best: { pv: ['4'], score: mate(5) },
      reply: { pv: ['7'], score: cp(0) },
    })
    expect(result).toEqual({ type: 'endgame', text: 'Burada 5. kuyu ile oyunu zorla kazanabilirdin.' })
  })

  it('explains a move after which the opponent wins by force, with the concrete threat', () => {
    const result = explain({
      before: 'w:3,0,0,0,1,0,10,0,5,5,5,0,3,10',
      move: '4',
      best: { pv: ['0', '12'], score: cp(-50) },
      reply: { pv: ['12'], score: mate(4) },
    })
    expect(result.type).toBe('endgame')
    expect(result.text).toBe(
      'Bu hamleden sonra rakip 6. kuyusundan oynayıp senin 1. kuyundaki 4 taşı çift kuralıyla alabiliyor. ' +
        'Bundan sonra rakip oyunu zorla kazanıyor. Daha iyisi şuydu: 1. kuyu.',
    )
  })

  it('explains the opponent ending the game and sweeping the user\'s stones', () => {
    const result = explain({
      before: 'w:3,0,0,0,0,2,15,0,0,0,0,0,1,25',
      move: '0',
      best: { pv: ['5'], score: cp(0) },
      reply: { pv: ['12'], score: cp(900) },
    })
    expect(result).toEqual({
      type: 'endgame',
      text: 'Bu hamleden sonra rakip kuyularını boşaltıp oyunu bitirebiliyor ve senin kuyularındaki 5 taşı alıyor. Daha iyisi şuydu: 6. kuyu.',
    })
  })

  it('explains a move that ends the game in a loss or in a draw from a winning position', () => {
    const loss = explain({
      before: 'w:0,0,0,0,0,3,18,1,0,0,0,0,0,26',
      move: '5',
      best: { pv: ['5'], score: cp(0) },
    })
    expect(loss.type).toBe('endgame')
    expect(loss.text).toContain('hazinende 21, rakibinde 27 taş vardı: oyunu kaybettin')

    const draw = explain({
      before: 'w:0,0,0,0,0,1,22,1,0,0,0,0,0,24',
      move: '5',
      best: { pv: ['5'], score: cp(900) },
      winBefore: 80,
    })
    expect(draw.text).toContain('oyunu berabere bitirdi, oysa kazanma şansın yüksekti')
  })

  it('falls back to a general explanation with the better move', () => {
    const result = explain({
      before: START,
      move: '1',
      best: { pv: ['4'], score: cp(100) },
      reply: { pv: ['7'], score: cp(50) },
      winBefore: 52,
      winAfter: 45,
    })
    expect(result).toEqual({ type: 'other', text: 'Bu hamle birkaç hamle sonra taş kaybına yol açıyor. Daha iyisi şuydu: 5. kuyu.' })
  })
})

describe('mangalaPuzzleHint', () => {
  const hint = (position: string, bestMove: string, playedMove = '0', errorType = 'other') =>
    mangalaPuzzleHint({ position, bestMove, playedMove, errorType })

  it('hints at an extra turn without naming the pit', () => {
    expect(hint(START, '3').text).toContain('hazinene düşeceği')
  })

  it('hints at the even rule and the empty-pit rule', () => {
    expect(hint('w:4,4,4,4,4,3,0,3,4,4,4,4,4,0', '5').text).toContain('çift yapabilir')
    expect(hint('w:0,0,1,0,0,2,10,3,3,5,3,3,3,15', '2').text).toContain('boş kuyuna')
  })

  it('hints at ending the game when that wins', () => {
    expect(hint('w:0,0,0,0,0,1,20,2,2,2,2,2,2,15', '5').text).toContain('Kuyularını boşaltıp')
  })

  it('marks the pit that was in danger after the game move', () => {
    const result = hint('w:2,0,0,0,6,0,10,1,0,2,2,0,2,10', '4', '0', 'allowed_capture')
    expect(result.text).toContain('5. kuyun tehlikede')
    expect(result.marks).toEqual([{ kind: 'danger', square: '4' }])
  })

  it("follows the opponent's extra turns when looking for the pit in danger", () => {
    // No capture right away: the opponent's 5th-pit stone would land on a stone in its 6th pit.
    // But its 6th-pit stone first goes to the store (extra turn); then the 5th-pit stone lands in
    // the now empty 6th pit, facing the user's 5-stone 1st pit.
    const threatened = mostThreatenedPit({ pits: [5, 1, 1, 1, 1, 1, 10, 0, 0, 0, 0, 1, 1, 15], turn: 'b' })
    expect(threatened).toEqual({ pit: 0, stones: 5 })
    expect(mostThreatenedPit({ pits: [5, 1, 1, 1, 1, 1, 10, 0, 0, 0, 0, 1, 1, 15], turn: 'b' }, 1)).toBeNull()
  })

  it('otherwise narrows the answer down to one half of the board', () => {
    expect(hint(START, '4').text).toContain('4-6 arasında')
    expect(hint(START, '1').text).toContain('1-3 arasında')
  })
})
