/**
 * Mayın Tarlası (Minesweeper): open every square without a mine. A number tells how many of the
 * (up to eight) squares around it hide a mine. The first square opened never has a mine, nor do
 * the squares around it, so every game starts by opening an area. Boards are plain values: every
 * change returns a new board, so React sees it.
 */

export interface MineLevel {
  id: number
  name: string
  rows: number
  cols: number
  mines: number
}

export const MINE_LEVELS: MineLevel[] = [
  { id: 1, name: 'Çok kolay', rows: 8, cols: 8, mines: 6 },
  { id: 2, name: 'Kolay', rows: 9, cols: 9, mines: 10 },
  { id: 3, name: 'Orta', rows: 16, cols: 16, mines: 40 },
  { id: 4, name: 'Zor', rows: 30, cols: 16, mines: 99 },
]

export const levelById = (id: number): MineLevel => MINE_LEVELS.find((level) => level.id === id) ?? MINE_LEVELS[0]

export type Status = 'ready' | 'playing' | 'won' | 'lost'

export interface MineBoard {
  rows: number
  cols: number
  mines: number
  /** Index row * cols + col. Empty until the first square is opened. */
  mine: Uint8Array
  /** Mines around each square. */
  count: Uint8Array
  open: Uint8Array
  flag: Uint8Array
  status: Status
  /** The mine that went off, or -1. */
  exploded: number
}

export function newBoard(rows: number, cols: number, mines: number): MineBoard {
  const size = rows * cols
  return {
    rows,
    cols,
    mines: Math.min(mines, size - 1),
    mine: new Uint8Array(size),
    count: new Uint8Array(size),
    open: new Uint8Array(size),
    flag: new Uint8Array(size),
    status: 'ready',
    exploded: -1,
  }
}

export function neighbours(board: Pick<MineBoard, 'rows' | 'cols'>, index: number): number[] {
  const { rows, cols } = board
  const r = Math.floor(index / cols)
  const c = index % cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const rr = r + dr
      const cc = c + dc
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc)
    }
  }
  return out
}

const copy = (board: MineBoard): MineBoard => ({ ...board, open: board.open.slice(), flag: board.flag.slice() })

/** Puts the mines anywhere except `safe` and (when there is room) the squares around it. */
export function placeMines(board: MineBoard, safe: number, random: () => number = Math.random): MineBoard {
  const size = board.rows * board.cols
  const keepClear = new Set([safe, ...neighbours(board, safe)])
  let spots = [...Array(size).keys()].filter((i) => !keepClear.has(i))
  if (spots.length < board.mines) spots = [...Array(size).keys()].filter((i) => i !== safe)
  // Fisher-Yates: the first `mines` spots after shuffling.
  for (let i = 0; i < board.mines; i++) {
    const j = i + Math.floor(random() * (spots.length - i))
    ;[spots[i], spots[j]] = [spots[j], spots[i]]
  }
  const mine = new Uint8Array(size)
  for (let i = 0; i < board.mines; i++) mine[spots[i]] = 1
  return withMines(board, mine)
}

/** The board with the given mines (and their counts); used by placeMines and by tests. */
export function withMines(board: MineBoard, mine: Uint8Array): MineBoard {
  const count = new Uint8Array(mine.length)
  for (let i = 0; i < mine.length; i++) {
    if (!mine[i]) continue
    for (const n of neighbours(board, i)) count[n]++
  }
  let mines = 0
  for (const m of mine) mines += m
  return { ...board, mine, count, mines, status: 'playing' }
}

function checkWin(board: MineBoard): MineBoard {
  for (let i = 0; i < board.open.length; i++) if (!board.mine[i] && !board.open[i]) return board
  // Every safe square is open: the remaining squares are all mines, so they get their flags.
  const flag = board.flag.slice()
  for (let i = 0; i < flag.length; i++) flag[i] = board.mine[i]
  return { ...board, flag, status: 'won' }
}

/** Opens squares on a board that is already a copy (spreading through empty squares). */
function openInPlace(board: MineBoard, start: number): MineBoard {
  if (board.mine[start]) return { ...board, status: 'lost', exploded: start }
  const stack = [start]
  while (stack.length > 0) {
    const i = stack.pop()!
    if (board.open[i] || board.flag[i]) continue
    board.open[i] = 1
    if (board.count[i] === 0) for (const n of neighbours(board, i)) if (!board.open[n] && !board.flag[n]) stack.push(n)
  }
  return board
}

/**
 * Opens a square. The first one places the mines. Opening an already open number whose mines are
 * all flagged opens the other squares around it (as in most Minesweeper games).
 */
export function reveal(board: MineBoard, index: number, random: () => number = Math.random): MineBoard {
  if (board.status === 'won' || board.status === 'lost') return board
  if (board.flag[index]) return board
  if (board.status === 'ready') board = placeMines(board, index, random)
  if (board.open[index]) return chord(board, index)
  return checkWin(openInPlace(copy(board), index))
}

/** Around an open number with as many flags as its number: opens every other closed square. */
export function chord(board: MineBoard, index: number): MineBoard {
  if (board.status !== 'playing' || !board.open[index] || board.count[index] === 0) return board
  const around = neighbours(board, index)
  const flags = around.filter((n) => board.flag[n]).length
  const closed = around.filter((n) => !board.open[n] && !board.flag[n])
  if (flags !== board.count[index] || closed.length === 0) return board
  let next = copy(board)
  for (const n of closed) {
    next = openInPlace(next, n)
    if (next.status === 'lost') return next
  }
  return checkWin(next)
}

export function toggleFlag(board: MineBoard, index: number): MineBoard {
  if (board.status === 'won' || board.status === 'lost' || board.open[index]) return board
  const next = copy(board)
  next.flag[index] = next.flag[index] ? 0 : 1
  return next
}

export const flagsPlaced = (board: MineBoard): number => board.flag.reduce((sum, f) => sum + f, 0)

/** "42 sn", "3 dk 05 sn" */
export function timeText(seconds: number): string {
  const whole = Math.floor(seconds)
  if (whole < 60) return `${whole} sn`
  return `${Math.floor(whole / 60)} dk ${String(whole % 60).padStart(2, '0')} sn`
}
