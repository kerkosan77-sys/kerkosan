import type { Lesson } from '../../core/lessons'
import { cornersFor } from './explain'
import { applyMove, countsBySide, decode, encode, initialPosition, legalMoves, squareName, type ReversiPosition } from './rules'

/**
 * Reversi basics, in order. The learner plays Black (moves first). Boards are drawn from the top
 * row (1) to the bottom row (8): x = Black, o = White.
 */

const board = (...rows: string[]) => `x ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')}`

const codesOf = (position: ReversiPosition) => legalMoves(position).map((m) => squareName(m.square))

/** Legal moves that pass `keep` (given the position after the move). */
function movesWhere(position: string, keep: (after: ReversiPosition, flips: number) => boolean): string[] {
  const start = decode(position)
  return legalMoves(start)
    .filter((move) => {
      const result = applyMove(start, squareName(move.square))
      return result !== null && keep(result.position, move.flips.length)
    })
    .map((move) => squareName(move.square))
}

/** The moves with the highest score. */
function best(position: string, score: (code: string) => number): string[] {
  const codes = codesOf(decode(position))
  const values = codes.map(score)
  const top = Math.max(...values)
  return codes.filter((_, i) => values[i] === top)
}

/** Final disc difference for Black with perfect play from `position` (only for a few empty squares). */
function exactResult(position: ReversiPosition): number {
  const moves = legalMoves(position)
  if (moves.length === 0) {
    const counts = countsBySide(position.board)
    return counts.w - counts.b
  }
  const results = moves.map((move) => exactResult(applyMove(position, squareName(move.square))!.position))
  return position.turn === 'w' ? Math.max(...results) : Math.min(...results)
}

const hint = (...squares: string[]) => squares.map((square) => ({ kind: 'hint' as const, square }))

const START = encode(initialPosition())
// Lesson 1: one square turns over discs in two directions.
const MANY = board('........', '........', '..x.o...', '...oo...', '...ox...', '........')
const flipsOf = (position: string) => {
  const moves = legalMoves(decode(position))
  return (code: string) => moves.find((m) => squareName(m.square) === code)?.flips.length ?? 0
}
// Lesson 2: Black can take a1.
const FREE_CORNER = board('........', '.o......', '..x.....', '...xo...', '...ox...')
// Lesson 3: b2 would hand White the a1 corner; c1 takes the same disc safely.
const GIVE_CORNER = board('........', '..ox....', '..x.....', '...o....')
const SAFE_FROM_CORNERS = movesWhere(GIVE_CORNER, (after) => cornersFor(after, 'b').length === 0)
// Lesson 4: pick the move that leaves White the fewest replies.
const MOBILITY = board('........', '........', '..xxx...', '..ooox..', '..xoo...', '...o....')
const repliesAfter = (position: string) => (code: string) => {
  const result = applyMove(decode(position), code)!
  return result.opponentPassed ? 0 : legalMoves(result.position).length
}
// Lesson 5: the last few squares: count to the end.
const ENDGAME = board('xxxxxxxx', 'xxooooox', 'xoxoooox', 'xooxooox', 'xoooxoox', 'xoooox.x', 'xooooo..', 'ooooooo.')
const ENDGAME_BEST = best(ENDGAME, (code) => exactResult(applyMove(decode(ENDGAME), code)!.position))
const ENDGAME_EMPTY = decode(ENDGAME).board.filter((disc) => disc === 0).length

