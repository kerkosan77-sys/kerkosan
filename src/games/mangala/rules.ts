/**
 * Turkish Mangala rules (MEB / federation version):
 * - 2 x 6 pits with 4 stones each, one store (hazine) per player.
 * - Take all stones from one of your pits; the first goes back into the same pit, the rest
 *   are sown counterclockwise. A single stone simply moves to the next pit.
 * - Your own store is sown into, the opponent's store is skipped.
 * - Last stone in your store: you move again.
 * - Last stone makes an opponent pit even: you take all stones in it.
 * - Last stone lands in your own empty pit and the opposite pit has stones: you take both.
 * - When a player's pits are empty the game ends and that player takes every stone still in the
 *   opponent's pits. Most stones wins, 24-24 is a draw.
 *
 * Board indices run counterclockwise: 0-5 first player's pits (left to right from their seat),
 * 6 first player's store, 7-12 second player's pits, 13 second player's store.
 */
import type { Side } from '../../core/types'

export const PITS_PER_SIDE = 6
export const START_STONES = 4
export const TOTAL_STONES = 2 * PITS_PER_SIDE * START_STONES
export const STORE: Record<Side, number> = { w: 6, b: 13 }

export interface Position {
  /** 14 numbers, see the index layout above. */
  pits: number[]
  turn: Side
}

export interface Capture {
  kind: 'even' | 'empty'
  /** The pit the stones were taken from (the opponent's pit). */
  pit: number
  stones: number
}

export interface MoveResult {
  position: Position
  mover: Side
  /** Pits (and store) that received a stone, in order. */
  path: number[]
  extraTurn: boolean
  capture: Capture | null
  /** End-of-game sweep: who took the stones left in the other player's pits. */
  sweep: { to: Side; stones: number } | null
  over: boolean
}

const other = (side: Side): Side => (side === 'w' ? 'b' : 'w')

export function initialPosition(): Position {
  const pits = Array<number>(14).fill(START_STONES)
  pits[STORE.w] = 0
  pits[STORE.b] = 0
  return { pits, turn: 'w' }
}

/** Pit indices of a side, from that player's left to right (the sowing direction). */
export function pitIndices(side: Side): number[] {
  const base = side === 'w' ? 0 : 7
  return [0, 1, 2, 3, 4, 5].map((i) => base + i)
}

export function sideOf(index: number): Side | null {
  if (index >= 0 && index <= 5) return 'w'
  if (index >= 7 && index <= 12) return 'b'
  return null
}

/** The pit facing `index` across the board. */
export const oppositePit = (index: number) => 12 - index

/** Pit number 1-6 from its owner's point of view. */
export function pitNumber(index: number): number {
  return sideOf(index) === 'b' ? index - 6 : index + 1
}

export function sideStones(pits: number[], side: Side): number {
  return pitIndices(side).reduce((sum, i) => sum + pits[i], 0)
}

export function isOver(pits: number[]): boolean {
  return sideStones(pits, 'w') === 0 || sideStones(pits, 'b') === 0
}

export function legalMoves(position: Position): number[] {
  if (isOver(position.pits)) return []
  return pitIndices(position.turn).filter((i) => position.pits[i] > 0)
}

/** Winner by stones in the stores (meaningful once the game is over). */
export function winner(pits: number[]): Side | 'draw' {
  if (pits[STORE.w] === pits[STORE.b]) return 'draw'
  return pits[STORE.w] > pits[STORE.b] ? 'w' : 'b'
}

function nextIndex(index: number, skip: number): number {
  let next = (index + 1) % 14
  if (next === skip) next = (next + 1) % 14
  return next
}

