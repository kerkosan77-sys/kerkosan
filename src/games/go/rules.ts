import type { Side } from '../../core/types'
import { BLACK, DEFAULT_KOMI, EMPTY, FastBoard, PASS, WHITE, estimateOwnership, hashString } from './fastboard'

/**
 * Go rules: Chinese (area) scoring, komi 7.5 for white, simple ko, no suicide,
 * two passes in a row end the game. Black moves first, so black is Side 'w'.
 */

export const BOARD_SIZE = 9
export const COLUMNS = 'ABCDEFGHJKLMNOPQRST'
export const PASS_MOVE = 'pass'

export interface GoPosition {
  size: number
  /** Index y * size + x, y = 0 is the top row. 0 empty, 1 black, 2 white. */
  board: Uint8Array
  turn: Side
  /** Point the side to move may not play because of ko, or -1. */
  ko: number
  /** Consecutive passes just before this position (2 = game over). */
  passes: number
  komi: number
}

export const colorOf = (side: Side): number => (side === 'w' ? BLACK : WHITE)
export const sideOf = (color: number): Side => (color === BLACK ? 'w' : 'b')
export const COLOR_NAMES: Record<Side, string> = { w: 'Siyah', b: 'Beyaz' }

export function initialPosition(size = BOARD_SIZE, komi = DEFAULT_KOMI): GoPosition {
  return { size, board: new Uint8Array(size * size), turn: 'w', ko: -1, passes: 0, komi }
}

/** "D4" for the point in column D, row 4 (rows counted from the bottom, no letter I). */
export function coordOf(index: number, size: number): string {
  const x = index % size
  const y = (index - x) / size
  return `${COLUMNS[x]}${size - y}`
}

export function indexOf(coord: string, size: number): number | null {
  const match = /^([A-HJ-T])(\d{1,2})$/i.exec(coord.trim())
  if (!match) return null
  const x = COLUMNS.indexOf(match[1].toUpperCase())
  const row = Number(match[2])
  if (x < 0 || x >= size || row < 1 || row > size) return null
  return (size - row) * size + x
}

const STONE_CHARS = ['.', 'x', 'o']

/** "x ........./........./... - 0 7.5": side to move, rows from the top, ko point, passes, komi. */
export function encode(position: GoPosition): string {
  const { size, board } = position
  const rows: string[] = []
  for (let y = 0; y < size; y++) {
    let row = ''
    for (let x = 0; x < size; x++) row += STONE_CHARS[board[y * size + x]]
    rows.push(row)
  }
  const ko = position.ko >= 0 ? coordOf(position.ko, size) : '-'
  return `${position.turn === 'w' ? 'x' : 'o'} ${rows.join('/')} ${ko} ${position.passes} ${position.komi}`
}

export function decode(text: string): GoPosition {
  const [turn, rowsText, koText = '-', passesText = '0', komiText] = text.trim().split(/\s+/)
  const rows = (rowsText ?? '').split('/')
  const size = rows.length
  if ((turn !== 'x' && turn !== 'o') || size < 2 || size > 19 || rows.some((row) => row.length !== size)) {
    throw new Error(`Geçersiz Go pozisyonu: ${text}`)
  }
  const board = new Uint8Array(size * size)
  rows.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      const value = STONE_CHARS.indexOf(row[x])
      if (value < 0) throw new Error(`Geçersiz Go pozisyonu: ${text}`)
      board[y * size + x] = value
    }
  })
  const ko = koText === '-' ? -1 : (indexOf(koText, size) ?? -1)
  const komi = komiText === undefined ? DEFAULT_KOMI : Number(komiText)
  return { size, board, turn: turn === 'x' ? 'w' : 'b', ko, passes: Number(passesText) || 0, komi: Number.isFinite(komi) ? komi : DEFAULT_KOMI }
}

export function toFast(position: GoPosition): FastBoard {
  const fast = new FastBoard(position.size)
  for (let i = 0; i < position.board.length; i++) {
    if (position.board[i] !== EMPTY) fast.setPoint(fast.fast(i), position.board[i])
  }
  fast.turn = colorOf(position.turn)
  fast.ko = position.ko >= 0 ? fast.fast(position.ko) : -1
  fast.passes = position.passes
  fast.komi = position.komi
  return fast
}

