import { BLACK, FastBoard, PASS, type Rng } from './fastboard'

/**
 * Monte Carlo tree search with RAVE (all-moves-as-first statistics), the classic recipe
 * for small-board Go. Nodes live in typed arrays so large searches stay light on memory.
 */

/** A node is expanded once it has been visited this many times. */
const EXPAND_AT = 3
/** How quickly RAVE statistics give way to real visit statistics. */
const RAVE_K = 400
const EXPLORATION = 0.1
/** Share of the reward that comes from the final margin instead of win/loss. */
const SCORE_WEIGHT = 0.1
const SCORE_SCALE = 30

export interface SearchOptions {
  playouts: number
  rng: Rng
  /**
   * Final margin (black - white - komi) if the side to move passes and that ends the game
   * (the opponent passed just before). Lets the root "pass" use the real end-of-game count.
   */
  passEndsMargin?: number
}

export interface ChildStats {
  /** Fast board index, or PASS. */
  move: number
  visits: number
  /** Winning chance for the side to move (0-1). */
  winrate: number
  /** Average final margin for the side to move, in points. */
  lead: number
  /** Expected continuation, starting with `move`. */
  pv: number[]
}

export interface SearchResult {
  /** Visited root moves, most visited first. */
  children: ChildStats[]
  /** Average owner of every point (+1 black, -1 white), plain indices. */
  ownership: Float32Array
}

class Tree {
  readonly move: Int16Array
  readonly color: Uint8Array
  readonly first: Int32Array
  readonly count: Int16Array
  readonly n: Float32Array
  readonly w: Float32Array
  readonly s: Float32Array
  readonly rn: Float32Array
  readonly rw: Float32Array
  size = 0

  constructor(readonly capacity: number) {
    this.move = new Int16Array(capacity)
    this.color = new Uint8Array(capacity)
    this.first = new Int32Array(capacity).fill(-1)
    this.count = new Int16Array(capacity)
    this.n = new Float32Array(capacity)
    this.w = new Float32Array(capacity)
    this.s = new Float32Array(capacity)
    this.rn = new Float32Array(capacity)
    this.rw = new Float32Array(capacity)
  }

  alloc(k: number): number {
    const start = this.size
    this.size += k
    return start
  }
}

/** Reward for black: mostly win/loss, a little for the size of the margin. */
function blackReward(margin: number): number {
  const win = margin > 0 ? 1 : margin < 0 ? 0 : 0.5
  return (1 - SCORE_WEIGHT) * win + SCORE_WEIGHT * (0.5 + 0.5 * Math.tanh(margin / SCORE_SCALE))
}

