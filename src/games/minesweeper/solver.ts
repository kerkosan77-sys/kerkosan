import { neighbours, type MineBoard } from './logic'

/**
 * The coach of Mayın Tarlası: works out, from what the player can see (open numbers only; flags
 * may be wrong, so they are never trusted), which closed squares must be mines and which must be
 * safe, and says why in simple words.
 *
 * The conclusions are found one step at a time, the plainest first, each step using only the open
 * numbers and the steps before it. A hint is the first step the player has not acted on yet (its
 * mines not flagged or its safe squares not opened), so its reasoning only uses what the player can
 * see on the board: open numbers and the flags of the earlier steps.
 */

export type Reason =
  /** A number with exactly as many closed squares left as mines left: all of them are mines. */
  | { kind: 'full'; clue: number }
  /** A number whose mines are all known: its other closed squares are safe. */
  | { kind: 'clear'; clue: number }
  /** Two numbers together: the closed squares of `small` are all next to `big` as well. */
  | { kind: 'pair'; small: number; big: number }
  /** The mine counter: no mines left, or as many mines left as closed squares. */
  | { kind: 'total' }

export interface Step {
  reason: Reason
  cells: number[]
  mine: boolean
}

export interface Deductions {
  steps: Step[]
  /** Square → the step that found it. */
  mine: Map<number, number>
  safe: Map<number, number>
}

interface Clue {
  cell: number
  /** Closed squares around it not worked out yet. */
  unknown: number[]
  /** Mines among `unknown`. */
  need: number
}

/** The closed squares around a number not worked out before step `upTo`, and how many mines they hold. */
function clueAt(board: MineBoard, d: Deductions, cell: number, upTo = Infinity): Clue {
  let known = 0
  const unknown: number[] = []
  for (const n of neighbours(board, cell)) {
    if (board.open[n]) continue
    const mineStep = d.mine.get(n)
    const safeStep = d.safe.get(n)
    if (mineStep !== undefined && mineStep < upTo) known++
    else if (safeStep === undefined || safeStep >= upTo) unknown.push(n)
  }
  return { cell, unknown, need: board.count[cell] - known }
}

function openClues(board: MineBoard, d: Deductions): Clue[] {
  const clues: Clue[] = []
  for (let cell = 0; cell < board.open.length; cell++) {
    if (!board.open[cell] || board.count[cell] === 0) continue
    const clue = clueAt(board, d, cell)
    if (clue.unknown.length > 0) clues.push(clue)
  }
  return clues
}

const undecided = (board: MineBoard, d: Deductions): number[] => {
  const out: number[] = []
  for (let i = 0; i < board.open.length; i++) if (!board.open[i] && !d.mine.has(i) && !d.safe.has(i)) out.push(i)
  return out
}

/** Every square that can be worked out for sure from the open numbers and the number of mines. */
export function deduce(board: MineBoard): Deductions {
  const d: Deductions = { steps: [], mine: new Map(), safe: new Map() }
  if (board.status !== 'playing') return d
  const add = (cells: number[], mine: boolean, reason: Reason) => {
    const index = d.steps.length
    d.steps.push({ reason, cells, mine })
    for (const n of cells) (mine ? d.mine : d.safe).set(n, index)
  }

  // Every step decides at least one square, so this ends.
  for (;;) {
    const clues = openClues(board, d)
    // One number on its own.
    const single = clues.find((clue) => clue.need === 0 || clue.need === clue.unknown.length)
    if (single) {
      if (single.need === 0) add(single.unknown, false, { kind: 'clear', clue: single.cell })
      else add(single.unknown, true, { kind: 'full', clue: single.cell })
      continue
    }
    // Two numbers together: one's closed squares all lie next to the other.
    let paired = false
    search: for (const small of clues) {
      const inSmall = new Set(small.unknown)
      for (const big of clues) {
        if (big === small || big.unknown.length <= small.unknown.length) continue
        if (!small.unknown.every((n) => big.unknown.includes(n))) continue
        const rest = big.unknown.filter((n) => !inSmall.has(n))
        const left = big.need - small.need
        if (left !== 0 && left !== rest.length) continue
        add(rest, left !== 0, { kind: 'pair', small: small.cell, big: big.cell })
        paired = true
        break search
      }
    }
    if (paired) continue
    // The mine counter.
    const unknown = undecided(board, d)
    const minesLeft = board.mines - d.mine.size
    if (unknown.length > 0 && (minesLeft === 0 || minesLeft === unknown.length)) add(unknown, minesLeft > 0, { kind: 'total' })
    else break
  }
  return d
}