export function fromFast(fast: FastBoard): GoPosition {
  const size = fast.size
  const board = new Uint8Array(size * size)
  for (let i = 0; i < board.length; i++) board[i] = fast.cells[fast.fast(i)]
  return {
    size,
    board,
    turn: sideOf(fast.turn),
    ko: fast.ko >= 0 ? fast.plain(fast.ko) : -1,
    passes: fast.passes,
    komi: fast.komi,
  }
}

export interface GoMoveResult {
  position: GoPosition
  mover: Side
  pass: boolean
  /** Point played (plain index), or -1 for a pass. */
  point: number
  /** Opponent stones taken off the board (plain indices). */
  captured: number[]
  /** Both players passed: the game is over and gets counted. */
  over: boolean
}

/** Plays "D4" or "pass" for the side to move. Null if the move is not allowed. */
export function applyMove(position: GoPosition, move: string): GoMoveResult | null {
  if (position.passes >= 2) return null
  const fast = toFast(position)
  const mover = position.turn
  if (move === PASS_MOVE) {
    fast.play(PASS)
    const next = fromFast(fast)
    return { position: next, mover, pass: true, point: -1, captured: [], over: next.passes >= 2 }
  }
  const point = indexOf(move, position.size)
  if (point === null) return null
  const p = fast.fast(point)
  if (!fast.isLegal(p, fast.turn)) return null
  fast.play(p)
  const next = fromFast(fast)
  const opponent = colorOf(mover === 'w' ? 'b' : 'w')
  const captured: number[] = []
  for (let i = 0; i < next.board.length; i++) {
    if (position.board[i] === opponent && next.board[i] === EMPTY) captured.push(i)
  }
  return { position: next, mover, pass: false, point, captured, over: false }
}

/** "D4", "D4 (+2 taş)", "Pas", "Pas (oyun bitti)" */
export function labelFor(result: GoMoveResult): string {
  if (result.pass) return result.over ? 'Pas (oyun bitti)' : 'Pas'
  const label = coordOf(result.point, result.position.size)
  return result.captured.length > 0 ? `${label} (+${result.captured.length} taş)` : label
}

/** Label of a move in a position ("D4 (+2 taş)"), or the move code itself if it cannot be played. */
export function moveLabelAt(position: string, move: string): string {
  try {
    const result = applyMove(decode(position), move)
    return result ? labelFor(result) : move
  } catch {
    return move
  }
}

/** Points the side to move may play (plain indices). Passing is always allowed as well. */
export function legalPoints(position: GoPosition): number[] {
  if (position.passes >= 2) return []
  const fast = toFast(position)
  const out: number[] = []
  for (let i = 0; i < position.board.length; i++) {
    if (position.board[i] === EMPTY && fast.isLegal(fast.fast(i), fast.turn)) out.push(i)
  }
  return out
}

export function neighbours(index: number, size: number): number[] {
  const x = index % size
  const y = (index - x) / size
  const out: number[] = []
  if (x > 0) out.push(index - 1)
  if (x < size - 1) out.push(index + 1)
  if (y > 0) out.push(index - size)
  if (y < size - 1) out.push(index + size)
  return out
}

export interface Group {
  color: number
  stones: number[]
  liberties: number[]
}

/** The connected group of stones at `index` and its liberties (plain indices). */
export function groupAt(board: Uint8Array, size: number, index: number): Group | null {
  const color = board[index]
  if (color === EMPTY) return null
  const seen = new Set<number>([index])
  const liberties = new Set<number>()
  const stones = [index]
  for (let i = 0; i < stones.length; i++) {
    for (const n of neighbours(stones[i], size)) {
      if (board[n] === EMPTY) liberties.add(n)
      else if (board[n] === color && !seen.has(n)) {
        seen.add(n)
        stones.push(n)
      }
    }
  }
  return { color, stones, liberties: [...liberties] }
}

/** All groups on the board. */
export function allGroups(board: Uint8Array, size: number): Group[] {
  const seen = new Uint8Array(board.length)
  const groups: Group[] = []
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY || seen[i]) continue
    const group = groupAt(board, size, i)!
    for (const s of group.stones) seen[s] = 1
    groups.push(group)
  }
  return groups
}

export interface AreaScore {
  /** Black's area: living stones plus surrounded empty points. */
  black: number
  white: number
  komi: number
  /** black - white - komi: positive means black wins. */
  margin: number
  /** Owner of every point after removing dead stones: 1 black, 2 white, 0 nobody. */
  owner: Uint8Array
  /** Stones counted as dead (plain indices). */
  dead: number[]
}

