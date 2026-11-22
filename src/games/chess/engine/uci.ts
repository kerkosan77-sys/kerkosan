import type { Score } from '../../../core/types'

export type { Score }

export interface InfoLine {
  depth: number
  multipv: number
  score: Score
  /** Principal variation in UCI notation (e.g. "e2e4", "e7e8q"). */
  pv: string[]
  bound?: 'lower' | 'upper'
}

/** Parses a UCI "info" line. Returns null for lines without a usable score + pv. */
export function parseInfo(line: string): InfoLine | null {
  const tokens = line.trim().split(/\s+/)
  if (tokens[0] !== 'info' || tokens[1] === 'string') return null

  let depth: number | undefined
  let multipv = 1
  let score: Score | undefined
  let bound: InfoLine['bound']
  let pv: string[] = []

  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        depth = Number(tokens[++i])
        break
      case 'multipv':
        multipv = Number(tokens[++i])
        break
      case 'score': {
        const kind = tokens[++i]
        const value = Number(tokens[++i])
        if ((kind === 'cp' || kind === 'mate') && Number.isFinite(value)) {
          score = { kind, value }
        }
        if (tokens[i + 1] === 'lowerbound') {
          bound = 'lower'
          i++
        } else if (tokens[i + 1] === 'upperbound') {
          bound = 'upper'
          i++
        }
        break
      }
      case 'pv':
        pv = tokens.slice(i + 1)
        i = tokens.length
        break
    }
  }

  if (depth === undefined || !Number.isFinite(depth) || !score || pv.length === 0) return null
  const info: InfoLine = { depth, multipv, score, pv }
  if (bound) info.bound = bound
  return info
}

/** Parses "bestmove e2e4 ponder e7e5". Returns undefined if the line is not a bestmove line. */
export function parseBestMove(line: string): { move: string | null } | undefined {
  const tokens = line.trim().split(/\s+/)
  if (tokens[0] !== 'bestmove') return undefined
  const move = tokens[1]
  if (!move || move === '(none)' || move === '0000') return { move: null }
  return { move }
}

/**
 * Keeps the most useful info line per multipv slot: an exact score always wins
 * over a bound (lowerbound/upperbound) score, and newer lines replace older ones.
 */
export function mergeInfo(lines: Map<number, InfoLine>, info: InfoLine): void {
  const previous = lines.get(info.multipv)
  if (!previous || !info.bound || previous.bound) {
    lines.set(info.multipv, info)
  }
}
