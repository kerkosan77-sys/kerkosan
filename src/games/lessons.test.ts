import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { stepPosition } from '../core/lessons'
import type { GameModule } from '../core/types'
import { forkTargets } from './chess/logic/motifs'
import { decode as damaDecode } from './dama/rules'
import { decode as goDecode } from './go/rules'
import { decode as mangalaDecode } from './mangala/rules'
import { GAMES } from './registry'
import { decode as reversiDecode } from './reversi/rules'

const VALID: Record<string, (position: string) => unknown> = {
  chess: (fen) => new Chess(fen),
  mangala: mangalaDecode,
  go: goDecode,
  dama: damaDecode,
  reversi: reversiDecode,
}

const lessonsOf = (game: GameModule) => game.lessons ?? []

describe('lessons', () => {
  it('every game has lessons', () => {
    for (const game of GAMES) expect(lessonsOf(game).length, game.id).toBeGreaterThanOrEqual(8)
  })

  for (const game of GAMES) {
    it(`${game.name}: boards are valid and every exercise has legal right answers`, () => {
      const ids = new Set<string>()
      for (const lesson of lessonsOf(game)) {
        expect(ids.has(lesson.id), `${game.id}/${lesson.id} id twice`).toBe(false)
        ids.add(lesson.id)
        expect(lesson.recap.length, lesson.id).toBeGreaterThan(0)
        expect(lesson.steps.some((s) => s.answers), `${lesson.id} has no exercise`).toBe(true)
        lesson.steps.forEach((step, i) => {
          const where = `${game.id}/${lesson.id}/${i + 1}`
          const position = stepPosition(lesson, i)
          expect(() => VALID[game.id](position), where).not.toThrow()
          expect(step.text.length, where).toBeLessThan(260)
          if (!step.answers) return
          expect(step.answers.length, `${where}: no right answer`).toBeGreaterThan(0)
          for (const answer of step.answers) expect(game.playAt(position, answer), `${where}: ${answer} is not legal`).not.toBeNull()
        })
      }
    })
  }

  it('chess exercises do what they say', () => {
    const chess = GAMES.find((g) => g.id === 'chess')!
    const step = (lessonId: string, n: number) => {
      const lesson = lessonsOf(chess).find((l) => l.id === lessonId)!
      return { position: stepPosition(lesson, n), answers: lesson.steps[n].answers! }
    }
    const fork = step('fork', 1)
    expect(forkTargets(chess.playAt(fork.position, fork.answers[0])!.position, 'c7').length).toBeGreaterThanOrEqual(2)
    const pawnFork = step('fork', 2)
    expect(forkTargets(chess.playAt(pawnFork.position, pawnFork.answers[0])!.position, 'e5').length).toBe(2)
    for (const n of [1, 2]) {
      const mate = step('mate', n)
      for (const answer of mate.answers) expect(chess.playAt(mate.position, answer)!.ended).toBe('win')
    }
    expect(step('hanging', 1).answers).not.toContain('c4d5')
  })
})

describe('chess lesson boards', () => {
  it('never leave the side not to move in check', () => {
    const chess = GAMES.find((g) => g.id === 'chess')!
    for (const lesson of lessonsOf(chess)) {
      lesson.steps.forEach((_, i) => {
        const fen = stepPosition(lesson, i)
        // The side to move must not be able to take the other king (that side would be in check).
        const flipped = new Chess(fen)
        expect(flipped.moves({ verbose: true }).some((m) => m.captured === 'k'), `${lesson.id}/${i + 1}`).toBe(false)
      })
    }
  })
})