export const REVERSI_LESSONS: Lesson[] = [
  {
    id: 'flip',
    icon: '🔃',
    title: 'Taş çevirmek',
    summary: 'Rakibin taşlarını iki taşının arasına al.',
    steps: [
      {
        text: 'Taşını öyle bir kareye koy ki rakibin taşları, yeni taşınla eski bir taşının arasında düz bir çizgide kalsın. Arada kalanlar senin rengine döner.',
        position: START,
        marks: hint(...codesOf(decode(START))),
      },
      {
        text: 'İlk hamleni yap: oynayabileceğin kareler küçük noktalarla gösterilir.',
        answers: codesOf(decode(START)),
        success: 'Bir beyaz taşı iki siyah taşının arasına aldın ve çevirdin.',
      },
      {
        text: 'Bir kare aynı anda birden fazla yönde taş çevirebilir. En çok taş çeviren hamleyi bul.',
        position: MANY,
        answers: best(MANY, flipsOf(MANY)),
        success: 'Doğru! Ama unutma: çok taş çevirmek her zaman en iyisi değildir.',
        hint: 'Her karenin kaç taş çevirdiğini say: farenin altındaki karede çevrilecek taşlar soluklaşır.',
      },
    ],
    recap: ['Taş, rakibin taşlarını kendi iki taşının arasına alacak şekilde konur.', 'Oynayacak yerin yoksa sıra rakibe geçer.'],
  },
  {
    id: 'corners',
    icon: '📐',
    title: 'Köşeler',
    summary: 'Köşedeki taş bir daha çevrilemez.',
    steps: [
      {
        text: 'Köşedeki taş hiçbir zaman çevrilemez, çünkü onu iki taşın arasına alacak yer yoktur. Köşeler en değerli karelerdir.',
        position: FREE_CORNER,
        marks: hint('a1', 'h1', 'a8', 'h8'),
      },
      {
        text: 'Burada bir köşe alabilirsin. Al!',
        answers: movesWhere(FREE_CORNER, () => true).filter((code) => ['a1', 'h1', 'a8', 'h8'].includes(code)),
        success: 'Köşe senin! Bu taş oyunun sonuna kadar senin kalacak.',
        hint: 'Sol üst köşeye bak.',
      },
    ],
    recap: ['Köşeler bir daha çevrilemez.', 'Köşe alabiliyorsan çoğu zaman al.'],
  },
  {
    id: 'danger-squares',
    icon: '⚠️',
    title: 'Köşe yanındaki tehlike',
    summary: 'Boş köşenin çaprazına oynama.',
    steps: [
      {
        text: 'Boş bir köşenin çaprazındaki kareye (b2, g2, b7, g7) oynamak çoğu zaman rakibe o köşeyi verir. Köşenin hemen yanındaki kareler de risklidir.',
        position: GIVE_CORNER,
        marks: ['b2', 'g2', 'b7', 'g7'].map((square) => ({ kind: 'danger' as const, square })),
      },
      {
        text: 'Rakibe hiçbir köşe vermeyen bir hamle yap.',
        answers: SAFE_FROM_CORNERS,
        success: 'Güzel! b2 oynasaydın beyaz a1 köşesini alabilirdi.',
        hint: 'b2 köşenin çaprazında: oraya oynama.',
        hintMarks: [{ kind: 'danger', square: 'b2' }],
      },
    ],
    recap: ['Boş köşenin çaprazındaki kare tehlikelidir.', 'Hamleden sonra rakip köşe alabilir mi, bak.'],
  },
  {
    id: 'mobility',
    icon: '🧭',
    title: 'Rakibe az hamle bırak',
    summary: 'Seçeneği az kalan rakip kötü yerlere oynamak zorunda kalır.',
    steps: [
      {
        text: 'Hamleden sonra rakibin kaç oynayacak yeri kalıyor? Az seçenek bırakırsan rakip sonunda kötü bir kareye (örneğin köşenin yanına) oynamak zorunda kalır.',
        position: MOBILITY,
      },
      {
        text: 'Beyaza en az oynayacak yer bırakan hamleyi bul.',
        answers: best(MOBILITY, (code) => -repliesAfter(MOBILITY)(code)),
        success: 'Rakibin seçenekleri azaldı. Ustalar böyle oynar: az taş çevirip rakibi sıkıştırır.',
        hint: 'Her hamleden sonra beyazın oynayabileceği kareleri say.',
      },
    ],
    recap: ['Rakibe az seçenek bırakan hamleler iyidir.', 'Ortada kalıp az taş çevirmek çoğu zaman daha güçlüdür.'],
  },
  {
    id: 'endgame',
    icon: '🔢',
    title: 'Oyun sonu',
    summary: 'Son hamlelerde taş sayısı önemlidir.',
    steps: [
      {
        text: 'Son hamlelerde artık köşeden çok taş sayısı önemlidir: oyun sonunda tahtada en çok taşı olan kazanır. Son birkaç kareyi sonuna kadar hesapla.',
        position: ENDGAME,
      },
      {
        text: `${ENDGAME_EMPTY} boş kare kaldı. Oyunun sonunda en çok taşı sana bırakacak hamleyi bul.`,
        answers: ENDGAME_BEST,
        success: 'Doğru! Sona kadar hesaplamak, en çok taşı çeviren hamleyi seçmekten daha iyidir.',
        hint: 'Her hamleden sonra beyazın ne oynayabileceğini ve sende ne kalacağını düşün.',
      },
    ],
    recap: ['Oyun sonunda en çok taşı olan kazanır.', 'Son hamleleri sona kadar hesapla.'],
  },
]
