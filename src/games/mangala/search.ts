import type { EngineLine, Score, Side } from '../../core/types'
import { applyMoveFast, decode, isOver } from './rules'

/**
 * Mangala engine: negamax with alpha-beta pruning, iterative deepening and a
 * transposition table. Scores are in "centi-stones" (100 = one stone ahead in
 * the stores) from the point of view of the side to move. When a move gives an
 * extra turn the same side moves again, so that child's score is not negated.
 */

const WIN = 100000
const MATE_THRESHOLD = WIN - 1000
const INF = 1_000_000_000
const EXTRA_TURN_BONUS = 15
const TT_LIMIT = 1_500_000

// Transposition table bound types.
const EXACT = 0
const LOWER = 1
const UPPER = 2

interface Entry {
  depth: number
  value: number
  flag: typeof EXACT | typeof LOWER | typeof UPPER
  best: number
}

class Aborted extends Error {}

const other = (side: Side): Side => (side === 'w' ? 'b' : 'w')
const STORE_W = 6
const STORE_B = 13

function storeOf(side: Side) {
  return side === 'w' ? STORE_W : STORE_B
}

function pitsOf(side: Side): number[] {
  return side === 'w' ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]
}

/** Number of moves that would end in the player's own store (free extra turns). */
function extraTurnMoves(pits: number[], side: Side): number {
  const store = storeOf(side)
  let count = 0
  for (const i of pitsOf(side)) {
    const stones = pits[i]
    if (stones === 0) continue
    const distance = store - i
    if ((stones === 1 && distance === 1) || (stones > 1 && stones - 1 === distance)) count++
  }
  return count
}

export function evaluate(pits: number[], turn: Side): number {
  const opp = other(turn)
  return (
    (pits[storeOf(turn)] - pits[storeOf(opp)]) * 100 +
    EXTRA_TURN_BONUS * (extraTurnMoves(pits, turn) - extraTurnMoves(pits, opp))
  )
}

function legal(pits: number[], side: Side): number[] {
  return pitsOf(side).filter((i) => pits[i] > 0)
}

function keyOf(pits: number[], turn: Side): string {
  return turn + pits.join(',')
}

export interface SearchOptions {
  depth: number
  multiPV?: number
  /** Safety limit; the result of the last fully searched depth is returned when it is hit. */
  maxNodes?: number
}

export interface RootLine {
  move: number
  value: number
  pv: number[]
}

export class Searcher {
  private tt = new Map<string, Entry>()
  nodes = 0
  private budget = Infinity

  private search(pits: number[], turn: Side, depth: number, alpha: number, beta: number, ply: number): number {
    if (++this.nodes > this.budget) throw new Aborted()
    if (depth === 0) return evaluate(pits, turn)

    const key = keyOf(pits, turn)
    const entry = this.tt.get(key)
    if (entry && entry.depth >= depth) {
      if (entry.flag === EXACT) return entry.value
      if (entry.flag === LOWER) alpha = Math.max(alpha, entry.value)
      else beta = Math.min(beta, entry.value)
      if (alpha >= beta) return entry.value
    }

    const moves = this.order(pits, turn, entry?.best ?? -1)
    const alphaStart = alpha
    let best = -INF
    let bestMove = -1
    for (const move of moves) {
      const value = this.child(pits, turn, move, depth, alpha, beta, ply)
      if (value > best) {
        best = value
        bestMove = move
      }
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }

    if (this.tt.size > TT_LIMIT) this.tt.clear()
    this.tt.set(key, {
      depth,
      value: best,
      best: bestMove,
      flag: best <= alphaStart ? UPPER : best >= beta ? LOWER : EXACT,
    })
    return best
  }

  /** Value of playing `move`, from the mover's point of view. */
  private child(pits: number[], turn: Side, move: number, depth: number, alpha: number, beta: number, ply: number): number {
    const next = applyMoveFast(pits, turn, move)
    if (next.over) {
      const diff = next.pits[storeOf(turn)] - next.pits[storeOf(other(turn))]
      return diff > 0 ? WIN - (ply + 1) : diff < 0 ? -(WIN - (ply + 1)) : 0
    }
    if (next.turn === turn) return this.search(next.pits, turn, depth - 1, alpha, beta, ply + 1)
    return -this.search(next.pits, next.turn, depth - 1, -beta, -alpha, ply + 1)
  }

  /** Previous best first, then moves that give an extra turn, then the pits nearest the store. */
  private order(pits: number[], turn: Side, ttBest: number): number[] {
    const store = storeOf(turn)
    const moves = legal(pits, turn)
    const rank = (i: number) => {
      if (i === ttBest) return -2
      const stones = pits[i]
      const distance = store - i
      if ((stones === 1 && distance === 1) || (stones > 1 && stones - 1 === distance)) return -1
      return distance
    }
    return moves.sort((a, b) => rank(a) - rank(b))
  }

  private principalVariation(pits: number[], turn: Side, maxLength: number): number[] {
    const pv: number[] = []
    let current = { pits, turn, over: isOver(pits) }
    while (pv.length < maxLength && !current.over) {
      const entry = this.tt.get(keyOf(current.pits, current.turn))
      if (!entry || entry.best < 0 || current.pits[entry.best] === 0) break
      pv.push(entry.best)
      current = applyMoveFast(current.pits, current.turn, entry.best)
    }
    return pv
  }

  /** Scores the root moves. With multiPV > 1 every move gets an exact score. */
  analyze(pits: number[], turn: Side, options: SearchOptions): RootLine[] {
    if (isOver(pits)) return []
    const multiPV = Math.max(1, options.multiPV ?? 1)
    this.nodes = 0
    this.budget = options.maxNodes ?? Infinity
    let completed: RootLine[] = []
    let previousBest = -1

    for (let depth = 1; depth <= options.depth; depth++) {
      try {
        const moves = this.order(pits, turn, previousBest)
        const scored: { move: number; value: number }[] = []
        if (multiPV === 1) {
          let alpha = -INF
          for (const move of moves) {
            const value = this.child(pits, turn, move, depth, alpha, INF, 0)
            if (value > alpha || scored.length === 0) {
              alpha = Math.max(alpha, value)
              scored.unshift({ move, value })
            }
          }
          scored.splice(1)
        } else {
          for (const move of moves) scored.push({ move, value: this.child(pits, turn, move, depth, -INF, INF, 0) })
          scored.sort((a, b) => b.value - a.value)
        }
        completed = scored.slice(0, multiPV).map(({ move, value }) => {
          const next = applyMoveFast(pits, turn, move)
          return { move, value, pv: [move, ...this.principalVariation(next.pits, next.turn, depth - 1)] }
        })
        previousBest = completed[0]?.move ?? -1
        // A forced result is already exact; searching deeper changes nothing.
        if (completed.length > 0 && Math.abs(completed[0].value) >= MATE_THRESHOLD && multiPV === 1) break
      } catch (error) {
        if (error instanceof Aborted) break
        throw error
      }
    }
    return completed
  }
}

export function toScore(value: number): Score {
  if (Math.abs(value) >= MATE_THRESHOLD) {
    const plies = Math.max(1, WIN - Math.abs(value))
    return { kind: 'mate', value: value > 0 ? plies : -plies }
  }
  return { kind: 'cp', value }
}

/** Engine lines for a position string (used by the Web Worker and by tests). */
export function analyzePosition(position: string, options: SearchOptions): EngineLine[] {
  const { pits, turn } = decode(position)
  const lines = new Searcher().analyze(pits, turn, { maxNodes: 4_000_000, ...options })
  return lines.map((line) => ({ score: toScore(line.value), pv: line.pv.map(String) }))
}
