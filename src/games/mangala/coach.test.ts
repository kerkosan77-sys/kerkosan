import { describe, expect, it } from 'vitest'
import { mangalaCoachQuestions, mangalaCoachWarning, opponentThreat, safestLoss } from './coach'
import { decode } from './rules'

const warn = (position: string, move: number) => mangalaCoachWarning(decode(position), move)
const START = 'w:4,4,4,4,4,4,0,4,4,4,4,4,4,0'

describe('mangalaCoachWarning', () => {
  it('warns when the move lets the opponent take stones and a safer move exists', () => {
    // After 1. kuyu the opponent's single stone in its 1st pit lands in its empty 2nd pit,
    // facing the user's 6 stones in the 5th pit. Playing the 5th pit instead is safe.
    const position = 'w:2,0,0,0,6,0,10,1,0,2,2,0,2,10'
    expect(safestLoss(decode(position))).toBe(0)
    expect(warn(position, 0)).toEqual({
      text: 'Bu hamleden sonra rakip 1. kuyusundan oynayıp boş kuyu kuralıyla senin 5. kuyundaki 6 taşı alabilir.',
      marks: [
        { kind: 'threat', move: '7' },
        { kind: 'danger', square: '4' },
      ],
    })
    expect(warn(position, 4)).toBeNull()
  })

  it('stays quiet about safe moves and moves that give an extra turn', () => {
    expect(warn(START, 4)).toBeNull()
    expect(warn(START, 3)).toBeNull()
  })

  it('catches the opening trap of playing the 1st pit', () => {
    // 1. kuyu leaves 5 stones in the 2nd pit; the opponent's 6th pit then ends there and makes it 6.
    expect(warn(START, 0)?.text).toBe(
      'Bu hamleden sonra rakip 6. kuyusundan oynayıp senin 2. kuyundaki 6 taşı çift kuralıyla alabilir.',
    )
  })

  it('warns about the opponent emptying its pits and sweeping the user\'s stones', () => {
    const result = warn('w:3,0,0,0,0,2,15,0,0,0,0,0,1,25', 0)
    expect(result?.text).toBe('Bu hamleden sonra rakip kuyularını boşaltıp oyunu bitirebilir ve senin kuyularındaki 5 taşı alır.')
    expect(result?.marks).toEqual([{ kind: 'threat', move: '12' }])
  })

  it('subtracts the stones the move itself takes', () => {
    // 6. kuyu takes 4 stones but the opponent then takes 6: a net loss of 2 is not worth a warning.
    expect(warn('w:0,0,0,0,5,3,10,3,0,2,2,0,7,10', 5)).toBeNull()
    // With 7 stones in the 5th pit the opponent takes 8: still a net loss of 4.
    expect(warn('w:0,0,0,0,7,3,10,3,0,2,2,0,7,10', 5)?.text).toBe(
      '4 taş alıyorsun ama bu hamleden sonra rakip 6. kuyusundan oynayıp senin 5. kuyundaki 8 taşı çift kuralıyla alabilir.',
    )
  })

  it('does not warn when there is no better move', () => {
    // The only legal move ends the game in a loss.
    expect(warn('w:0,0,0,0,0,3,18,1,0,0,0,0,0,26', 5)).toBeNull()
  })
})

describe('opponentThreat', () => {
  it('follows extra turns', () => {
    // 6th pit -> store (extra turn), then the 5th-pit stone lands in the emptied 6th pit facing 5 stones.
    const threat = opponentThreat(decode('b:5,1,1,1,1,1,10,1,0,0,0,1,1,14'))
    expect(threat).toEqual({ stones: 5, kind: 'empty', firstMove: 12, pit: 0, viaExtraTurn: true })
  })

  it('counts the end-of-game sweep when a capture empties the attacker\'s pits', () => {
    // Same idea, but the capture leaves the opponent with no stones: it also takes the user's other 5.
    const threat = opponentThreat(decode('b:5,1,1,1,1,1,10,0,0,0,0,1,1,15'))
    expect(threat).toMatchObject({ stones: 10, kind: 'sweep', firstMove: 12, viaExtraTurn: true })
  })

  it('finds nothing in the starting position', () => {
    expect(opponentThreat(decode('b:4,4,4,4,4,4,0,4,4,4,4,4,4,0'))).toBeNull()
  })
})

describe('mangalaCoachQuestions', () => {
  it('asks the general questions at the start and nudges towards the extra turn', () => {
    expect(mangalaCoachQuestions(decode(START))).toEqual([
      'Rakibin bir sonraki hamlesinde hangi kuyun tehlikeye girer? (çift kuralı ya da boş kuyu kuralı)',
      'Son taşı hazinene düşen bir kuyun var; tekrar oynayabilirsin. Ama önce güvenli mi, düşün.',
    ])
  })

  it('warns that a pit is already in danger, without naming it', () => {
    const [first, second] = mangalaCoachQuestions(decode('w:2,0,0,0,6,0,10,1,0,2,2,0,2,10'))
    expect(first).toBe('Dikkat: rakip bir sonraki hamlesinde kuyularından birinden taş alabilir. Hangisi, nasıl korursun?')
    expect(second).toContain('fırsatın yok')
  })

  it('points out that a capture is available', () => {
    const [, second] = mangalaCoachQuestions(decode('w:4,4,4,4,4,3,0,3,4,4,4,4,4,0'))
    expect(second).toBe('Rakipten taş alabileceğin bir hamle var. Bulabilir misin?')
  })
})
