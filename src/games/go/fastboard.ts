/**
 * Fast Go board used by both the rules (so the UI and the engine share one implementation)
 * and the Monte Carlo search. Points are stored with a one-point border around the board,
 * so neighbours never need bounds checks: index = (y + 1) * W + (x + 1), W = size + 2.
 */

export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2
export const EDGE = 3
export const PASS = -1
export const DEFAULT_KOMI = 7.5

export type Rng = () => number

/** Small deterministic random generator (xorshift32). */
export function makeRng(seed: number): Rng {
  let s = seed | 0 || 0x2545f491
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

/** 32-bit string hash, used to seed deterministic estimates from a position. */
export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h | 0
}

export class FastBoard {
  readonly size: number
  readonly W: number
  readonly cells: Uint8Array
  /** Empty points (unordered) and each point's slot in that list. */
  readonly empties: Int16Array
  readonly emptyAt: Int16Array
  nEmpty = 0
  /** Point the side to move may not play (simple ko), or -1. */
  ko = -1
  turn = BLACK
  /** Consecutive passes just before this position. */
  passes = 0
  /** Last move played (a point, or PASS). */
  lastMove = PASS
  komi = DEFAULT_KOMI
  /** Set by libertyCount: the last liberty it found. */
  lastLiberty = -1
  /** Set by libertyCount: the first two liberties it found. */
  readonly firstLiberties = new Int16Array(2)

  private readonly dirs: Int16Array
  private readonly diags: Int16Array
  private readonly mark: Int32Array
  private readonly libMark: Int32Array
  private readonly stack: Int16Array
  private gen = 0

