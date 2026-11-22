import type { EngineLine, Score } from './types'

/**
 * Generic negamax search with alpha-beta pruning, iterative deepening and a transposition table,
 * shared by the board games whose engines are written for this app (Dama, Reversi).
 * Values are from the point of view of the side to move; a won game is WIN - ply so that
 * quicker wins score higher.
 */

export const WIN = 100000
export const MATE_THRESHOLD = WIN - 1000
const INF = 1_000_000_000
const TT_LIMIT = 1_000_000
/** Hard limit for searching on past the nominal depth (forced captures). */
const MAX_PLY = 60

export interface SearchGame<P, M> {
  moves(position: P): M[]
  play(position: P, move: M): P
  code(move: M): string
  /** Transposition-table key (a string, or a 53-bit hash number). */
  key(position: P): string | number
  /** Value for the side to move if the game is over here (given its legal moves), otherwise null. */
  terminal(position: P, moves: M[], ply: number): number | null
  evaluate(position: P): number
  /** Positions that must be searched further at depth 0 (pending captures). */
  noisy?(position: P, moves: M[]): boolean
  /** Rough move order, best first (the previous best move is always tried first). */
  order?(position: P, moves: M[]): M[]
  /**
   * The side to move, for games where a player may move twice in a row (the opponent has to pass):
   * a child with the same side to move is then not negated.
   */
  side?(position: P): string
}

const EXACT = 0
const LOWER = 1
const UPPER = 2

interface Entry {
  depth: number
  value: number
  flag: number
  best: string
}

class Aborted extends Error {}

export interface SearchOptions {
  depth: number
  multiPV?: number
  /** Safety limits; the result of the last fully searched depth is returned when one is hit. */
  maxNodes?: number
  maxMs?: number
}

export interface RootLine {
  move: string
  value: number
  pv: string[]
}

export class AlphaBeta<P, M> {
  private tt = new Map<string | number, Entry>()
  nodes = 0
  private budget = Infinity
  private deadline = Infinity
  private readonly game: SearchGame<P, M>

  constructor(game: SearchGame<P, M>) {
    this.game = game
  }

  private ordered(position: P, moves: M[], best: string | undefined): M[] {
    const list = this.game.order ? this.game.order(position, moves) : moves.slice()
    if (best) {
      const i = list.findIndex((m) => this.game.code(m) === best)
      if (i > 0) list.unshift(...list.splice(i, 1))
    }
    return list
  }

  /** Value of a child position for the parent's side to move, searched with the window (alpha, beta). */
  private child(parent: P, child: P, depth: number, alpha: number, beta: number, ply: number): number {
    if (this.game.side && this.game.side(child) === this.game.side(parent)) return this.search(child, depth, alpha, beta, ply)
    return -this.search(child, depth, -beta, -alpha, ply)
  }

  private search(position: P, depth: number, alpha: number, beta: number, ply: number): number {
    if (++this.nodes > this.budget) throw new Aborted()
    if ((this.nodes & 1023) === 0 && Date.now() > this.deadline) throw new Aborted()
    const moves = this.game.moves(position)
    const end = this.game.terminal(position, moves, ply)
    if (end !== null) return end
    if (depth <= 0 && (ply >= MAX_PLY || !this.game.noisy?.(position, moves))) return this.game.evaluate(position)

    const key = this.game.key(position)
    const entry = this.tt.get(key)
    if (entry && entry.depth >= depth) {
      if (entry.flag === EXACT) return entry.value
      if (entry.flag === LOWER) alpha = Math.max(alpha, entry.value)
      else beta = Math.min(beta, entry.value)
      if (alpha >= beta) return entry.value
    }

    const alphaStart = alpha
    let best = -INF
    let bestMove = ''
    let first = true
    for (const move of this.ordered(position, moves, entry?.best)) {
      const child = this.game.play(position, move)
      let value: number
      if (first) {
        value = this.child(position, child, depth - 1, alpha, beta, ply + 1)
      } else {
        // Principal variation search: prove the move is not better with a null window first.
        value = this.child(position, child, depth - 1, alpha, alpha + 1, ply + 1)
        if (value > alpha && value < beta) value = this.child(position, child, depth - 1, alpha, beta, ply + 1)
      }
      first = false
      if (value > best) {
        best = value
        bestMove = this.game.code(move)
      }
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }

    if (this.tt.size > TT_LIMIT) this.tt.clear()
    this.tt.set(key, { depth, value: best, best: bestMove, flag: best <= alphaStart ? UPPER : best >= beta ? LOWER : EXACT })
    return best
  }

  private principalVariation(position: P, maxLength: number): string[] {
    const pv: string[] = []
    let current = position
    for (let i = 0; i < maxLength; i++) {
      const entry = this.tt.get(this.game.key(current))
      if (!entry?.best) break
      const moves = this.game.moves(current)
      if (this.game.terminal(current, moves, 0) !== null) break
      const move = moves.find((m) => this.game.code(m) === entry.best)
      if (!move) break
      pv.push(entry.best)
      current = this.game.play(current, move)
    }
    return pv
  }

  /**
   * Scores the root moves, best first. The best `multiPV` moves get exact scores; every other move
   * is only proved not to beat them (a cheap null-window search).
   */
  analyze(root: P, options: SearchOptions): RootLine[] {
    const moves = this.game.moves(root)
    if (moves.length === 0 || this.game.terminal(root, moves, 0) !== null) return []
    const multiPV = Math.min(Math.max(1, options.multiPV ?? 1), moves.length)
    this.nodes = 0
    this.budget = options.maxNodes ?? Infinity
    this.deadline = options.maxMs ? Date.now() + options.maxMs : Infinity
    let order = this.ordered(root, moves, undefined)
    let completed: RootLine[] = []

    for (let depth = 1; depth <= options.depth; depth++) {
      try {
        const exact: { move: M; value: number }[] = []
        const bounded: { move: M; value: number }[] = []
        for (const move of order) {
          const floor = exact.length >= multiPV ? exact[multiPV - 1].value : -INF
          const value = this.child(root, this.game.play(root, move), depth - 1, floor, INF, 1)
          if (value > floor) {
            exact.push({ move, value })
            exact.sort((x, y) => y.value - x.value)
            if (exact.length > multiPV) bounded.push(exact.pop()!)
          } else {
            bounded.push({ move, value })
          }
        }
        bounded.sort((x, y) => y.value - x.value)
        order = [...exact, ...bounded].map((entry) => entry.move)
        completed = exact.map(({ move, value }) => {
          const code = this.game.code(move)
          return { move: code, value, pv: [code, ...this.principalVariation(this.game.play(root, move), depth + 2)] }
        })
        // A forced result is already exact; searching deeper changes nothing.
        if (multiPV === 1 && Math.abs(completed[0].value) >= MATE_THRESHOLD) break
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

export function toEngineLines(lines: RootLine[]): EngineLine[] {
  return lines.map((line) => ({ score: toScore(line.value), pv: line.pv }))
}
