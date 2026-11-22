import type { Lesson } from '../../core/lessons'
import { applyMove, colorOf, decode, encode, groupAt, indexOf, legalPoints, coordOf, type GoPosition } from './rules'

/**
 * Go basics on the 9×9 board, in order. The learner plays Black (moves first). Boards are drawn
 * row by row from the top (row 9) to the bottom (row 1): x = Black, o = White.
 */

const board = (...rows: string[]) => `x ${rows.join('/')} - 0 7.5`
const EMPTY_ROW = '.........'
const blank = (rows: Record<number, string>) =>
  board(...Array.from({ length: 9 }, (_, i) => rows[9 - i] ?? EMPTY_ROW))

/** Moves (coordinates) that pass `keep`, given the position before and the result. */
function movesWhere(position: string, keep: (result: NonNullable<ReturnType<typeof applyMove>>, start: GoPosition) => boolean): string[] {
  const start = decode(position)
  return legalPoints(start)
    .map((point) => coordOf(point, start.size))
    .filter((move) => {
      const result = applyMove(start, move)
      return result !== null && keep(result, start)
    })
}

const hint = (...coords: string[]) => coords.map((square) => ({ kind: 'hint' as const, square }))

// Lesson 1: a white stone with one liberty left (E4).
const ATARI = blank({ 6: '....x....', 5: '...xox...' })
// Lesson 2: two white stones with one liberty (E4), and a white stone on the edge (last liberty A4).
const TWO_STONES = blank({ 6: '...xx....', 5: '..xoox...', 4: '...x.....' })
const EDGE = blank({ 6: 'x........', 5: 'ox.......' })
// Lesson 3: a black stone in atari; the escape is E4.
const ESCAPE = blank({ 6: '....o....', 5: '...oxo...' })
const escapes = movesWhere(ESCAPE, (result) => {
  const group = groupAt(result.position.board, result.position.size, indexOf('E5', 9)!)
  return group !== null && group.color === colorOf('w') && group.liberties.length >= 2
})
// Lesson 4: a living group with two eyes (A1, C1), and a group that needs its second eye.
const TWO_EYES = blank({ 3: 'ooooo....', 2: 'xxxxo....', 1: '.x.xo....' })
const ONE_EYE = blank({ 3: 'oooooo...', 2: 'xxxxxo...', 1: '.x..xo...' })
// Lesson 5: Black takes D5 at E5; White may not take back at once.
const KO = blank({ 6: '...xo....', 5: '..xo.o...', 4: '...xo....' })
const KO_AFTER = encode(applyMove(decode(KO), 'E5')!.position)
// Lesson 6: good first moves on 9×9: the third and fourth lines near the corners.
const OPENING_POINTS = ['C', 'D', 'F', 'G'].flatMap((column) => ['3', '4', '6', '7'].map((row) => `${column}${row}`))
const EMPTY_BOARD = blank({})

