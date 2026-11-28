import { describe, expect, it } from 'vitest'
import { chord, newBoard, neighbours, reveal, timeText, toggleFlag, withMines, type MineBoard } from './logic'
import { deduce, findHint, reviewLoss } from './solver'

/** A board from a picture: '*' is a mine, anything else is not. */
function boardOf(picture: string[]): MineBoard {
  const rows = picture.length
  const cols = picture[0].length
  const mine = new Uint8Array(rows * cols)
  picture.forEach((line, r) => [...line].forEach((ch, c) => (mine[r * cols + c] = ch === '*' ? 1 : 0)))
  return withMines(newBoard(rows, cols, 0), mine)
}

const at = (board: MineBoard, r: number, c: number) => r * board.cols + c

/** Simple repeatable random numbers. */
function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

describe('Mayın Tarlası rules', () => {
  it('never puts a mine on or around the first square', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const board = reveal(newBoard(9, 9, 10), 40, makeRng(seed))
      expect(board.mine.reduce((a, b) => a + b, 0)).toBe(10)
      for (const n of [40, ...neighbours(board, 40)]) expect(board.mine[n]).toBe(0)
      expect(board.status).toBe('playing')
      // The first square has no mines around it, so an area opens.
      expect(board.open.reduce((a, b) => a + b, 0)).toBeGreaterThan(1)
    }
  })

  it('opens empty areas, loses on a mine and wins when every safe square is open', () => {
    const board = boardOf([
      '*...', //
      '....',
      '....',
    ])
    const opened = reveal(board, at(board, 2, 3))
    // Everything opens except the mine.
    expect(opened.status).toBe('won')
    expect(opened.flag[0]).toBe(1)

    const lost = reveal(board, 0)
    expect(lost.status).toBe('lost')
    expect(lost.exploded).toBe(0)
  })

  it('flags, keeps flagged squares shut, and opens around a number with its flags', () => {
    const board = boardOf([
      '*..', //
      '...',
      '..*',
    ])
    let b = reveal(board, at(board, 0, 1)) // a 1
    expect(b.open[at(b, 0, 1)]).toBe(1)
    b = toggleFlag(b, 0)
    expect(reveal(b, 0)).toBe(b) // a flagged square does not open
    b = chord(b, at(b, 0, 1))
    expect(b.open[at(b, 0, 2)]).toBe(1)
    expect(b.open[at(b, 1, 1)]).toBe(1)
    expect(b.status).toBe('playing')

    // A wrong flag makes the chord open a mine.
    let wrong = reveal(board, at(board, 0, 1))
    wrong = toggleFlag(wrong, at(wrong, 1, 0))
    expect(chord(wrong, at(wrong, 0, 1)).status).toBe('lost')
  })

  it('writes times in minutes and seconds', () => {
    expect(timeText(42.7)).toBe('42 sn')
    expect(timeText(185)).toBe('3 dk 05 sn')
  })
})

describe('Mayın Tarlası coach', () => {
  /** Mines in two top corners; opening the bottom middle opens the two lower rows (numbers 1 2 1). */
  function cornersGame() {
    const board = boardOf([
      '*.*', //
      '...',
      '...',
    ])
    return reveal(board, at(board, 2, 1))
  }

  it('says to start anywhere before the first square', () => {
    expect(findHint(newBoard(9, 9, 10))?.action).toBe('start')
  })

  it('works out every square it can, step by step', () => {
    const b = cornersGame()
    expect([...b.open]).toEqual([0, 0, 0, 1, 1, 1, 1, 1, 1])
    const d = deduce(b)
    expect(d.steps.map((s) => [s.reason.kind, s.mine, s.cells])).toEqual([
      ['pair', true, [2]],
      ['clear', false, [1]],
      ['full', true, [0]],
    ])
  })

  it('explains the first step not acted on yet, then the next one', () => {
    let b = cornersGame()
    const first = findHint(b)!
    expect(first.action).toBe('flag')
    expect(first.targets).toEqual([2])
    expect(first.clues).toEqual([3, 4]) // the 1 and the 2: A and B
    expect(first.shared).toEqual([0, 1])
    expect(first.text).toContain('A ve B sayılarına birlikte bak')
    expect(first.text).toContain('Yani o kare mayın. Bu kareye bayrak koy.')

    b = toggleFlag(b, 2)
    const second = findHint(b)!
    expect(second.action).toBe('open')
    expect(second.targets).toEqual([1])
    expect(second.known).toEqual([2])
    expect(second.text).toBe('Bu 1 sayısının mayını belli. Çevresindeki diğer kapalı kareler güvenli. Bu kareyi açabilirsin.')

    b = reveal(b, 1)
    expect(b.status).toBe('won')
    expect(findHint(b)).toBeNull()
  })

  it('reasons with two numbers together (1-2-2-1)', () => {
    let b = boardOf([
      '.**.', //
      '....',
    ])
    for (const i of [4, 5, 6, 7]) b = reveal(b, i)
    expect([...b.count.slice(4, 8)]).toEqual([1, 2, 2, 1])
    const d = deduce(b)
    expect([...d.mine.keys()].sort()).toEqual([1, 2])
    expect([...d.safe.keys()].sort()).toEqual([0, 3])
  })

  it('spots a wrong flag', () => {
    const b = toggleFlag(cornersGame(), 1)
    const hint = findHint(b)!
    expect(hint.action).toBe('unflag')
    expect(hint.targets).toEqual([1])
    expect(hint.text).toMatch(/^Bu bayrak yanlış yerde/)
  })

  it('suggests the least risky square when nothing is certain', () => {
    const board = boardOf([
      '*.', //
      '..',
    ])
    const b = reveal(board, 3)
    const hint = findHint(b)!
    expect(hint.action).toBe('guess')
    expect(hint.text).toContain('%33')
  })

  it('reviews a lost game: a known mine, or a guess nobody could avoid', () => {
    expect(reviewLoss(cornersGame(), 0, false).text).toMatch(/^Bu karenin mayın olduğu belliydi/)
    const guess = reveal(boardOf(['*.', '..']), 3)
    expect(reviewLoss(guess, 0, false).text).toMatch(/tahmindi/)
  })

  it('tells when a wrong flag made the opened number set off a mine', () => {
    let b = cornersGame()
    b = toggleFlag(b, 1) // wrong: the mine is on 0
    expect(chord(b, 3).status).toBe('lost')
    expect(reviewLoss(b, 3, true).text).toMatch(/bayrak yanlış yerdeydi/)
  })

  it('is never wrong, and solves most of a game on its own quickly', () => {
    let solved = 0
    const started = performance.now()
    for (let seed = 1; seed <= 20; seed++) {
      let b = reveal(newBoard(30, 16, 99), 8 * 16 + 8, makeRng(seed))
      for (let round = 0; round < 500 && b.status === 'playing'; round++) {
        const d = deduce(b)
        for (const n of d.mine.keys()) expect(b.mine[n]).toBe(1)
        for (const n of d.safe.keys()) expect(b.mine[n]).toBe(0)
        const toOpen = [...d.safe.keys()].filter((n) => !b.open[n])
        if (toOpen.length === 0) break
        for (const n of toOpen) b = reveal(b, n)
      }
      if (b.status === 'won') solved++
    }
    // Hard boards often need a guess, but the coach gets through some without one.
    expect(solved).toBeGreaterThan(0)
    expect(performance.now() - started).toBeLessThan(20000)
  })
})