export type HintAction = 'start' | 'open' | 'flag' | 'unflag' | 'guess'

export interface MineHint {
  action: HintAction
  text: string
  /** Squares to open (open, guess), flag (flag) or unflag (unflag). */
  targets: number[]
  /** The numbers the reasoning uses, in order (named A and B when there are two). */
  clues: number[]
  /** Mines found by earlier steps that the reasoning counts. */
  known: number[]
  /** Two numbers together: the closed squares next to both. */
  shared: number[]
}

/** "2 mayını", or "kalan 1 mayını" when some of its mines are already known. */
const minesText = (board: MineBoard, clue: Clue) => (clue.need === board.count[clue.cell] ? `${clue.need} mayını` : `kalan ${clue.need} mayını`)

/** Why the squares of step `index` are mines or safe (without saying what to do). */
function why(board: MineBoard, d: Deductions, index: number): string {
  const { reason, cells, mine } = d.steps[index]
  switch (reason.kind) {
    case 'full': {
      const n = board.count[reason.clue]
      const need = clueAt(board, d, reason.clue, index).need
      if (need === n) {
        return n === 1
          ? 'Bu 1 sayısının çevresinde tek kapalı kare kalmış, demek ki mayın orada.'
          : `Bu ${n} sayısının çevresinde tam ${n} kapalı kare var, yani hepsi mayın.`
      }
      return `Bu ${n} sayısının çevresinde ${n - need} mayın belli. Kalan ${need} mayın için tam ${need} kapalı kare kalmış, yani ${need === 1 ? 'o da' : 'onlar da'} mayın.`
    }
    case 'clear': {
      const n = board.count[reason.clue]
      return n === 1
        ? 'Bu 1 sayısının mayını belli. Çevresindeki diğer kapalı kareler güvenli.'
        : `Bu ${n} sayısının çevresindeki ${n} mayın belli. Çevresindeki diğer kapalı kareler güvenli.`
    }
    case 'pair': {
      const a = clueAt(board, d, reason.small, index)
      const b = clueAt(board, d, reason.big, index)
      const start = `A ve B sayılarına birlikte bak. A'nın ${minesText(board, a)}, B'nin de yanında olan kesikli çerçeveli karelerde.`
      if (!mine) return `${start} B'nin ${minesText(board, b)} var ve hepsi bu ortak karelerde. Yani B'nin yanındaki diğer kareler güvenli.`
      return `${start} B'nin ${minesText(board, b)} var; ortak karelerdekilerden sonra geriye ${cells.length} mayın kalıyor ve B'nin yanında tam ${cells.length} kapalı kare daha var. Yani ${cells.length === 1 ? 'o kare' : 'o kareler'} mayın.`
    }
    case 'total':
      return mine
        ? 'Kalan mayın sayısı, kalan kapalı kare sayısına eşit. Yani bu karelerin hepsi mayın.'
        : 'Bütün mayınların yeri belli oldu. Kalan kapalı kareler güvenli.'
  }
}

function cluesOf(reason: Reason): number[] {
  if (reason.kind === 'pair') return [reason.small, reason.big]
  if (reason.kind === 'total') return []
  return [reason.clue]
}

/** The hint for step `index`, about the given squares. */
function hintFor(board: MineBoard, d: Deductions, index: number, action: HintAction, targets: number[], tail: string): MineHint {
  const { reason } = d.steps[index]
  const clues = cluesOf(reason)
  const known = new Set<number>()
  for (const clue of clues) {
    for (const n of neighbours(board, clue)) if ((d.mine.get(n) ?? Infinity) < index) known.add(n)
  }
  return {
    action,
    text: `${why(board, d, index)} ${tail}`.trim(),
    targets,
    clues,
    known: [...known],
    shared: reason.kind === 'pair' ? clueAt(board, d, reason.small, index).unknown : [],
  }
}

/**
 * A rough chance of a mine for each closed square nobody can be sure about: next to numbers, the
 * highest share of mines among a number's unknown squares; elsewhere, the mines left spread evenly.
 */
