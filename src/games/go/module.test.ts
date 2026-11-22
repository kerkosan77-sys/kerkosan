import { describe, expect, it } from 'vitest'
import { goModule, goWinPercent, type GoState } from './index'
import { encode } from './rules'
import { parseSgf } from './sgf'

/** Black owns the left five columns, white the right four; one dead stone sits in each area. */
const FINISHED = '(;GM[1]FF[4]SZ[9]KM[7.5]AB[ea:ei][he]AW[fa:fi][be];B[];W[])'

function play(state: GoState, ...moves: string[]): GoState {
  return moves.reduce((s, move) => {
    const next = goModule.play(s, move)
    if (!next) throw new Error(`illegal ${move}`)
    return next
  }, state)
}

describe('Go module', () => {
  it('labels moves, captures and passes', () => {
    const state = play(goModule.newState(), 'A2', 'A1', 'B1', 'pass')
    expect(goModule.history(state).map((m) => m.label)).toEqual(['A2', 'A1', 'B1 (+1 taş)', 'Pas'])
    expect(goModule.moveTitle(2, 'w', 'B1 (+1 taş)')).toBe('3. hamle · Siyah B1 (+1 taş)')
    expect(goModule.turn(state)).toBe('w')
    expect(goModule.play(state, 'B1')).toBeNull()
  })

  it('says when the opponent passed', () => {
    const state = play(goModule.newState(), 'E5', 'pass')
    expect(goModule.statusNote(state, 'w')).toMatch(/Rakibin pas geçti/)
    expect(goModule.pass!.confirm(state)).toMatch(/oyun biter/)
    expect(goModule.statusNote(state, 'b')).toBeNull()
  })

  it('counts a finished game with the dead stones taken off', () => {
    const state = goModule.stateFromRecord(FINISHED)
    const end = goModule.end(state, 'w')!
    expect(end.result).toBe('1-0')
    expect(end.outcome).toBe('win')
    expect(end.detail).toContain('Senin alanın: 45 · Rakibinin: 36 + 7,5 komi.')
    expect(end.detail).toContain('1,5 farkla kazandın')
    const dead = end.marks!.filter((m) => m.kind === 'dead').map((m) => m.square)
    expect(dead.sort()).toEqual(['B5', 'H5'])
    expect(end.marks!.filter((m) => m.kind === 'territory' && m.side === 'w')).toHaveLength(36)
    expect(goModule.end(state, 'b')!.outcome).toBe('loss')
  })

  it('lets the user correct the count and stores it in the record', () => {
    const state = goModule.stateFromRecord(FINISHED)
    const corrected = goModule.scoring!.toggle(state, 'B5')!
    const end = goModule.end(corrected, 'w')!
    // With the white stone alive, black's area is no longer walled in.
    expect(end.outcome).toBe('loss')
    expect(goModule.scoring!.toggle(state, 'C3')).toBeNull()

    const record = goModule.stateToRecord(corrected, { names: { w: 'Sen', b: 'Bilgisayar' }, result: end.result })
    const sgf = parseSgf(record)
    expect(sgf.dead).toEqual([43])
    expect(sgf.info.RE).toMatch(/^W\+/)
    expect(goModule.end(goModule.stateFromRecord(record), 'w')!.outcome).toBe('loss')
  })

  it('reads games for analysis with the final result', () => {
    const { moves, terminal } = goModule.readGame(FINISHED)
    expect(moves).toHaveLength(2)
    expect(terminal).toEqual([null, null, 'loss'])
    const ended = goModule.playAt(moves[1].before, 'pass')!
    expect(ended.ended).toBe('loss')
    expect(goModule.playAt(moves[0].before, 'Z9')).toBeNull()
  })

  it('round-trips a game in progress', () => {
    const state = play(goModule.newState(), 'E5', 'D4', 'pass')
    const again = goModule.stateFromRecord(goModule.stateToRecord(state))
    expect(goModule.history(again).map((m) => m.code)).toEqual(['E5', 'D4', 'pass'])
    expect(encode(again.position)).toBe(encode(state.position))
    expect(goModule.end(again, 'w')).toBeNull()
  })

  it('turns the expected margin into winning chances', () => {
    expect(goWinPercent({ kind: 'cp', value: 0 })).toBe(50)
    expect(goWinPercent({ kind: 'cp', value: 800 })).toBeCloseTo(73.1, 1)
    expect(goWinPercent({ kind: 'cp', value: -800 })).toBeCloseTo(26.9, 1)
    expect(goWinPercent({ kind: 'mate', value: 1 })).toBe(100)
  })
})
