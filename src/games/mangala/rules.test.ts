import { describe, expect, it } from 'vitest'
import {
  TOTAL_STONES,
  applyMove,
  applyMoveFast,
  decode,
  encode,
  initialPosition,
  isOver,
  legalMoves,
  pitNumber,
  winner,
  type Position,
} from './rules'

const pos = (pits: number[], turn: 'w' | 'b' = 'w'): Position => ({ pits, turn })
const sum = (pits: number[]) => pits.reduce((a, b) => a + b, 0)

describe('setup', () => {
  it('starts with 4 stones in every pit and empty stores', () => {
    const start = initialPosition()
    expect(start.pits).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0])
    expect(start.turn).toBe('w')
    expect(sum(start.pits)).toBe(TOTAL_STONES)
    expect(legalMoves(start)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('numbers pits 1-6 from each owner\'s left', () => {
    expect([0, 5, 7, 12].map(pitNumber)).toEqual([1, 6, 1, 6])
  })
})

describe('sowing', () => {
  it('puts the first stone back into the starting pit', () => {
    const result = applyMove(initialPosition(), 0)!
    expect(result.position.pits).toEqual([1, 5, 5, 5, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0])
    expect(result.path).toEqual([0, 1, 2, 3])
    expect(result.position.turn).toBe('b')
    expect(result.extraTurn).toBe(false)
    expect(result.capture).toBeNull()
  })

  it('moves a single stone to the next pit, leaving the start empty', () => {
    const result = applyMove(pos([0, 0, 1, 0, 0, 2, 10, 3, 3, 0, 3, 3, 3, 20]), 2)!
    expect(result.position.pits.slice(0, 6)).toEqual([0, 0, 0, 1, 0, 2])
    expect(result.path).toEqual([3])
    expect(result.capture).toBeNull() // the opposite pit (index 9) is empty
    expect(result.position.turn).toBe('b')
  })

  it("sows into the player's own store but skips the opponent's store", () => {
    const pits = [15, 0, 0, 0, 0, 1, 0, 2, 2, 2, 2, 2, 2, 20]
    const result = applyMove(pos(pits), 0)!
    expect(result.path).not.toContain(13)
    expect(result.path).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1])
    expect(result.position.pits[13]).toBe(20)
    expect(result.position.pits[6]).toBe(1)
  })

  it("lets the second player skip the first player's store", () => {
    const pits = [1, 1, 1, 1, 1, 1, 5, 0, 0, 0, 0, 0, 3, 0]
    const result = applyMove(pos(pits, 'b'), 12)!
    expect(result.path).toEqual([12, 13, 0])
    expect(result.position.pits[6]).toBe(5)
  })
})

describe('extra turn', () => {
  it('gives another move when the last stone lands in the own store', () => {
    const result = applyMove(initialPosition(), 3)!
    expect(result.position.pits).toEqual([4, 4, 4, 1, 5, 5, 1, 4, 4, 4, 4, 4, 4, 0])
    expect(result.extraTurn).toBe(true)
    expect(result.position.turn).toBe('w')
  })
})

describe('captures', () => {
  it('takes an opponent pit that the last stone makes even', () => {
    const result = applyMove(pos([4, 4, 4, 4, 4, 3, 0, 3, 4, 4, 4, 4, 4, 0]), 5)!
    expect(result.capture).toEqual({ kind: 'even', pit: 7, stones: 4 })
    expect(result.position.pits[7]).toBe(0)
    expect(result.position.pits[6]).toBe(5) // 1 sown + 4 captured
  })

  it('does not take an opponent pit made odd', () => {
    const result = applyMove(pos([4, 4, 4, 4, 4, 3, 0, 4, 4, 4, 4, 4, 4, 0]), 5)!
    expect(result.capture).toBeNull()
    expect(result.position.pits[7]).toBe(5)
  })

  it('takes the opposite pit plus the own stone after landing in an own empty pit', () => {
    const result = applyMove(pos([0, 0, 1, 0, 0, 2, 10, 3, 3, 5, 3, 3, 3, 15]), 2)!
    expect(result.capture).toEqual({ kind: 'empty', pit: 9, stones: 6 })
    expect(result.position.pits[3]).toBe(0)
    expect(result.position.pits[9]).toBe(0)
    expect(result.position.pits[6]).toBe(16)
  })

  it('works the same way for the second player', () => {
    // b moves pit index 7 (1 stone) into empty index 8; opposite of 8 is index 4 with 6 stones.
    const result = applyMove(pos([1, 1, 1, 1, 6, 1, 0, 1, 0, 2, 2, 2, 2, 0], 'b'), 7)!
    expect(result.capture).toEqual({ kind: 'empty', pit: 4, stones: 7 })
    expect(result.position.pits[13]).toBe(7)
  })
})

