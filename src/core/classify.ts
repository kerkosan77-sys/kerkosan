/**
 * Move classes, close to Chess.com's game review. Every move of both players gets one.
 * "Kitap" (opening book) and "kaçırılan fırsat" are left out: there is no opening book, and a
 * missed chance already shows up as a mistake.
 */
export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'forced'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

/** Classes in the order they are listed (best first). */
export const CLASSIFICATIONS: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'forced',
  'inaccuracy',
  'mistake',
  'blunder',
]

export const isErrorClass = (c: Classification | undefined): c is 'inaccuracy' | 'mistake' | 'blunder' =>
  c === 'inaccuracy' || c === 'mistake' || c === 'blunder'

/**
 * Minimum drop in winning chances (percentage points) for each class.
 * Close to the bands Chess.com uses, so a piece left for free in an equal
 * chess position (about 25 points) counts as a blunder. Shared by all games.
 */
export const THRESHOLDS = {
  /** Below this the move is as good as the best one. */
  best: 0.5,
  excellent: 2,
  inaccuracy: 5,
  mistake: 10,
  blunder: 20,
} as const

/** "Harika": the best move, and the next best move would have lost at least this much. */
export const ONLY_MOVE_GAP = 15

/** Error band of a drop; anything below an inaccuracy is "good" here. */
export function classifyDrop(drop: number): 'good' | 'inaccuracy' | 'mistake' | 'blunder' {
  if (drop >= THRESHOLDS.blunder) return 'blunder'
  if (drop >= THRESHOLDS.mistake) return 'mistake'
  if (drop >= THRESHOLDS.inaccuracy) return 'inaccuracy'
  return 'good'
}

export interface MoveClassInput {
  /** Winning chances (mover's view) lost compared with the best move. */
  drop: number
  /** The engine's first choice was played. */
  isTopMove: boolean
  /** Winning chances (mover's view) with the best move, and after the move played. */
  winBest: number
  winAfter: number
  /** How much worse the engine's second choice was (mover's view); null if unknown. */
  secondGap: number | null
  /** The only legal move. */
  forced?: boolean
  /** Gives material away on purpose. */
  sacrifice?: boolean
  /** A natural move anyone would play (taking back a piece): never called "Harika". */
  obvious?: boolean
}

export function classifyMove(input: MoveClassInput): Classification {
  if (input.forced) return 'forced'
  const band = classifyDrop(input.drop)
  if (band !== 'good') return band
  // A sacrifice that holds up, in a game that was not already won anyway.
  if (input.sacrifice && input.drop <= THRESHOLDS.excellent && input.winAfter >= 35 && input.winBest <= 90) return 'brilliant'
  if (input.isTopMove && !input.obvious && input.secondGap !== null && input.secondGap >= ONLY_MOVE_GAP && input.winAfter >= 30) {
    return 'great'
  }
  if (input.isTopMove || input.drop < THRESHOLDS.best) return 'best'
  if (input.drop < THRESHOLDS.excellent) return 'excellent'
  return 'good'
}

/** How many winning-chance points were lost (never negative). */
export function winDrop(winBefore: number, winAfter: number): number {
  return Math.max(0, winBefore - winAfter)
}

export const CLASSIFICATION_INFO: Record<Classification, { label: string; symbol: string; className: string }> = {
  brilliant: { label: 'Parlak', symbol: '!!', className: 'brilliant' },
  great: { label: 'Harika', symbol: '!', className: 'great' },
  best: { label: 'En iyi', symbol: '★', className: 'best' },
  excellent: { label: 'Çok iyi', symbol: '✓✓', className: 'excellent' },
  good: { label: 'İyi', symbol: '✓', className: 'good' },
  forced: { label: 'Zorunlu', symbol: '□', className: 'forced' },
  inaccuracy: { label: 'Yanlışlık', symbol: '?!', className: 'inaccuracy' },
  mistake: { label: 'Hata', symbol: '?', className: 'mistake' },
  blunder: { label: 'Büyük hata', symbol: '??', className: 'blunder' },
}