function safestGuess(board: MineBoard, d: Deductions): { cell: number; chance: number } | null {
  const clues = openClues(board, d)
  const chance = new Map<number, number>()
  for (const clue of clues) {
    const p = clue.need / clue.unknown.length
    for (const n of clue.unknown) chance.set(n, Math.max(chance.get(n) ?? 0, p))
  }
  const unknown = undecided(board, d)
  if (unknown.length === 0) return null
  const minesLeft = board.mines - d.mine.size
  const inside = unknown.filter((n) => !chance.has(n))
  const frontierMines = clues.reduce((sum, clue) => sum + clue.need, 0)
  const insideChance = inside.length > 0 ? Math.max(0, Math.min(1, (minesLeft - Math.min(minesLeft, frontierMines)) / inside.length)) : 1
  let best: { cell: number; score: number; chance: number } | null = null
  for (const n of unknown) {
    const p = chance.get(n) ?? insideChance
    // Corners open more squares when they are empty: preferred when the chance is the same.
    const score = p - (neighbours(board, n).length <= 3 ? 0.001 : 0)
    if (!best || score < best.score) best = { cell: n, score, chance: p }
  }
  return best && { cell: best.cell, chance: best.chance }
}

/** The next thing to do, explained; null when the game is over. */
export function findHint(board: MineBoard): MineHint | null {
  if (board.status === 'won' || board.status === 'lost') return null
  if (board.status === 'ready') {
    return {
      action: 'start',
      text: 'İlk açtığın kare hep güvenlidir, çevresi de. Ortalardan bir kareye dokun.',
      targets: [],
      clues: [],
      known: [],
      shared: [],
    }
  }
  const d = deduce(board)

  // A flag where there cannot be a mine.
  for (let i = 0; i < d.steps.length; i++) {
    const step = d.steps[i]
    const wrong = step.mine ? [] : step.cells.filter((n) => board.flag[n])
    if (wrong.length === 0) continue
    const hint = hintFor(board, d, i, 'unflag', wrong, 'Bayrağı kaldırıp kareyi açabilirsin.')
    return { ...hint, text: `Bu bayrak yanlış yerde: burada mayın olamaz. ${hint.text}` }
  }
  // The first step not acted on yet.
  for (let i = 0; i < d.steps.length; i++) {
    const step = d.steps[i]
    const targets = step.cells.filter((n) => !board.open[n] && !board.flag[n])
    if (targets.length === 0) continue
    return step.mine
      ? hintFor(board, d, i, 'flag', targets, targets.length === 1 ? 'Bu kareye bayrak koy.' : 'Bu karelere bayrak koy.')
      : hintFor(board, d, i, 'open', targets, targets.length === 1 ? 'Bu kareyi açabilirsin.' : 'Bu kareleri açabilirsin.')
  }

  const guess = safestGuess(board, d)
  if (!guess) return null
  const percent = Math.max(1, Math.round(guess.chance * 100))
  return {
    action: 'guess',
    text: `Şu an kesin bilinen bir kare yok, tahmin etmek zorundasın. Sarı çerçeveli karede mayın olma ihtimali daha düşük görünüyor (yaklaşık %${percent}).`,
    targets: [guess.cell],
    clues: [],
    known: [],
    shared: [],
  }
}

export interface LossReview {
  text: string
  /** Squares that were surely safe before the mine went off (when the text points them out). */
  safe: number[]
  /** The numbers that showed where the mine was. */
  clues: number[]
}

/**
 * What went wrong when a mine went off: whether the square was known to be a mine, whether there
 * were surely safe squares to open instead, or whether it was a guess nobody could avoid.
 * `chorded`: the player tapped an open number and its flags were wrong.
 */
export function reviewLoss(before: MineBoard, tapped: number, chorded: boolean): LossReview {
  const d = deduce(before)
  const safe = [...d.safe.keys()].filter((n) => !before.open[n] && !before.flag[n])
  if (chorded) {
    const wrong = neighbours(before, tapped).filter((n) => before.flag[n] && !before.mine[n])
    const sure = wrong.some((n) => d.safe.has(n))
    return {
      text: `Sayının çevresindeki bir bayrak yanlış yerdeydi; bu yüzden çevresi açılınca mayına denk geldin.${sure ? ' O bayrağın yanlış olduğu sayılardan anlaşılabiliyordu.' : ''} Bayrak koymadan önce iki kez düşün.`,
      safe: [],
      clues: [],
    }
  }
  const step = d.mine.get(tapped)
  if (step !== undefined) {
    return { text: `Bu karenin mayın olduğu belliydi. ${why(before, d, step)}`, safe: [], clues: cluesOf(d.steps[step].reason) }
  }
  if (safe.length > 0) {
    return {
      text: 'Bu kareye dokunmadan önce kesin güvenli kareler vardı (yeşil çerçeveli). Emin olmadığında önce 💡 İpucu düğmesine bakabilirsin.',
      safe,
      clues: [],
    }
  }
  return { text: 'Bu kare bir tahmindi: kesin güvenli bir kare yoktu. Mayın tarlasında bazen şans da gerekir.', safe: [], clues: [] }
}