describe('end of game', () => {
  it('gives the player who empties their pits all stones left on the other side', () => {
    const result = applyMove(pos([0, 0, 0, 0, 0, 1, 20, 2, 2, 2, 2, 2, 2, 15]), 5)!
    expect(result.over).toBe(true)
    expect(result.extraTurn).toBe(false)
    expect(result.sweep).toEqual({ to: 'w', stones: 12 })
    expect(result.position.pits).toEqual([0, 0, 0, 0, 0, 0, 33, 0, 0, 0, 0, 0, 0, 15])
    expect(winner(result.position.pits)).toBe('w')
  })

  it('applies the same rule when the opponent ran out because of a capture', () => {
    // w captures b's last stones (even rule); b's pits are now empty, so b takes w's remaining stone.
    const result = applyMove(pos([0, 0, 0, 0, 0, 3, 18, 1, 0, 0, 0, 0, 0, 26]), 5)!
    expect(result.capture).toEqual({ kind: 'even', pit: 7, stones: 2 })
    expect(result.sweep).toEqual({ to: 'b', stones: 1 })
    expect(result.position.pits[6]).toBe(21)
    expect(result.position.pits[13]).toBe(27)
    expect(winner(result.position.pits)).toBe('b')
  })

  it('is a draw at 24-24', () => {
    const result = applyMove(pos([0, 0, 0, 0, 0, 1, 22, 1, 0, 0, 0, 0, 0, 24]), 5)!
    expect(result.over).toBe(true)
    expect(winner(result.position.pits)).toBe('draw')
  })

  it('has no legal moves once the game is over', () => {
    expect(isOver([0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0, 0, 0, 18])).toBe(true)
    expect(legalMoves(pos([0, 0, 0, 0, 0, 0, 30, 1, 0, 0, 0, 0, 0, 17]))).toEqual([])
  })
})

describe('illegal moves', () => {
  it("rejects the opponent's pits, empty pits and stores", () => {
    const start = initialPosition()
    expect(applyMove(start, 7)).toBeNull()
    expect(applyMove(start, 6)).toBeNull()
    expect(applyMove(pos([0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0]), 0)).toBeNull()
  })
})

describe('position text', () => {
  it('round-trips through encode/decode', () => {
    const position = pos([1, 5, 5, 5, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], 'b')
    expect(encode(position)).toBe('b:1,5,5,5,4,4,0,4,4,4,4,4,4,0')
    expect(decode(encode(position))).toEqual(position)
  })

  it('rejects malformed text', () => {
    expect(() => decode('x:1,2')).toThrow()
    expect(() => decode('w:1,2,3')).toThrow()
  })
})

describe('random games', () => {
  // Small deterministic random generator so failures can be reproduced.
  function rng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it('always keep 48 stones, always end, and the fast move function agrees with the full one', () => {
    const random = rng(42)
    for (let game = 0; game < 300; game++) {
      let position = initialPosition()
      let plies = 0
      while (!isOver(position.pits)) {
        const moves = legalMoves(position)
        const move = moves[Math.floor(random() * moves.length)]
        const full = applyMove(position, move)!
        const fast = applyMoveFast(position.pits, position.turn, move)
        expect(fast.pits).toEqual(full.position.pits)
        expect(fast.turn).toBe(full.position.turn)
        expect(fast.over).toBe(full.over)
        expect(sum(full.position.pits)).toBe(TOTAL_STONES)
        position = full.position
        plies++
        expect(plies).toBeLessThan(400)
      }
    }
  })
})
