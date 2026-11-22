import { describe, expect, it } from 'vitest'
import { applyMove, initialPosition } from './rules'
import { territoryView } from './territory'

describe('Go territory view', () => {
  it('shows nothing on an empty board', () => {
    const view = territoryView(initialPosition())
    expect(view.marks).toEqual([])
    expect(view.text).toContain('henüz taş yok')
  })

  it('gives each side the area around its stones', () => {
    // Black walls off the left side, White the right side.
    let position = initialPosition()
    const moves = ['C1', 'G1', 'C2', 'G2', 'C3', 'G3', 'C4', 'G4', 'C5', 'G5', 'C6', 'G6', 'C7', 'G7', 'C8', 'G8', 'C9', 'G9']
    for (const move of moves) position = applyMove(position, move)!.position
    const view = territoryView(position)
    expect(view.black).toBeGreaterThan(30)
    expect(view.white).toBeGreaterThan(30)
    expect(view.black + view.white).toBeCloseTo(81, 5)
    expect(view.marks.some((m) => m.kind === 'territory' && m.square === 'A5' && m.side === 'w')).toBe(true)
    expect(view.marks.some((m) => m.kind === 'territory' && m.square === 'J5' && m.side === 'b')).toBe(true)
  })
})