/** Plays a move (a pit index of the side to move). Returns null if it is not legal. */
export function applyMove(position: Position, index: number): MoveResult | null {
  const me = position.turn
  const opp = other(me)
  if (sideOf(index) !== me || position.pits[index] <= 0 || isOver(position.pits)) return null

  const pits = position.pits.slice()
  const stones = pits[index]
  pits[index] = 0
  const skip = STORE[opp]
  const path: number[] = []
  // With several stones the first one goes back into the starting pit; a single stone moves on.
  let current = stones > 1 ? index : nextIndex(index, skip)
  for (let k = 0; k < stones; k++) {
    if (k > 0) current = nextIndex(current, skip)
    pits[current]++
    path.push(current)
  }
  const last = current
  const extraTurn = last === STORE[me]

  let capture: Capture | null = null
  if (!extraTurn) {
    if (sideOf(last) === opp && pits[last] % 2 === 0) {
      capture = { kind: 'even', pit: last, stones: pits[last] }
      pits[STORE[me]] += pits[last]
      pits[last] = 0
    } else if (sideOf(last) === me && pits[last] === 1 && pits[oppositePit(last)] > 0) {
      const across = oppositePit(last)
      capture = { kind: 'empty', pit: across, stones: pits[across] + 1 }
      pits[STORE[me]] += pits[across] + 1
      pits[last] = 0
      pits[across] = 0
    }
  }

  let sweep: MoveResult['sweep'] = null
  const over = isOver(pits)
  if (over) {
    // The player whose pits ran out takes everything left on the other side.
    const emptied: Side = sideStones(pits, me) === 0 ? me : opp
    const full = other(emptied)
    const left = sideStones(pits, full)
    if (left > 0) {
      for (const i of pitIndices(full)) pits[i] = 0
      pits[STORE[emptied]] += left
      sweep = { to: emptied, stones: left }
    }
  }

  return {
    position: { pits, turn: over || extraTurn ? me : opp },
    mover: me,
    path,
    extraTurn: extraTurn && !over,
    capture,
    sweep,
    over,
  }
}

/**
 * Same rules as applyMove without the bookkeeping, for the search's inner loop.
 * The caller guarantees the move is legal. (Kept in sync with applyMove by a unit test.)
 */
export function applyMoveFast(pits: number[], turn: Side, index: number): { pits: number[]; turn: Side; over: boolean } {
  const me = turn
  const opp: Side = me === 'w' ? 'b' : 'w'
  const next = pits.slice()
  const myStore = me === 'w' ? 6 : 13
  const skip = me === 'w' ? 13 : 6
  let stones = next[index]
  next[index] = 0
  let current = index
  if (stones === 1) {
    current = current + 1 === skip ? (current + 2) % 14 : (current + 1) % 14
    next[current]++
  } else {
    next[current]++
    stones--
    while (stones > 0) {
      current = (current + 1) % 14
      if (current === skip) current = (current + 1) % 14
      next[current]++
      stones--
    }
  }
  const extraTurn = current === myStore
  if (!extraTurn) {
    const lastSide = current <= 5 ? 'w' : current >= 7 && current <= 12 ? 'b' : null
    if (lastSide === opp && next[current] % 2 === 0) {
      next[myStore] += next[current]
      next[current] = 0
    } else if (lastSide === me && next[current] === 1 && next[12 - current] > 0) {
      next[myStore] += next[12 - current] + 1
      next[current] = 0
      next[12 - current] = 0
    }
  }
  const wLeft = next[0] + next[1] + next[2] + next[3] + next[4] + next[5]
  const bLeft = next[7] + next[8] + next[9] + next[10] + next[11] + next[12]
  if (wLeft === 0 || bLeft === 0) {
    const meLeft = me === 'w' ? wLeft : bLeft
    const emptied: Side = meLeft === 0 ? me : opp
    if (emptied === 'w') {
      next[6] += bLeft
      for (let i = 7; i <= 12; i++) next[i] = 0
    } else {
      next[13] += wLeft
      for (let i = 0; i <= 5; i++) next[i] = 0
    }
    return { pits: next, turn: me, over: true }
  }
  return { pits: next, turn: extraTurn ? me : opp, over: false }
}

/** "w:4,4,4,4,4,4,0,4,4,4,4,4,4,0" */
export function encode(position: Position): string {
  return `${position.turn}:${position.pits.join(',')}`
}

export function decode(text: string): Position {
  const match = /^([wb]):((?:\d+,){13}\d+)$/.exec(text.trim())
  if (!match) throw new Error(`Geçersiz Mangala pozisyonu: ${text}`)
  const pits = match[2].split(',').map(Number)
  return { turn: match[1] as Side, pits }
}
