import type { PuzzleHint } from '../../core/types'
import { applyMove, decode, legalMoves, pitNumber, type Position } from './rules'

/**
 * The user's pit that the side to move can take the most stones from during its turn,
 * following extra turns (up to a few moves in a row).
 */
export function mostThreatenedPit(position: Position, depth = 3): { pit: number; stones: number } | null {
  const mover = position.turn
  let worst: { pit: number; stones: number } | null = null
  for (const move of legalMoves(position)) {
    const result = applyMove(position, move)
    if (!result) continue
    const capture = result.capture
    if (capture) {
      const stones = capture.kind === 'empty' ? capture.stones - 1 : capture.stones
      if (stones > 0 && (!worst || stones > worst.stones)) worst = { pit: capture.pit, stones }
    }
    if (depth > 1 && !result.over && result.position.turn === mover) {
      const deeper = mostThreatenedPit(result.position, depth - 1)
      if (deeper && (!worst || deeper.stones > worst.stones)) worst = deeper
    }
  }
  return worst
}

/**
 * Puzzle hints that point at the idea instead of the pit: with only six pits,
 * showing the right pit would give the answer away.
 */
export function mangalaPuzzleHint(puzzle: { position: string; bestMove: string; playedMove: string; errorType: string }): PuzzleHint {
  let position
  try {
    position = decode(puzzle.position)
  } catch {
    return { text: 'İpucu: Hamlelerini tek tek dene, her birinin son taşı nereye düşüyor?', marks: [] }
  }
  const best = applyMove(position, Number(puzzle.bestMove))

  if (best?.over && best.sweep?.to === position.turn) {
    return { text: 'İpucu: Kuyularını boşaltıp oyunu bitirmeyi düşün.', marks: [] }
  }
  if (best?.capture?.kind === 'even') {
    return { text: 'İpucu: Son taşınla rakibin bir kuyusunu çift yapabilir misin?', marks: [] }
  }
  if (best?.capture?.kind === 'empty') {
    return { text: 'İpucu: Son taşını kendi boş kuyuna düşür; karşısındaki taşlar senin olur.', marks: [] }
  }
  if (best?.extraTurn) {
    return { text: 'İpucu: Son taşın hazinene düşeceği kuyuyu bul, tekrar oynarsın.', marks: [] }
  }

  // The game move let the opponent take stones: show which pit was in danger.
  if (puzzle.errorType === 'allowed_capture') {
    const afterMistake = applyMove(position, Number(puzzle.playedMove))
    if (afterMistake && !afterMistake.over && afterMistake.position.turn !== position.turn) {
      const worst = mostThreatenedPit(afterMistake.position)
      if (worst && worst.stones >= 2) {
        return {
          text: `İpucu: Kırmızı işaretli ${pitNumber(worst.pit)}. kuyun tehlikede. Onu koruyan ya da boşaltan hamleyi bul.`,
          marks: [{ kind: 'danger', square: String(worst.pit) }],
        }
      }
    }
  }

  const number = pitNumber(Number(puzzle.bestMove))
  return {
    text: number <= 3 ? 'İpucu: Doğru kuyu 1-3 arasında (sol tarafın).' : 'İpucu: Doğru kuyu 4-6 arasında (sağ tarafın).',
    marks: [],
  }
}
