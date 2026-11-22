import type { BoardMark, PuzzleHint } from '../../core/types'
import { opposite } from '../../core/types'
import { allGroups, applyMove, colorOf, coordOf, decode, groupAt, legalPoints, type GoPosition, type Group } from './rules'

/** Where a point lies on the board, as "tahtanın … bölgesinde". */
const ZONE_NAMES = [
  ['sol üst köşesinde', 'üst kenarında', 'sağ üst köşesinde'],
  ['sol kenarında', 'ortasında', 'sağ kenarında'],
  ['sol alt köşesinde', 'alt kenarında', 'sağ alt köşesinde'],
]

function zoneOf(index: number, size: number): { row: number; col: number } {
  const third = (v: number) => Math.min(2, Math.floor((v * 3) / size))
  return { row: third(Math.floor(index / size)), col: third(index % size) }
}

/** The board third the answer lies in, with its playable points marked. */
export function zoneHint(position: GoPosition, answer: number, lead = 'İpucu:'): PuzzleHint {
  const { size } = position
  const zone = zoneOf(answer, size)
  const marks: BoardMark[] = legalPoints(position)
    .filter((p) => {
      const z = zoneOf(p, size)
      return z.row === zone.row && z.col === zone.col
    })
    .map((p) => ({ kind: 'hint', square: coordOf(p, size) }))
  return { text: `${lead} Doğru hamle tahtanın ${ZONE_NAMES[zone.row][zone.col]}. İşaretli bölgeye bak.`, marks }
}

function ringStones(stones: number[], size: number, kind: 'danger' | 'threat'): BoardMark[] {
  return stones.map((s) => ({ kind, square: coordOf(s, size) }))
}

function biggest(groups: Group[]): Group | null {
  return groups.reduce<Group | null>((best, g) => (!best || g.stones.length > best.stones.length ? g : best), null)
}

/**
 * Puzzle hints that point at the idea first (stones in atari, a group to save or to attack)
 * and otherwise at the part of the board where the answer is.
 */
export function goPuzzleHint(puzzle: { position: string; bestMove: string; playedMove: string; errorType: string }): PuzzleHint {
  let position: GoPosition
  try {
    position = decode(puzzle.position)
  } catch {
    return { text: 'İpucu: Tek nefesi kalan taşlara ve rakibinin son hamlesine bak.', marks: [] }
  }
  const { size } = position
  const best = applyMove(position, puzzle.bestMove)
  if (!best) return { text: 'İpucu: Tek nefesi kalan taşlara ve rakibinin son hamlesine bak.', marks: [] }
  if (best.pass) return { text: 'İpucu: Belki de oynanacak işe yarar bir yer kalmamıştır.', marks: [] }

  const mine = colorOf(position.turn)
  const theirs = colorOf(opposite(position.turn))
  const groups = allGroups(position.board, size)

  // The answer captures stones.
  if (best.captured.length > 0) {
    const target = groupAt(position.board, size, best.captured[0])!
    const one = target.stones.length === 1
    return {
      text: `İpucu: Rakibinin turuncu işaretli ${one ? 'taşının' : 'taşlarının'} tek nefesi kaldı. Ne yapabilirsin?`,
      marks: ringStones(target.stones, size, 'threat'),
    }
  }

  // The answer saves a group in atari.
  const saved = biggest(
    groups.filter((g) => {
      if (g.color !== mine || g.liberties.length !== 1) return false
      const after = groupAt(best.position.board, size, g.stones[0])
      return !!after && after.liberties.length >= 2
    }),
  )
  if (saved) {
    return {
      text: `İpucu: Kırmızı işaretli ${saved.stones.length === 1 ? 'taşının' : 'taşlarının'} tek nefesi kaldı. Onları kurtarmanın yolunu bul.`,
      marks: ringStones(saved.stones, size, 'danger'),
    }
  }

  // The answer puts an opponent group into atari.
  const attacked = biggest(
    groups.filter((g) => {
      if (g.color !== theirs || g.liberties.length < 2) return false
      const after = groupAt(best.position.board, size, g.stones[0])
      return !!after && after.liberties.length === 1
    }),
  )
  if (attacked && attacked.stones.length >= 2) {
    return {
      text: 'İpucu: Rakibinin turuncu işaretli taşlarını atariye sokabilirsin: tek nefesleri kalsın.',
      marks: ringStones(attacked.stones, size, 'threat'),
    }
  }

  // The idea behind the mistake, then where to look.
  if (puzzle.errorType === 'early_pass') return zoneHint(position, best.point, 'İpucu: Pas geçmek için erken.')
  if (puzzle.errorType === 'self_atari') {
    return zoneHint(position, best.point, 'İpucu: Oyundaki hamlen taşlarını atariye sokuyordu; nefeslerini azaltmayan bir hamle ara.')
  }
  return zoneHint(position, best.point)
}
