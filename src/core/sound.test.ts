import { describe, expect, it } from 'vitest'
import { capturedCount, isCaptureLabel } from './sound'

describe('move sounds', () => {
  it('hears a capture in every game’s move labels', () => {
    expect(isCaptureLabel('♘xe5')).toBe(true) // chess
    expect(isCaptureLabel('c3×c5×c7')).toBe(true) // dama
    expect(isCaptureLabel('4. kuyu (+6 taş)')).toBe(true) // mangala
    expect(isCaptureLabel('D4 (+2 taş)')).toBe(true) // go
    expect(isCaptureLabel('d3 (+2)')).toBe(true) // reversi
    expect(isCaptureLabel('e4')).toBe(false)
    expect(isCaptureLabel('3. kuyu (tekrar)')).toBe(false)
    expect(isCaptureLabel('Pas')).toBe(false)
  })

  it('counts the pieces taken or turned over', () => {
    expect(capturedCount('D4 (+3 taş)')).toBe(3)
    expect(capturedCount('f5 (+4)')).toBe(4)
    expect(capturedCount('c3×c5×c7')).toBe(2)
    expect(capturedCount('♘xe5')).toBe(1)
  })
})