  constructor(size: number) {
    this.size = size
    const W = size + 2
    this.W = W
    this.cells = new Uint8Array(W * W).fill(EDGE)
    this.empties = new Int16Array(W * W)
    this.emptyAt = new Int16Array(W * W).fill(-1)
    this.mark = new Int32Array(W * W)
    this.libMark = new Int32Array(W * W)
    this.stack = new Int16Array(W * W)
    this.dirs = Int16Array.from([-1, 1, -W, W])
    this.diags = Int16Array.from([-W - 1, -W + 1, W - 1, W + 1])
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = (y + 1) * W + x + 1
        this.cells[p] = EMPTY
        this.addEmpty(p)
      }
    }
  }

  /** Fast index of a plain index (y * size + x). */
  fast(plain: number): number {
    const x = plain % this.size
    const y = (plain - x) / this.size
    return (y + 1) * this.W + x + 1
  }

  /** Plain index (y * size + x) of a fast index. */
  plain(fast: number): number {
    const y = Math.floor(fast / this.W) - 1
    const x = (fast % this.W) - 1
    return y * this.size + x
  }

  copyFrom(other: FastBoard): void {
    this.cells.set(other.cells)
    this.empties.set(other.empties)
    this.emptyAt.set(other.emptyAt)
    this.nEmpty = other.nEmpty
    this.ko = other.ko
    this.turn = other.turn
    this.passes = other.passes
    this.lastMove = other.lastMove
    this.komi = other.komi
  }

  clone(): FastBoard {
    const board = new FastBoard(this.size)
    board.copyFrom(this)
    return board
  }

  /** Puts a stone (or clears a point) without any rule checks. Used to set up positions. */
  setPoint(p: number, color: number): void {
    const was = this.cells[p]
    if (was === color || was === EDGE) return
    if (was === EMPTY) this.removeEmpty(p)
    this.cells[p] = color
    if (color === EMPTY) this.addEmpty(p)
  }

  private addEmpty(p: number): void {
    this.emptyAt[p] = this.nEmpty
    this.empties[this.nEmpty++] = p
  }

  private removeEmpty(p: number): void {
    const slot = this.emptyAt[p]
    const last = this.empties[--this.nEmpty]
    this.empties[slot] = last
    this.emptyAt[last] = slot
    this.emptyAt[p] = -1
  }

  private nextGen(): number {
    if (this.gen > 1_000_000_000) {
      this.mark.fill(0)
      this.libMark.fill(0)
      this.gen = 0
    }
    return ++this.gen
  }

  /** Liberties of the group at p, counting at most `max` of them. */
  libertyCount(p: number, max: number): number {
    const cells = this.cells
    const color = cells[p]
    const gen = this.nextGen()
    const mark = this.mark
    const libMark = this.libMark
    const stack = this.stack
    const dirs = this.dirs
    let sp = 0
    let libs = 0
    stack[sp++] = p
    mark[p] = gen
    while (sp > 0) {
      const q = stack[--sp]
      for (let d = 0; d < 4; d++) {
        const n = q + dirs[d]
        const c = cells[n]
        if (c === EMPTY) {
          if (libMark[n] !== gen) {
            libMark[n] = gen
            this.lastLiberty = n
            if (libs < 2) this.firstLiberties[libs] = n
            if (++libs >= max) return libs
          }
        } else if (c === color && mark[n] !== gen) {
          mark[n] = gen
          stack[sp++] = n
        }
      }
    }
    return libs
  }

  /** Stones of the group at p (fast indices). */
  groupStones(p: number): number[] {
    const color = this.cells[p]
    const gen = this.nextGen()
    const out = [p]
    this.mark[p] = gen
    for (let i = 0; i < out.length; i++) {
      const q = out[i]
      for (let d = 0; d < 4; d++) {
        const n = q + this.dirs[d]
        if (this.cells[n] === color && this.mark[n] !== gen) {
          this.mark[n] = gen
          out.push(n)
        }
      }
    }
    return out
  }

  private removeGroup(p: number): number {
    const cells = this.cells
    const color = cells[p]
    const stack = this.stack
    let sp = 0
    let count = 0
    stack[sp++] = p
    cells[p] = EMPTY
    while (sp > 0) {
      const q = stack[--sp]
      this.addEmpty(q)
      count++
      for (let d = 0; d < 4; d++) {
        const n = q + this.dirs[d]
        if (cells[n] === color) {
          cells[n] = EMPTY
          stack[sp++] = n
        }
      }
    }
    return count
  }

  emptyNeighbours(p: number): number {
    let count = 0
    for (let d = 0; d < 4; d++) if (this.cells[p + this.dirs[d]] === EMPTY) count++
    return count
  }

  /** Whether `color` may play at p (empty, not the ko point, not suicide). */
  isLegal(p: number, color: number): boolean {
    const cells = this.cells
    if (cells[p] !== EMPTY || p === this.ko) return false
    const opp = 3 - color
    for (let d = 0; d < 4; d++) {
      const n = p + this.dirs[d]
      const c = cells[n]
      if (c === EMPTY) return true
      if (c === color) {
        if (this.libertyCount(n, 2) >= 2) return true
      } else if (c === opp) {
        if (this.libertyCount(n, 2) === 1) return true
      }
    }
    return false
  }

  /** A point surrounded by `color` that is (almost certainly) a real eye: filling it is never useful. */
  isEyeLike(p: number, color: number): boolean {
    const cells = this.cells
    for (let d = 0; d < 4; d++) {
      const c = cells[p + this.dirs[d]]
      if (c !== color && c !== EDGE) return false
    }
    let bad = 0
    let edge = false
    const opp = 3 - color
    for (let d = 0; d < 4; d++) {
      const c = cells[p + this.diags[d]]
      if (c === EDGE) edge = true
      else if (c === opp) bad++
    }
    return edge ? bad === 0 : bad <= 1
  }

  /** Plays a legal move (or PASS) for the side to move and returns the number of captured stones. */
  play(p: number): number {
    const color = this.turn
    this.turn = 3 - color
    this.lastMove = p
    if (p === PASS) {
      this.passes++
      this.ko = -1
      return 0
    }
    this.passes = 0
    const cells = this.cells
    cells[p] = color
    this.removeEmpty(p)
    const opp = 3 - color
    let captured = 0
    let capturedAt = -1
    for (let d = 0; d < 4; d++) {
      const n = p + this.dirs[d]
      if (cells[n] === opp && this.libertyCount(n, 1) === 0) {
        capturedAt = n
        captured += this.removeGroup(n)
      }
    }
    this.ko = -1
    if (captured === 1) {
      let alone = true
      for (let d = 0; d < 4; d++) if (cells[p + this.dirs[d]] === color) alone = false
      if (alone && this.libertyCount(p, 2) === 1) this.ko = capturedAt
    }
    return captured
  }

  /**
   * Local answers to the last move: capture it if it is in atari, save an own group it put in
   * atari, or put it in atari when it has two liberties (so invaders do not live by accident).
   */
  private tacticalMove(color: number, rng: Rng): number {
    const last = this.lastMove
    const cells = this.cells
    if (cells[last] === 3 - color) {
      const libs = this.libertyCount(last, 3)
      if (libs === 1) {
        const lib = this.lastLiberty
        if (this.isLegal(lib, color)) return lib
      }
    }
    for (let d = 0; d < 4; d++) {
      const n = last + this.dirs[d]
      if (cells[n] === color && this.libertyCount(n, 2) === 1) {
        const lib = this.lastLiberty
        if (this.emptyNeighbours(lib) >= 2 && this.isLegal(lib, color)) return lib
      }
    }
    if (cells[last] === 3 - color && rng() < 0.6 && this.libertyCount(last, 3) === 2) {
      // Copy them first: the checks below reuse the liberty scratch space.
      const first = rng() < 0.5
      const a = this.firstLiberties[first ? 0 : 1]
      const b = this.firstLiberties[first ? 1 : 0]
      for (const lib of [a, b]) {
        if (this.isLegal(lib, color) && !(this.emptyNeighbours(lib) <= 1 && this.isSelfAtari(lib, color))) return lib
      }
    }
    return -1
  }

  /** Move chosen by the light playout policy: simple tactics, otherwise random (never filling own eyes). */
  policyMove(rng: Rng): number {
    const color = this.turn
    if (this.lastMove >= 0 && rng() < 0.9) {
      const tactical = this.tacticalMove(color, rng)
      if (tactical >= 0) return tactical
    }
    const n = this.nEmpty
    if (n === 0) return PASS
    let i = (rng() * n) | 0
    for (let k = 0; k < n; k++) {
      const p = this.empties[i]
      if (!this.isEyeLike(p, color) && this.isLegal(p, color)) {
        // Avoid most self-ataris of larger groups: random play would throw them away.
        if (this.emptyNeighbours(p) <= 1 && this.isSelfAtari(p, color)) {
          if (++i === n) i = 0
          continue
        }
        return p
      }
      if (++i === n) i = 0
    }
    return PASS
  }

  /** Whether playing at p leaves the new group (of 2+ stones) with a single liberty and captures nothing. */
  isSelfAtari(p: number, color: number): boolean {
    const cells = this.cells
    const opp = 3 - color
    let ownNeighbour = false
    for (let d = 0; d < 4; d++) {
      const n = p + this.dirs[d]
      if (cells[n] === opp && this.libertyCount(n, 2) === 1) return false
      if (cells[n] === color) ownNeighbour = true
    }
    if (!ownNeighbour) return false
    cells[p] = color
    const libs = this.libertyCount(p, 2)
    cells[p] = EMPTY
    return libs === 1
  }

  /** Plays random moves until both sides pass (or the move limit). Records who played each point first. */
  playout(rng: Rng, maxMoves: number, firstColor?: Uint8Array): void {
    let moves = 0
    while (this.passes < 2 && moves < maxMoves) {
      const move = this.policyMove(rng)
      if (firstColor && move >= 0 && firstColor[move] === 0) firstColor[move] = this.turn
      this.play(move)
      moves++
    }
  }

  /**
   * Score of a finished playout (every empty point is surrounded by one colour): black minus white
   * minus komi. Optionally adds each point's owner (+1 black, -1 white) into `ownership` (plain indices).
   */
  score(ownership?: Float32Array): number {
    const { size, W, cells } = this
    let black = 0
    let white = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = (y + 1) * W + x + 1
        let owner = cells[p]
        if (owner === EMPTY) {
          let b = false
          let w = false
          for (let d = 0; d < 4; d++) {
            const c = cells[p + this.dirs[d]]
            if (c === BLACK) b = true
            else if (c === WHITE) w = true
          }
          owner = b && !w ? BLACK : w && !b ? WHITE : EMPTY
        }
        if (owner === BLACK) {
          black++
          if (ownership) ownership[y * size + x] += 1
        } else if (owner === WHITE) {
          white++
          if (ownership) ownership[y * size + x] -= 1
        }
      }
    }
    return black - white - this.komi
  }
}

/**
 * Average owner of every point (+1 black, -1 white) over random playouts from this position.
 * Deterministic for a given seed. Half of the playouts start with each colour.
 */
export function estimateOwnership(board: FastBoard, playouts: number, seed: number): Float32Array {
  const ownership = new Float32Array(board.size * board.size)
  const work = new FastBoard(board.size)
  const rng = makeRng(seed)
  const maxMoves = board.size * board.size * 3
  for (let i = 0; i < playouts; i++) {
    work.copyFrom(board)
    work.passes = 0
    work.lastMove = PASS
    if (i % 2 === 1) {
      work.turn = 3 - board.turn
      work.ko = -1
    }
    work.playout(rng, maxMoves)
    work.score(ownership)
  }
  for (let i = 0; i < ownership.length; i++) ownership[i] /= playouts
  return ownership
}