export function search(root: FastBoard, options: SearchOptions): SearchResult {
  const { size, W } = root
  const playouts = Math.max(1, Math.floor(options.playouts))
  const capacity = Math.min(1_500_000, playouts * 30 + 4 * W * W)
  const tree = new Tree(capacity)
  const dirs = [-1, 1, -W, W]
  const rng = options.rng

  const onEdge = (p: number) => {
    const x = p % W
    const y = (p - x) / W
    return x === 1 || x === size || y === 1 || y === size
  }

  /** Creates the children of `node` (moves for the side to move on `board`) with heuristic priors. */
  const expand = (node: number, board: FastBoard, isRoot: boolean) => {
    const color = board.turn
    const opp = 3 - color
    const cells = board.cells
    const moves: number[] = []
    for (let i = 0; i < board.nEmpty; i++) {
      const p = board.empties[i]
      if (!board.isEyeLike(p, color) && board.isLegal(p, color)) moves.push(p)
    }
    const withPass = isRoot || board.passes > 0 || moves.length < 4
    const total = moves.length + (withPass ? 1 : 0)
    if (tree.size + total > capacity) return false
    const first = tree.alloc(total)
    tree.first[node] = first
    tree.count[node] = total
    const opening = board.nEmpty > size * size * 0.6
    const last = board.lastMove
    for (let k = 0; k < moves.length; k++) {
      const p = moves[k]
      const child = first + k
      tree.move[child] = p
      tree.color[child] = color
      let pn = 10
      let pw = 5
      for (let d = 0; d < 4; d++) {
        const n = p + dirs[d]
        const c = cells[n]
        if (c === opp && board.libertyCount(n, 2) === 1) {
          pn += 20
          pw += 20
        } else if (c === color && board.libertyCount(n, 2) === 1 && board.emptyNeighbours(p) >= 2) {
          pn += 15
          pw += 13
        }
      }
      if (board.emptyNeighbours(p) <= 1 && board.isSelfAtari(p, color)) {
        pn += 25
      }
      if (opening && onEdge(p)) {
        pn += 20
        pw += 2
      }
      if (last >= 0) {
        const dx = Math.abs((p % W) - (last % W))
        const dy = Math.abs(Math.floor(p / W) - Math.floor(last / W))
        if (dx + dy <= 2) {
          pn += 6
          pw += 5
        }
      }
      tree.rn[child] = pn
      tree.rw[child] = pw
    }
    if (withPass) {
      const child = first + moves.length
      tree.move[child] = PASS
      tree.color[child] = color
      // Passing gets no RAVE statistics; this prior keeps it from being tried first.
      tree.rn[child] = 10
      tree.rw[child] = 1
    }
    return true
  }

  const select = (node: number) => {
    const first = tree.first[node]
    const end = first + tree.count[node]
    const logN = Math.log(tree.n[node] + 1)
    let best = first
    let bestValue = -Infinity
    for (let child = first; child < end; child++) {
      const n = tree.n[child]
      const rn = tree.rn[child]
      const beta = rn > 0 ? Math.sqrt(RAVE_K / (3 * n + RAVE_K)) : 0
      const q = n > 0 ? tree.w[child] / n : 1
      const qr = rn > 0 ? tree.rw[child] / rn : 0
      const value = (1 - beta) * q + beta * qr + EXPLORATION * Math.sqrt(logN / (n + 1))
      if (value > bestValue) {
        bestValue = value
        best = child
      }
    }
    return best
  }

  const rootNode = tree.alloc(1)
  tree.move[rootNode] = PASS
  tree.color[rootNode] = 3 - root.turn
  expand(rootNode, root, true)
  let passChild = -1
  for (let c = tree.first[rootNode]; c < tree.first[rootNode] + tree.count[rootNode]; c++) {
    if (tree.move[c] === PASS) passChild = c
  }
  const passEnds = root.passes > 0 && options.passEndsMargin !== undefined
  if (passEnds && passChild >= 0) {
    // Passing ends the game with a known count: judge it by real visits only.
    tree.rn[passChild] = 0
    tree.rw[passChild] = 0
  }

  const work = new FastBoard(size)
  const amaf = new Uint8Array(W * W)
  const path = new Int32Array(2048)
  const ownership = new Float32Array(size * size)
  let scored = 0
  const maxMoves = size * size * 3

  for (let i = 0; i < playouts; i++) {
    work.copyFrom(root)
    let depth = 0
    path[depth++] = rootNode
    let node = rootNode
    let margin = Number.NaN
    for (;;) {
      if (tree.first[node] < 0) {
        if (tree.n[node] < EXPAND_AT || work.passes >= 2 || !expand(node, work, false)) break
      }
      node = select(node)
      work.play(tree.move[node])
      path[depth++] = node
      if (node === passChild && passEnds) {
        margin = options.passEndsMargin!
        break
      }
      if (work.passes >= 2 || depth >= path.length - 1) break
    }
    amaf.fill(0)
    if (Number.isNaN(margin)) {
      // Two passes inside the tree: let random play settle what is alive instead of counting as is.
      if (work.passes >= 2) work.passes = 0
      work.playout(rng, maxMoves, amaf)
      margin = work.score(ownership)
      scored++
    }

    const rBlack = blackReward(margin)
    for (let k = depth - 1; k >= 0; k--) {
      const nodeK = path[k]
      const color = tree.color[nodeK]
      tree.n[nodeK]++
      tree.w[nodeK] += color === BLACK ? rBlack : 1 - rBlack
      tree.s[nodeK] += color === BLACK ? margin : -margin
      const first = tree.first[nodeK]
      if (first >= 0) {
        const end = first + tree.count[nodeK]
        for (let child = first; child < end; child++) {
          const move = tree.move[child]
          const childColor = tree.color[child]
          if (move >= 0 && amaf[move] === childColor) {
            tree.rn[child]++
            tree.rw[child] += childColor === BLACK ? rBlack : 1 - rBlack
          }
        }
      }
      const move = tree.move[nodeK]
      if (k > 0 && move >= 0) amaf[move] = color
    }
  }

  if (scored > 0) for (let i = 0; i < ownership.length; i++) ownership[i] /= scored

  const principal = (start: number) => {
    const pv = [tree.move[start]]
    let node = start
    while (pv.length < 12 && tree.first[node] >= 0) {
      let best = -1
      let bestVisits = 1
      for (let c = tree.first[node]; c < tree.first[node] + tree.count[node]; c++) {
        if (tree.n[c] > bestVisits) {
          bestVisits = tree.n[c]
          best = c
        }
      }
      if (best < 0) break
      pv.push(tree.move[best])
      node = best
    }
    return pv
  }

  const children: ChildStats[] = []
  for (let c = tree.first[rootNode]; c < tree.first[rootNode] + tree.count[rootNode]; c++) {
    const n = tree.n[c]
    if (n === 0) continue
    children.push({ move: tree.move[c], visits: n, winrate: tree.w[c] / n, lead: tree.s[c] / n, pv: principal(c) })
  }
  children.sort((a, b) => b.visits - a.visits)
  return { children, ownership }
}