/** Chinese area count with the given stones taken off as dead. */
export function areaScore(position: GoPosition, dead: number[]): AreaScore {
  const { size } = position
  const board = position.board.slice()
  for (const index of dead) board[index] = EMPTY
  const owner = new Uint8Array(board.length)
  const seen = new Uint8Array(board.length)
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) {
      owner[i] = board[i]
      continue
    }
    if (seen[i]) continue
    const region = [i]
    seen[i] = 1
    let touchesBlack = false
    let touchesWhite = false
    for (let k = 0; k < region.length; k++) {
      for (const n of neighbours(region[k], size)) {
        if (board[n] === BLACK) touchesBlack = true
        else if (board[n] === WHITE) touchesWhite = true
        else if (!seen[n]) {
          seen[n] = 1
          region.push(n)
        }
      }
    }
    const regionOwner = touchesBlack && !touchesWhite ? BLACK : touchesWhite && !touchesBlack ? WHITE : EMPTY
    for (const r of region) owner[r] = regionOwner
  }
  let black = 0
  let white = 0
  for (const o of owner) {
    if (o === BLACK) black++
    else if (o === WHITE) white++
  }
  return { black, white, komi: position.komi, margin: black - white - position.komi, owner, dead: [...dead].sort((a, b) => a - b) }
}

const OWNERSHIP_PLAYOUTS = 400
const ownershipCache = new Map<string, Float32Array>()

/** Average owner of each point (+1 black, -1 white) from random playouts. Deterministic and cached. */
export function ownershipOf(position: GoPosition): Float32Array {
  const key = encode(position)
  const cached = ownershipCache.get(key)
  if (cached) return cached
  const ownership = estimateOwnership(toFast(position), OWNERSHIP_PLAYOUTS, hashString(key))
  if (ownershipCache.size > 40) ownershipCache.delete(ownershipCache.keys().next().value as string)
  ownershipCache.set(key, ownership)
  return ownership
}

export interface EmptyRegion {
  size: number
  /** Stones bordering the region, by colour (plain indices). */
  black: Set<number>
  white: Set<number>
}

/** Connected empty areas of the board; stones in `dead` count as empty. */
export function emptyRegions(
  board: Uint8Array,
  size: number,
  dead: Set<number> = new Set(),
): { regions: EmptyRegion[]; regionOf: Int32Array } {
  const isEmpty = (i: number) => board[i] === EMPTY || dead.has(i)
  const regionOf = new Int32Array(board.length).fill(-1)
  const regions: EmptyRegion[] = []
  for (let i = 0; i < board.length; i++) {
    if (!isEmpty(i) || regionOf[i] >= 0) continue
    const region: EmptyRegion = { size: 0, black: new Set(), white: new Set() }
    const id = regions.length
    regions.push(region)
    const stack = [i]
    regionOf[i] = id
    while (stack.length > 0) {
      const p = stack.pop()!
      region.size++
      for (const n of neighbours(p, size)) {
        if (isEmpty(n)) {
          if (regionOf[n] < 0) {
            regionOf[n] = id
            stack.push(n)
          }
        } else if (board[n] === BLACK) region.black.add(n)
        else region.white.add(n)
      }
    }
  }
  return { regions, regionOf }
}

/** An empty area counts as walled in only if it is not much bigger than its wall (rules out open boards). */
export const AREA_PER_WALL_STONE = 4

/** Owner of a walled-in empty area (bordered by one colour only), or EMPTY if it is still open. */
export function walledOwner(region: EmptyRegion): number {
  const black = region.black.size
  const white = region.white.size
  if (black > 0 && white === 0 && region.size <= AREA_PER_WALL_STONE * black) return BLACK
  if (white > 0 && black === 0 && region.size <= AREA_PER_WALL_STONE * white) return WHITE
  return EMPTY
}

/** Owner of the walled-in area around an empty point once dead stones are taken off, or EMPTY. */
export function settledOwnerAt(position: GoPosition, index: number): number {
  if (position.board[index] !== EMPTY) return EMPTY
  const { regions, regionOf } = emptyRegions(position.board, position.size, new Set(estimateDead(position)))
  return regionOf[index] >= 0 ? walledOwner(regions[regionOf[index]]) : EMPTY
}

