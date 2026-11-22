import { describe, expect, it } from 'vitest'
import {
  BOX_INTERVAL_DAYS,
  addDays,
  boxCounts,
  duePuzzles,
  intervalDays,
  isDue,
  nextDueAt,
  relativeDay,
  schedule,
  startOfDay,
} from './leitner'

/** Local time helper: 18 Nov 2026 at the given hour. */
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const midnight = (day: number) => new Date(2026, 10, day, 0, 0, 0, 0).getTime()

describe('intervals', () => {
  it('uses 1, 3, 7, 14 and 30 days for boxes 1-5', () => {
    expect(BOX_INTERVAL_DAYS).toEqual([1, 3, 7, 14, 30])
    expect([1, 2, 3, 4, 5].map(intervalDays)).toEqual([1, 3, 7, 14, 30])
  })

  it('clamps out-of-range boxes', () => {
    expect(intervalDays(0)).toBe(1)
    expect(intervalDays(9)).toBe(30)
  })
})

describe('schedule', () => {
  it('moves a correctly solved puzzle up one box and brings it back later', () => {
    expect(schedule({ box: 1 }, 'correct', at(18))).toEqual({ box: 2, dueAt: midnight(21) })
    expect(schedule({ box: 2 }, 'correct', at(18))).toEqual({ box: 3, dueAt: midnight(25) })
    expect(schedule({ box: 3 }, 'correct', at(18))).toEqual({ box: 4, dueAt: midnight(18 + 14) })
    expect(schedule({ box: 4 }, 'correct', at(18))).toEqual({ box: 5, dueAt: addDays(midnight(18), 30) })
  })

  it('keeps a puzzle in the last box with the longest interval', () => {
    expect(schedule({ box: 5 }, 'correct', at(18))).toEqual({ box: 5, dueAt: addDays(midnight(18), 30) })
  })

  it('sends a wrongly solved puzzle back to box 1, due tomorrow', () => {
    expect(schedule({ box: 4 }, 'wrong', at(18))).toEqual({ box: 1, dueAt: midnight(19) })
    expect(schedule({ box: 1 }, 'wrong', at(18))).toEqual({ box: 1, dueAt: midnight(19) })
  })

  it('counts "tomorrow" by calendar day, even late at night', () => {
    // Failed at 23:50 -> due from midnight, ten minutes later.
    expect(schedule({ box: 2 }, 'wrong', at(18, 23, 50)).dueAt).toBe(midnight(19))
    // Failed just after midnight -> still the next calendar day, not the same one.
    expect(schedule({ box: 2 }, 'wrong', at(19, 0, 5)).dueAt).toBe(midnight(20))
  })

  it('crosses month ends correctly', () => {
    expect(schedule({ box: 4 }, 'correct', at(28)).dueAt).toBe(new Date(2026, 11, 28).getTime())
  })
})

describe('due puzzles', () => {
  const puzzle = (id: string, dueAt: number, createdAt = 0, box = 1) => ({ id, dueAt, createdAt, box })

  it('treats a puzzle as due from its due time on', () => {
    expect(isDue(puzzle('a', midnight(19)), at(18, 23, 59))).toBe(false)
    expect(isDue(puzzle('a', midnight(19)), midnight(19))).toBe(true)
  })

  it('lists due puzzles, longest waiting first, then oldest', () => {
    const list = [
      puzzle('later', midnight(25)),
      puzzle('new-b', at(18, 10), 2),
      puzzle('overdue', midnight(15)),
      puzzle('new-a', at(18, 10), 1),
    ]
    expect(duePuzzles(list, at(18, 12)).map((p) => p.id)).toEqual(['overdue', 'new-a', 'new-b'])
  })

  it('finds when the next puzzle becomes due', () => {
    const list = [puzzle('a', midnight(25)), puzzle('b', midnight(21)), puzzle('due', midnight(10))]
    expect(nextDueAt(list, at(18))).toBe(midnight(21))
    expect(nextDueAt([puzzle('due', midnight(10))], at(18))).toBeNull()
  })

  it('counts puzzles per box', () => {
    const list = [puzzle('a', 0, 0, 1), puzzle('b', 0, 0, 1), puzzle('c', 0, 0, 3), puzzle('d', 0, 0, 5)]
    expect(boxCounts(list)).toEqual([2, 0, 1, 0, 1])
  })
})

describe('date helpers', () => {
  it('finds the start of the local day', () => {
    expect(startOfDay(at(18, 17, 45))).toBe(midnight(18))
  })

  it('describes due dates relative to today in Turkish', () => {
    expect(relativeDay(at(18, 9), at(18, 20))).toBe('bugün')
    expect(relativeDay(midnight(19), at(18, 23))).toBe('yarın')
    expect(relativeDay(midnight(21), at(18))).toBe('3 gün sonra')
  })
})