export const GO_LESSONS: Lesson[] = [
  {
    id: 'liberties',
    icon: '💨',
    title: 'Nefes',
    summary: 'Taşın yanındaki boş noktalar onun nefesleridir.',
    steps: [
      {
        text: 'Taşlar çizgilerin kesiştiği noktalara konur ve bir daha yer değiştirmez. Bir taşın hemen yanındaki boş noktalar onun nefesleridir. Ortadaki taşın 4 nefesi var.',
        position: blank({ 5: '....x....' }),
        marks: hint('E6', 'D5', 'F5', 'E4'),
      },
      {
        text: 'Kenardaki taşın 3, köşedekinin sadece 2 nefesi vardır. Nefesi azaldıkça taş zayıflar.',
        position: blank({ 5: 'x........', 1: 'x........' }),
        marks: hint('A6', 'A4', 'B5', 'A2', 'B1'),
      },
      {
        text: 'Beyaz taşın tek nefesi kaldı. Buna "atari" denir. Son nefesini kapat ve taşı yakala!',
        position: ATARI,
        answers: movesWhere(ATARI, (result) => result.captured.length > 0),
        success: 'Yakaladın! Nefesi kalmayan taş tahtadan alınır.',
        hint: 'Beyaz taşın yanında hâlâ boş olan noktayı bul.',
      },
    ],
    recap: ['Bir taşın nefesleri: yanındaki boş noktalar.', 'Tek nefesi kalan taş ataridedir: bir hamle sonra alınabilir.'],
  },
  {
    id: 'capture',
    icon: '✊',
    title: 'Taş yakalamak',
    summary: 'Bir grubun bütün nefeslerini kapatırsan onu alırsın.',
    steps: [
      {
        text: 'Yan yana duran taşlar bir grup olur ve nefeslerini paylaşır. Grubun bütün nefeslerini kapatırsan bütün taşlarını birden alırsın.',
        position: TWO_STONES,
        marks: hint('E4'),
      },
      {
        text: 'İki beyaz taşın tek nefesi kaldı. Onları yakala!',
        answers: movesWhere(TWO_STONES, (result) => result.captured.length === 2),
        success: 'İki taş birden! Yakaladığın her taş sonunda sana puan getirir.',
        hint: 'Beyaz grubun son boş komşusu E4.',
      },
      {
        text: 'Kenarda taş yakalamak daha kolaydır, çünkü orada daha az nefes vardır. Bu beyaz taşı yakala.',
        position: EDGE,
        answers: movesWhere(EDGE, (result) => result.captured.length > 0),
        success: 'Kenardaki taşın sadece 3 nefesi vardı.',
        hint: 'A5 taşının son nefesi aşağıda.',
      },
    ],
    recap: ['Grup, nefeslerini paylaşan yan yana taşlardır.', 'Bütün nefesleri kapanan grup tahtadan alınır.'],
  },
  {
    id: 'escape',
    icon: '🏃',
    title: 'Atariden kaçmak',
    summary: 'Tek nefesi kalan taşını büyüterek kurtar.',
    steps: [
      {
        text: 'Siyah taşının tek nefesi kaldı: atarideyiz. Beyaz sıradaki hamlesinde onu alabilir.',
        position: ESCAPE,
        marks: [{ kind: 'danger', square: 'E5' }],
      },
      {
        text: 'Son nefese taş koyarak kaç: grubun büyür ve yeni nefesler kazanır.',
        answers: escapes,
        success: 'Kurtuldun! Grubunun artık 3 nefesi var.',
        hint: 'Taşının hâlâ boş olan tek komşusu E4.',
      },
      {
        text: 'Kaçmadan önce yeni nefesleri say. Kenara doğru ya da rakip taşların arasına kaçmak çoğu zaman işe yaramaz: grup yine atariye düşer.',
      },
    ],
    recap: ['Atarideki taşa son nefesinden taş ekleyerek kaçabilirsin.', 'Kaçış yeni nefes getirmiyorsa taşı bırakıp başka yere oyna.'],
  },
  {
    id: 'eyes',
    icon: '👀',
    title: 'İki göz',
    summary: 'İki gözü olan grup hiç yakalanamaz.',
    steps: [
      {
        text: 'Siyah grubun içinde iki ayrı boş nokta var: A1 ve C1. Bunlara "göz" denir. Beyaz bu noktalara taş koyamaz, çünkü konan taşın hiç nefesi olmaz.',
        position: TWO_EYES,
        marks: hint('A1', 'C1'),
      },
      {
        text: 'İki gözü olan grup hiçbir zaman yakalanamaz: buna canlı grup denir. Tek gözlü grup ise rakip etrafını sarınca yakalanabilir.',
      },
      {
        text: 'Bu grubun bir gözü var (A1). C1 ve D1 boş. İkinci gözü yapacak hamleyi bul ve grubunu kurtar.',
        position: ONE_EYE,
        answers: ['C1', 'D1'],
        success: 'İki göz! Grubun artık güvende.',
        hint: 'C1-D1 boşluğunu ikiye böl.',
        hintMarks: hint('C1', 'D1'),
      },
    ],
    recap: ['İki ayrı gözü olan grup canlıdır.', 'Grubunu iki göz yapabileceği kadar geniş tut.'],
  },
  {
    id: 'ko',
    icon: '🔄',
    title: 'Ko kuralı',
    summary: 'Alınan taş hemen geri alınamaz.',
    steps: [
      {
        text: 'Beyazın D5 taşının tek nefesi kaldı. Onu E5 ile yakala.',
        position: KO,
        answers: movesWhere(KO, (result) => result.captured.length > 0),
        success: 'Yakaladın. Ama dikkat: senin E5 taşının da tek nefesi kaldı.',
        hint: 'D5 taşının boş komşusu E5.',
      },
      {
        text: 'Beyaz hemen D5 oynayıp senin taşını geri alamaz: önce başka bir yere oynaması gerekir. Buna ko kuralı denir; böylece oyun sonsuza kadar dönmez.',
        position: KO_AFTER,
        marks: [{ kind: 'danger', square: 'D5' }],
      },
    ],
    recap: ['Ko: alınan tek taş hemen geri alınamaz.', 'Rakip başka yere oynadıktan sonra geri alabilir.'],
  },
  {
    id: 'territory',
    icon: '🗺️',
    title: 'Alan ve oyunun sonu',
    summary: 'Amaç daha çok alan çevirmek.',
    steps: [
      {
        text: "Go'da amaç tahtada daha çok alan çevirmek. Oyun sonunda kendi taşların ve çevirdiğin boş noktalar sayılır. Beyaz ikinci oynadığı için 7,5 puan (komi) fazladan alır.",
        position: EMPTY_BOARD,
      },
      {
        text: 'Köşeler en değerli yerlerdir: köşede alan çevirmek için az taş yeter. Sonra kenarlar gelir, en son orta.',
        marks: hint('C3', 'G3', 'C7', 'G7'),
      },
      {
        text: 'İlk hamleni yap: bir köşeye yakın, kenardan üçüncü ya da dördüncü çizgide bir nokta seç.',
        answers: OPENING_POINTS,
        success: 'Güzel bir başlangıç! Bu noktalardan köşede alan çevirmek kolaydır.',
        hint: 'Kenara çok yakın (1-2. çizgi) az alan getirir, tam orta da köşeden uzaktır.',
        hintMarks: hint(...OPENING_POINTS),
      },
      {
        text: 'Oynayacak işe yarar yer kalmayınca iki oyuncu da pas geçer ve oyun sayılır.',
      },
    ],
    recap: ['Önce köşeler, sonra kenarlar, en son orta.', 'Oyun sonunda taşlar ve çevrilen boş noktalar sayılır.'],
  },
]

