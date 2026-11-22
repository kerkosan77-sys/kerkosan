/**
 * Leitner boxes: a puzzle in box N comes back after BOX_INTERVAL_DAYS[N-1] days.
 * Solved on the first try -> next box (comes back later). Anything else -> box 1 (back tomorrow).
 * Due dates are local midnights, so "tomorrow" means any time tomorrow.
 */
export const BOX_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const
export const MAX_BOX = BOX_INTERVAL_DAYS.length

export type ReviewResult = 'correct' | 'wrong'

export interface Schedulable {
  box: number
  dueAt: number
  createdAt: number
}

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Calendar-day arithmetic (safe across daylight-saving changes). */
export function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function clampBox(box: number): number {
  return Math.min(MAX_BOX, Math.max(1, Math.round(box) || 1))
}

export function intervalDays(box: number): number {
  return BOX_INTERVAL_DAYS[clampBox(box) - 1]
}

/** New box and due date after a review. */
export function schedule(current: Pick<Schedulable, 'box'>, result: ReviewResult, now: number): { box: number; dueAt: number } {
  const box = result === 'correct' ? Math.min(clampBox(current.box) + 1, MAX_BOX) : 1
  return { box, dueAt: addDays(startOfDay(now), intervalDays(box)) }
}

export function isDue(puzzle: Pick<Schedulable, 'dueAt'>, now: number): boolean {
  return puzzle.dueAt <= now
}

/** Puzzles to review now: the longest-waiting first, then the oldest. */
export function duePuzzles<T extends Schedulable>(puzzles: T[], now: number): T[] {
  return puzzles.filter((p) => isDue(p, now)).sort((a, b) => a.dueAt - b.dueAt || a.createdAt - b.createdAt)
}

/** When the next not-yet-due puzzle becomes due, or null if none is waiting. */
export function nextDueAt(puzzles: Schedulable[], now: number): number | null {
  let next: number | null = null
  for (const puzzle of puzzles) {
    if (puzzle.dueAt > now && (next === null || puzzle.dueAt < next)) next = puzzle.dueAt
  }
  return next
}

/** How many puzzles sit in each box (index 0 = box 1). */
export function boxCounts(puzzles: Pick<Schedulable, 'box'>[]): number[] {
  const counts = BOX_INTERVAL_DAYS.map(() => 0)
  for (const puzzle of puzzles) counts[clampBox(puzzle.box) - 1]++
  return counts
}

/** "bugün", "yarın", "3 gün sonra" */
export function relativeDay(timestamp: number, now: number): string {
  const days = Math.round((startOfDay(timestamp) - startOfDay(now)) / 86_400_000)
  if (days <= 0) return 'bugün'
  if (days === 1) return 'yarın'
  return `${days} gün sonra`
}
