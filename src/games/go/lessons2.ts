import type { Lesson } from '../../core/lessons'
import { applyMove, colorOf, coordOf, decode, groupAt, indexOf, legalPoints, neighbours, type GoMoveResult, type GoPosition } from './rules'

/** Go level 2: simple tactics. Boards from the top (row 9) down: x = Black (the learner), o = White. */

const blank = (rows: Record<number, string>) =>
  `x ${Array.from({ length: 9 }, (_, i) => rows[9 - i] ?? '.........').join('/')} - 0 7.5`

function movesWhere(position: string, keep: (result: GoMoveResult, start: GoPosition) => boolean): string[] {
  const start = decode(position)
  return legalPoints(start)
    .map((point) => coordOf(point, start.size))
    .filter((move) => {
      const result = applyMove(start, move)
      return result !== null && keep(result, start)
    })
}

const BLACK = colorOf('w')
const WHITE = colorOf('b')
const at = (coord: string) => indexOf(coord, 9)!
const hint = (...coords: string[]) => coords.map((square) => ({ kind: 'hint' as const, square }))

/** White groups with a single liberty after the move. */
function whiteInAtari(position: GoPosition): number[][] {
  const seen = new Set<number>()
  const groups: number[][] = []
  position.board.forEach((stone, point) => {
    if (stone !== WHITE || seen.has(point)) return
    const group = groupAt(position.board, position.size, point)!
    group.stones.forEach((s) => seen.add(s))
    if (group.liberties.length === 1) groups.push(group.stones)
  })
  return groups
}

/** The atari works: whatever White does at the last liberty, the group is left with one liberty or none. */
function atariCannotEscape(result: GoMoveResult): boolean {
  const groups = whiteInAtari(result.position)
  if (groups.length === 0) return false
  return groups.some((stones) => {
    const liberty = groupAt(result.position.board, 9, stones[0])!.liberties[0]
    const escape = applyMove(result.position, coordOf(liberty, 9))
    if (!escape) return true
    const grown = groupAt(escape.position.board, 9, stones[0])
    return grown === null || grown.liberties.length <= 1
  })
}

/** A single empty point surrounded only by Black stones (or the edge). */
const isEye = (position: GoPosition, point: number) =>
  position.board[point] === 0 && neighbours(point, position.size).every((n) => position.board[n] === BLACK)

// Lesson 1: two diagonal black stones; White threatens to cut at D4.
const CUT = blank({ 5: '...xo....', 4: '....x....' })
// Lesson 2: the white stone B2 has two liberties (A2, B1); only one atari drives it into the corner.
const SIDE = blank({ 3: 'xx.......', 2: '.ox......' })
// Lesson 3: two white stones, each with two liberties, share the point E5.
const DOUBLE = blank({ 6: '...x.x...', 5: '..xo.ox..' })
// Lesson 4: a black group around a straight three-point space (A1, B1, C1).
const THREE = blank({ 3: 'ooooo....', 2: 'xxxxo....', 1: '...xo....' })

export const GO_LESSONS_2: Lesson[] = [
  {
    id: 'connect',
    level: 2,
    icon: '🔗',
    title: 'Kesmek ve bağlamak',
    summary: 'Taşlarını birbirine bağla, kesilmelerine izin verme.',
    steps: [
      {
        text: 'Çapraz duran iki taş sağlam bağlı değildir. Beyaz D4 noktasına oynarsa taşlarını ikiye böler (keser); ayrılan zayıf taşlar kolay avlanır.',
        position: CUT,
        marks: [{ kind: 'danger', square: 'D4' }],
      },
      {
        text: 'İki siyah taşını birbirine bağla.',
        answers: movesWhere(CUT, (result) => {
          const group = groupAt(result.position.board, 9, at('D5'))
          return group !== null && group.stones.includes(at('E4'))
        }),
        success: 'Bağlandı! Artık tek ve güçlü bir grup.',
        hint: 'Kesme noktasına sen oyna.',
      },
    ],
    recap: ['Çapraz taşlar kesilebilir: kesme noktasını gör.', 'Bağlı taşlar birbirine nefes verir.'],
  },
  {
    id: 'side-atari',
    level: 2,
    icon: '↙️',
    title: 'Doğru taraftan atari',
    summary: 'Rakibi kaçamayacağı yöne, kenara doğru sür.',
    steps: [
      {
        text: 'Beyaz B2 taşının iki nefesi var: A2 ve B1. Hangi taraftan atari yaptığın önemlidir: rakibi kenara ve köşeye doğru sürersen kaçamaz.',
        position: SIDE,
        marks: hint('A2', 'B1'),
      },
      {
        text: 'Öyle bir atari yap ki beyaz kaçmaya çalışsa bile yakalansın.',
        answers: movesWhere(SIDE, atariCannotEscape),
        success: 'Beyaz A2\'ye kaçarsa grubunun yine tek nefesi kalır (A1) ve onu alırsın.',
        hint: 'Beyazı köşeye doğru it: kaçacağı yerde nefes olmasın.',
      },
    ],
    recap: ['Atariyi rakibin kaçamayacağı taraftan yap.', 'Kenar ve köşe kaçan taşın düşmanıdır.'],
  },
  {
    id: 'double-atari',
    level: 2,
    icon: '✌️',
    title: 'Çifte atari',
    summary: 'Tek hamleyle iki grubu birden atariye sok.',
    steps: [
      {
        text: 'İki beyaz taşın da ikişer nefesi var ve E5 noktası ikisinin de nefesi. Tek bir hamle ikisini birden atariye sokabilir: rakip ancak birini kurtarabilir.',
        position: DOUBLE,
        marks: hint('E5'),
      },
      {
        text: 'Çifte atari yap!',
        answers: movesWhere(DOUBLE, (result) => whiteInAtari(result.position).length >= 2),
        success: 'Beyaz birini kurtarırsa öbürünü alırsın.',
        hint: 'İki beyaz taşın ortak nefesine oyna.',
      },
    ],
    recap: ['Çifte atari: iki grubu birden atariye sokmak.', 'Rakip ikisini birden kurtaramaz.'],
  },
  {
    id: 'vital-point',
    level: 2,
    icon: '🎯',
    title: 'Hayati nokta',
    summary: 'Üç noktalık göz alanının ortası iki göz yapar.',
    steps: [
      {
        text: 'Siyah grubun içinde yan yana üç boş nokta var: A1, B1, C1. Ortadaki nokta hayatidir: oraya kim oynarsa grubun kaderini o belirler.',
        position: THREE,
        marks: hint('A1', 'B1', 'C1'),
      },
      {
        text: 'Grubuna iki göz yaptıracak hamleyi bul.',
        answers: movesWhere(THREE, (result) => {
          const group = groupAt(result.position.board, 9, at('A2'))
          return group !== null && group.liberties.filter((p) => isEye(result.position, p)).length >= 2
        }),
        success: 'İki göz: A1 ve C1. Grubun artık yakalanamaz.',
        hint: 'Üç noktanın ortasına oyna.',
      },
      {
        text: 'Ters durumda da aynısı geçerli: rakibin üç noktalık göz alanının ortasına oynarsan o grup iki göz yapamaz ve ölür.',
      },
    ],
    recap: ['Üçlü göz alanının ortası hayati noktadır.', 'Kendi grubunda oraya oyna, rakibinkinde de oraya oyna.'],
  },
]
