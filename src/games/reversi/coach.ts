import type { CoachWarning, PuzzleHint } from '../../core/types'
import { cornersFor } from './explain'
import {
  CORNERS,
  applyMove,
  colOf,
  cornerNear,
  decode,
  discCount,
  legalMoves,
  movesFor,
  opponentOf,
  rowOf,
  squareName,
  type ReversiPosition,
} from './rules'

/**
 * Reversi coach and puzzle hints: corners are the big idea for beginners, so the coach warns before
 * a move that hands the opponent a corner (or plays the diagonal square next to an empty corner)
 * when another move would not, and the questions point at corners, the opponent's options and,
 * late in the game, the disc count.
 */

/** Corners the opponent could take after each legal move. */
function cornersAfterEach(position: ReversiPosition): Map<string, number[]> {
  const opponent = opponentOf(position.turn)
  const result = new Map<string, number[]>()
  for (const move of legalMoves(position)) {
    const code = squareName(move.square)
    result.set(code, cornersFor(applyMove(position, code)!.position, opponent))
  }
  return result
}

export function reversiCoachWarning(position: ReversiPosition, code: string): CoachWarning | null {
  const after = cornersAfterEach(position)
  const mine = after.get(code)
  if (!mine || after.size < 2) return null
  const fewest = Math.min(...[...after.values()].map((c) => c.length))
  if (mine.length > fewest) {
    const safer = [...after.values()].find((c) => c.length === fewest) ?? []
    const corner = mine.find((c) => !safer.includes(c)) ?? mine[0]
    return {
      text: `Bu hamleden sonra rakip ${squareName(corner)} köşesini alabilir. Köşedeki taş bir daha çevrilemez.`,
      marks: [{ kind: 'threat', square: squareName(corner) }],
    }
  }
  const square = applyMove(position, code)!.move.square
  const near = cornerNear(square)
  if (near?.kind === 'x' && position.board[near.corner] === 0) {
    const calmer = [...after.entries()].some(([other, corners]) => {
      const n = cornerNear(applyMove(position, other)!.move.square)
      return corners.length <= mine.length && n?.kind !== 'x'
    })
    if (calmer) {
      return {
        text: `${squareName(square)} köşenin çaprazındaki kare: buraya oynamak çoğu zaman rakibe ${squareName(near.corner)} köşesini açar.`,
        marks: [{ kind: 'threat', square: squareName(near.corner) }],
      }
    }
  }
  return null
}

export function reversiCoachQuestions(position: ReversiPosition): string[] {
  const opponent = opponentOf(position.turn)
  const myCorners = legalMoves(position).some((m) => CORNERS.includes(m.square))
  const theirCorners = movesFor(position.board, opponent).some((m) => CORNERS.includes(m.square))
  const first = myCorners
    ? 'Alabileceğin bir köşe var. Bulabilir misin?'
    : theirCorners
      ? 'Dikkat: rakibin bir köşeyi alabilecek durumda. Hamlen bunu engelliyor mu?'
      : 'Köşelerin yanındaki karelere (özellikle çaprazdakine) oynamadan önce iki kez düşün.'
  const second = 'Hamlenden sonra rakibin kaç oynayacak yeri kalıyor? Az seçenek bırakan hamleler iyidir.'
  const third =
    discCount(position.board).empty <= 14
      ? 'Oyun sonuna yaklaştın: artık taş sayısı önemli. Hangi hamle sonunda sende en çok taş bırakır?'
      : 'Çok taş çevirmek her zaman iyi değildir: az çevirip ortada kalmak çoğu zaman daha güçlüdür.'
  return [first, second, third]
}

export function reversiPuzzleHint(puzzle: { position: string; bestMove: string; playedMove: string; errorType: string }): PuzzleHint {
  let position: ReversiPosition
  try {
    position = decode(puzzle.position)
  } catch {
    return { text: 'İpucu: Köşelere ve rakibin seçeneklerine bak.', marks: [] }
  }
  const best = applyMove(position, puzzle.bestMove)
  if (!best) return { text: 'İpucu: Köşelere ve rakibin seçeneklerine bak.', marks: [] }
  const opponent = opponentOf(position.turn)

  if (CORNERS.includes(best.move.square)) {
    return {
      text: 'İpucu: Köşelerden birini alabilir misin?',
      marks: CORNERS.map((c) => ({ kind: 'hint' as const, square: squareName(c) })),
    }
  }
  const mistake = applyMove(position, puzzle.playedMove)
  if (mistake) {
    const avoid = cornersFor(best.position, opponent)
    const given = cornersFor(mistake.position, opponent).filter((c) => !avoid.includes(c))
    if (given.length > 0) {
      return {
        text: 'İpucu: Oyundaki hamlen rakibe kırmızı işaretli köşeyi açıyordu. Köşeyi vermeyen bir hamle bul.',
        marks: given.map((c) => ({ kind: 'danger' as const, square: squareName(c) })),
      }
    }
  }
  // The quarter of the board the answer is in, with its playable squares marked.
  const quarter = (s: number) => (rowOf(s) < 4 ? 0 : 2) + (colOf(s) < 4 ? 0 : 1)
  const target = quarter(best.move.square)
  const names = ['sol üst', 'sağ üst', 'sol alt', 'sağ alt']
  return {
    text: `İpucu: Doğru hamle tahtanın ${names[target]} çeyreğinde, işaretli karelerden biri.`,
    marks: legalMoves(position)
      .filter((m) => quarter(m.square) === target)
      .map((m) => ({ kind: 'hint' as const, square: squareName(m.square) })),
  }
}

/** One short note before the user's move: the most urgent thing to look at, without naming a move. */
export function reversiCoachTip(position: ReversiPosition): string {
  if (legalMoves(position).some((m) => CORNERS.includes(m.square))) return 'Alabileceğin bir köşe var. Bulabilir misin?'
  if (movesFor(position.board, opponentOf(position.turn)).some((m) => CORNERS.includes(m.square))) return 'Dikkat: rakip bir köşe alabilir. Bunu engelle.'
  if (discCount(position.board).empty <= 14) return 'Oyun sonu: sonunda en çok taş bırakan hamleyi seç.'
  return 'Az taş çevir, rakibe az hamle bırak. Köşe yanlarına oynama.'
}