/**
 * Whether anything is still worth playing for: after taking off the stones the final count would
 * call dead, some empty area touches both colours (open borders, neutral points) or is too open
 * to be anybody's yet.
 */
export function hasContestedPoints(position: GoPosition): boolean {
  const { regions } = emptyRegions(position.board, position.size, new Set(estimateDead(position)))
  return regions.some((region) => walledOwner(region) === EMPTY)
}

/** Empty points that do not belong to anybody yet (in areas that are not walled in). */
export function openPoints(position: GoPosition): number[] {
  const { regions, regionOf } = emptyRegions(position.board, position.size, new Set(estimateDead(position)))
  const open: number[] = []
  for (let i = 0; i < position.board.length; i++) {
    if (position.board[i] === EMPTY && regionOf[i] >= 0 && walledOwner(regions[regionOf[i]]) === EMPTY) open.push(i)
  }
  return open
}

/** An own-only empty area at least this big counts as room for two eyes. */
const TWO_EYE_AREA = 4

/**
 * Groups that look captured from the shape of the board: they have no room for two eyes and every
 * empty area they touch is walled in mostly by the opponent (at least twice as many enemy stones).
 * Repeated once so that areas freed by dead stones are taken into account.
 */
export function enclosedGroups(position: GoPosition): Set<number> {
  const { board, size } = position
  const dead = new Set<number>()
  for (let round = 0; round < 2; round++) {
    const { regions, regionOf } = emptyRegions(board, size, dead)
    let changed = false
    for (const group of allGroups(board, size)) {
      if (dead.has(group.stones[0])) continue
      const touched = new Set<number>()
      for (const s of group.stones) for (const n of neighbours(s, size)) if (regionOf[n] >= 0) touched.add(regionOf[n])
      let eyes = 0
      let enclosed = true
      for (const id of touched) {
        const region = regions[id]
        const mine = group.color === BLACK ? region.black.size : region.white.size
        const theirs = group.color === BLACK ? region.white.size : region.black.size
        if (theirs === 0) eyes += region.size >= TWO_EYE_AREA ? 2 : 1
        else if (!(theirs >= 3 && theirs >= 2 * mine)) enclosed = false
      }
      if (eyes < 2 && enclosed) {
        for (const s of group.stones) dead.add(s)
        changed = true
      }
    }
    if (!changed) break
  }
  return dead
}

/** A group whose stones are mostly owned by the opponent at the end of random playouts. */
const DEAD_THRESHOLD = -0.35
/** An enclosed group counts as dead unless random playouts clearly keep it alive. */
const ENCLOSED_DEAD_THRESHOLD = 0.4

/** Stones that would most likely be captured if play went on (plain indices). */
export function estimateDead(position: GoPosition): number[] {
  const ownership = ownershipOf(position)
  const enclosed = enclosedGroups(position)
  const dead: number[] = []
  for (const group of allGroups(position.board, position.size)) {
    const sign = group.color === BLACK ? 1 : -1
    const average = group.stones.reduce((sum, s) => sum + ownership[s] * sign, 0) / group.stones.length
    if (average < DEAD_THRESHOLD || (enclosed.has(group.stones[0]) && average < ENCLOSED_DEAD_THRESHOLD)) {
      dead.push(...group.stones)
    }
  }
  return dead.sort((a, b) => a - b)
}

/** Final count of a finished game; dead stones are estimated unless given. */
export function finalScore(position: GoPosition, dead?: number[]): AreaScore {
  return areaScore(position, dead ?? estimateDead(position))
}

/** Marks the group at `index` dead (or alive again). Returns the new dead list, or null for an empty point. */
export function toggleDead(position: GoPosition, dead: number[], index: number): number[] | null {
  const group = groupAt(position.board, position.size, index)
  if (!group) return null
  const set = new Set(dead)
  const isDead = group.stones.every((s) => set.has(s))
  for (const s of group.stones) {
    if (isDead) set.delete(s)
    else set.add(s)
  }
  return [...set].sort((a, b) => a - b)
}

/** Winner of a finished game by area count. */
export function winnerOf(score: AreaScore): Side | 'draw' {
  return score.margin > 0 ? 'w' : score.margin < 0 ? 'b' : 'draw'
}

/** "7,5" */
export function formatPoints(value: number): string {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}
