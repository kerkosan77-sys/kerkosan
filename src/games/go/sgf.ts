import type { Side } from '../../core/types'
import { PASS_MOVE, coordOf, indexOf } from './rules'

/**
 * SGF (Smart Game Format), the standard file format for Go games. Games are stored in SGF
 * so they can be opened in any Go program; only the main line of a file is read.
 */

export type SgfNode = Record<string, string[]>

export interface SgfMove {
  side: Side
  /** "D4" or "pass". */
  move: string
}

export interface SgfGame {
  size: number
  komi: number | null
  /** Root properties such as PB, PW, RE, DT (first value of each). */
  info: Record<string, string>
  /** Stones placed before the first move (handicap or setup), plain indices. */
  setup: { black: number[]; white: number[] }
  /** Side to move first when the file says so (PL). */
  firstPlayer: Side | null
  moves: SgfMove[]
  /** Stones marked dead at the end (DD on the last node), plain indices; null if not given. */
  dead: number[] | null
}

/** Reads the main line of an SGF file into a list of nodes. */
export function parseSgfNodes(text: string): SgfNode[] {
  let i = text.indexOf('(')
  if (i < 0) throw new Error('Bu bir SGF dosyası gibi görünmüyor. "(;" ile başlamalı.')

  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i])) i++
  }

  const readValue = (): string => {
    i++ // [
    let out = ''
    while (i < text.length && text[i] !== ']') {
      if (text[i] === '\\') i++
      out += text[i] ?? ''
      i++
    }
    i++ // ]
    return out
  }

  const readNode = (): SgfNode => {
    i++ // ;
    const node: SgfNode = {}
    for (;;) {
      skipSpace()
      let name = ''
      while (i < text.length && /[A-Za-z]/.test(text[i])) {
        if (text[i] >= 'A' && text[i] <= 'Z') name += text[i]
        i++
      }
      if (!name) break
      skipSpace()
      const values: string[] = []
      while (text[i] === '[') {
        values.push(readValue())
        skipSpace()
      }
      node[name] = [...(node[name] ?? []), ...values]
    }
    return node
  }

  const readTree = (): SgfNode[] => {
    i++ // (
    const nodes: SgfNode[] = []
    skipSpace()
    while (text[i] === ';') {
      nodes.push(readNode())
      skipSpace()
    }
    let mainLine: SgfNode[] | null = null
    while (text[i] === '(') {
      const variation = readTree()
      if (!mainLine) mainLine = variation
      skipSpace()
    }
    if (text[i] === ')') i++
    return mainLine ? nodes.concat(mainLine) : nodes
  }

  return readTree()
}

/** "dd" -> plain index; "" or "tt" (old style) -> pass. */
function sgfPoint(value: string, size: number): number | null {
  if (value === '' || (value === 'tt' && size <= 19)) return null
  const x = value.charCodeAt(0) - 97
  const y = value.charCodeAt(1) - 97
  if (!(x >= 0 && x < size && y >= 0 && y < size)) throw new Error(`SGF dosyasında geçersiz nokta: ${value}`)
  return y * size + x
}

/** Point lists, including compressed rectangles like "aa:cc". */
function sgfPoints(values: string[] | undefined, size: number): number[] {
  const out: number[] = []
  for (const value of values ?? []) {
    const [from, to] = value.split(':')
    const a = sgfPoint(from, size)
    if (a === null) continue
    const b = to ? sgfPoint(to, size) : a
    if (b === null) continue
    const [x1, y1, x2, y2] = [a % size, Math.floor(a / size), b % size, Math.floor(b / size)]
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) out.push(y * size + x)
    }
  }
  return out
}

export function parseSgf(text: string): SgfGame {
  const nodes = parseSgfNodes(text)
  if (nodes.length === 0) throw new Error('SGF dosyası boş.')
  const root = nodes[0]
  if (root.GM && root.GM[0] !== '1') throw new Error('Bu SGF dosyası bir Go oyunu değil.')
  const size = Number((root.SZ?.[0] ?? '19').split(':')[0])
  if (!Number.isInteger(size) || size < 2 || size > 19) throw new Error(`Desteklenmeyen tahta boyutu: ${root.SZ?.[0]}`)

  const info: Record<string, string> = {}
  for (const [key, values] of Object.entries(root)) if (values.length > 0) info[key] = values[0]
  const komiValue = root.KM ? Number(root.KM[0]) : NaN

  const black = sgfPoints(root.AB, size)
  const white = sgfPoints(root.AW, size)
  const moves: SgfMove[] = []
  let dead: number[] | null = null
  nodes.forEach((node, k) => {
    if (k > 0 && (node.AB || node.AW)) {
      // Setup stones in the middle of a game are not supported; they are rare in real games.
      throw new Error('Bu SGF dosyasında oyun ortasında taş yerleştirme var; bu desteklenmiyor.')
    }
    for (const [key, side] of [
      ['B', 'w'],
      ['W', 'b'],
    ] as const) {
      const value = node[key]?.[0]
      if (value === undefined) continue
      const point = sgfPoint(value, size)
      moves.push({ side, move: point === null ? PASS_MOVE : coordOf(point, size) })
    }
    if (node.DD) dead = sgfPoints(node.DD, size)
  })

  const player = root.PL?.[0]?.toUpperCase()
  return {
    size,
    komi: Number.isFinite(komiValue) ? komiValue : null,
    info,
    setup: { black, white },
    firstPlayer: player === 'B' ? 'w' : player === 'W' ? 'b' : null,
    moves,
    dead,
  }
}

const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/]/g, '\\]')

function toSgfPoint(index: number, size: number): string {
  const x = index % size
  const y = (index - x) / size
  return String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
}

export interface SgfWriteInput {
  size: number
  komi: number
  /** Extra root properties (PB, PW, DT, RE...). */
  info?: Record<string, string>
  setup?: { black: number[]; white: number[] }
  moves: SgfMove[]
  dead?: number[] | null
}

export function writeSgf(game: SgfWriteInput): string {
  const root: string[] = [`GM[1]FF[4]CA[UTF-8]AP[Akil Oyunlari Kocu]SZ[${game.size}]KM[${game.komi}]RU[Chinese]`]
  for (const [key, value] of Object.entries(game.info ?? {})) root.push(`${key}[${escape(value)}]`)
  if (game.setup?.black.length) root.push(`AB${game.setup.black.map((p) => `[${toSgfPoint(p, game.size)}]`).join('')}`)
  if (game.setup?.white.length) root.push(`AW${game.setup.white.map((p) => `[${toSgfPoint(p, game.size)}]`).join('')}`)
  const moveNodes = game.moves.map(({ side, move }) => {
    const point = move === PASS_MOVE ? null : indexOf(move, game.size)
    return `;${side === 'w' ? 'B' : 'W'}[${point === null ? '' : toSgfPoint(point, game.size)}]`
  })
  if (game.dead && game.dead.length > 0) {
    const dd = `DD${game.dead.map((p) => `[${toSgfPoint(p, game.size)}]`).join('')}`
    if (moveNodes.length > 0) moveNodes[moveNodes.length - 1] += dd
    else root.push(dd)
  }
  return `(;${root.join('')}\n${moveNodes.join('')})`
}
