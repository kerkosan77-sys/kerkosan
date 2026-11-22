import type { BoardMark, Side } from './types'

/**
 * Short lessons that teach the basics of a game, like a course: a few steps of plain text with a
 * board to look at, and small exercises where the learner plays the move the lesson asks for.
 */

export interface LessonStep {
  /** One to three short sentences, shown in large type. */
  text: string
  /** Board for this step; when left out, the previous step's board is shown again. */
  position?: string
  /** Squares or moves to point at (hint = green, danger = red ring, threat = arrow…). */
  marks?: BoardMark[]
  lastMove?: string
  /** Makes the step an exercise: the learner plays a move, and any of these counts as right. */
  answers?: string[]
  /** Shown after a right answer. */
  success?: string
  /** Shown after a wrong try. */
  hint?: string
  /** Shown on the board after a wrong try. */
  hintMarks?: BoardMark[]
}

export interface Lesson {
  /** Stable id: progress is saved under it. */
  id: string
  title: string
  /** One line for the lesson list. */
  summary: string
  icon: string
  steps: LessonStep[]
  /** "Unutma" points shown when the lesson is finished. */
  recap: string[]
  /** The learner's side (shown at the bottom); the first player by default. */
  side?: Side
  /** 1 = basics (default), 2 = tactics and strategy. */
  level?: number
}

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Seviye 1 · Temel bilgiler',
  2: 'Seviye 2 · Taktik ve strateji',
}

export const levelOf = (lesson: Lesson): number => lesson.level ?? 1

/** The board of step `index`: its own position or the latest one before it. */
export function stepPosition(lesson: Lesson, index: number): string {
  for (let i = index; i >= 0; i--) {
    const position = lesson.steps[i]?.position
    if (position) return position
  }
  throw new Error(`Derste tahta yok: ${lesson.id}`)
}
