import type { PuzzleHint } from '../../core/types'
import { applyMove, decode, legalMoves, playMove, squareName, type DamaPosition } from './rules'

/**
 * Dama puzzle hints: the idea first (a dama to make, a piece to give, which capture route),
 * otherwise the piece that should move.
 */

/** After the move, every forced capture of the opponent lets the mover take more pieces back. */
export function isSacrifice(position: DamaPosition, code: string): boolean {
  const result = applyMove(position, code)
  if (!result || result.move.captured.length > 0) return false
  const replies = legalMoves(result.position)
  if (replies.length === 0 || replies[0].captured.length === 0) return false
  return replies.every((reply) => {
    const after = playMove(result.position, reply)
    const back = legalMoves(after)
    return back.length > 0 && back[0].captured.length > reply.captured.length
  })
}

export function damaPuzzleHint(puzzle: { position: string; bestMove: string; playedMove: string; errorType: string }): PuzzleHint {
  let position: DamaPosition
  try {
    position = decode(puzzle.position)
  } catch {
    return { text: 'İpucu: Hamlenden sonra rakibin taş alıp alamayacağına bak.', marks: [] }
  }
  const best = applyMove(position, puzzle.bestMove)
  if (!best) return { text: 'İpucu: Hamlenden sonra rakibin taş alıp alamayacağına bak.', marks: [] }
  const piece = { kind: 'hint' as const, square: squareName(best.move.from) }

  if (best.move.promotes) {
    return { text: 'İpucu: Yeşil işaretli taşın dama olabilir.', marks: [piece] }
  }
  if (best.move.captured.length > 0) {
    return {
      text: 'İpucu: Almak zorundasın, ama hangi yoldan? Aldıktan sonra rakibin geri alıp alamayacağına bak. Yeşil işaretli taşla al.',
      marks: [piece],
    }
  }
  if (isSacrifice(position, puzzle.bestMove)) {
    return {
      text: 'İpucu: Bir taşını vermek rakibi zorunlu almaya sokar. Ardından daha çok taş alabilir misin? Yeşil işaretli taşla başla.',
      marks: [piece],
    }
  }

  // The game move left pieces to be taken: show them.
  const mistake = applyMove(position, puzzle.playedMove)
  if (mistake) {
    const threats = legalMoves(mistake.position).filter((m) => m.captured.length > 0)
    const landed = mistake.move.path[mistake.move.path.length - 1]
    // The piece that moved is shown where it stands in the puzzle, before the mistake.
    const victims = [...new Set(threats.flatMap((m) => m.captured).map((s) => (s === landed ? mistake.move.from : s)))]
    if (victims.length > 0) {
      return {
        text: 'İpucu: Oyundaki hamlenden sonra kırmızı işaretli taşın alınıyordu. Onu tehlikeye atmayan bir hamle bul.',
        marks: victims.map((s) => ({ kind: 'danger' as const, square: squareName(s) })),
      }
    }
  }
  return { text: 'İpucu: Yeşil işaretli taşla oynamalısın.', marks: [piece] }
}
