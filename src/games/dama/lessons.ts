import type { Lesson } from '../../core/lessons'
import { isSacrifice } from './hints'
import { applyMove, decode, encode, initialPosition, legalMoves, moveCode, type DamaPosition } from './rules'

/**
 * Turkish draughts basics, in order. The learner is White (moves up the board). Boards are drawn
 * from the 8th rank down to the 1st: w = white man, W = white dama, b = black man, B = black dama.
 */

const pos = (rows: string[], turn: 'w' | 'b' = 'w') =>
  `${turn} ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')} 0`

/** Legal move codes that pass `keep` (given the position before and after). */
function movesWhere(position: string, keep: (after: DamaPosition, start: DamaPosition) => boolean = () => true): string[] {
  const start = decode(position)
  return legalMoves(start)
    .map(moveCode)
    .filter((code) => {
      const result = applyMove(start, code)
      return result !== null && keep(result.position, start)
    })
}

const hint = (...squares: string[]) => squares.map((square) => ({ kind: 'hint' as const, square }))

const START = encode(initialPosition())
// Lesson 1: one white man in the middle, a black man far away.
const ALONE = pos(['.......b', '........', '........', '........', '...w....'])
// Lesson 2: a black man right in front, and one beside.
const IN_FRONT = pos(['.......b', '........', '........', '...b....', '...w....'])
const BESIDE = pos(['.......b', '........', '........', '........', '...wb...'])
// Lesson 3: two black men in a line: take both in one move.
const DOUBLE = pos(['.......b', '........', '...b....', '........', '...b....', '...w....'])
// Lesson 4: a man about to promote, and a dama that takes from a distance.
const PROMOTE = pos(['........', '..w.....', '........', '.......b'])
const FLYING = pos(['b.......', '........', '........', '...b....', '........', '........', '........', '...W....'])
// Lesson 5: d3-d4 gives a man; after d5xd3 White takes two with c3xe3xg3.
const COMBINATION = pos(['........', '........', '........', '...b....', '........', '.www.b..'])
const AFTER_OFFER = (() => {
  let position = decode(COMBINATION)
  for (const code of ['d3-d4', 'd5xd3']) position = applyMove(position, code)!.position
  return encode(position)
})()
// Lesson 6: some moves leave a man to be taken, others keep the men together.
const TOGETHER = pos(['........', '........', '....b...', '..b.....', '........', '.www....'])
const opponentCanTake = (after: DamaPosition) => after.turn === 'b' && legalMoves(after).some((m) => m.captured.length > 0)

export const DAMA_LESSONS: Lesson[] = [
  {
    id: 'moves',
    icon: '↕️',
    title: 'Taşların hareketi',
    summary: 'Taşlar ileri ya da yana gider.',
    steps: [
      {
        text: "Türk damasında her oyuncunun 16 taşı var. Beyaz başlar. Sen beyazsın: taşların yukarı doğru ilerler.",
        position: START,
      },
      {
        text: 'Taşlar bir kare ileri ya da yana gider; geri ve çapraz gitmez. Taşına dokun, sonra gideceği kareye dokun. Şimdi bir kare ileri oyna.',
        position: ALONE,
        answers: ['d4-d5'],
        success: 'İleri gittin.',
        hint: 'İleri, yani yukarı doğru: d5 karesi.',
        hintMarks: hint('d5'),
      },
      {
        text: 'Şimdi aynı taşı yana oyna.',
        answers: ['d4-c4', 'd4-e4'],
        success: 'Yana da gidebilirsin. Ama geri ve çapraz asla.',
        hint: 'Sola (c4) ya da sağa (e4).',
        hintMarks: hint('c4', 'e4'),
      },
    ],
    recap: ['Taşlar bir kare ileri ya da yana gider.', 'Geri ve çapraz gidilmez.'],
  },
  {
    id: 'capture',
    icon: '🦘',
    title: 'Taş almak',
    summary: 'Rakip taşın üstünden atlayıp alırsın. Alma zorunludur.',
    steps: [
      {
        text: 'Rakip taş hemen önünde ya da yanındaysa ve arkası boşsa, üstünden atlayıp alırsın. Alınan taş tahtadan kalkar.',
        position: IN_FRONT,
        marks: [{ kind: 'danger', square: 'd5' }, ...hint('d6')],
      },
      {
        text: 'Önündeki siyah taşı al!',
        answers: movesWhere(IN_FRONT),
        success: 'Aldın! Taşın siyah taşın üstünden atladı.',
        hint: 'Taşına dokun, sonra d6 karesine dokun.',
      },
      {
        text: 'Yandaki taş da alınır. Alma zorunludur: alabileceğin bir taş varsa başka hamle yapamazsın. Yandaki taşı al.',
        position: BESIDE,
        answers: movesWhere(BESIDE),
        success: 'Yana doğru da alabilirsin.',
        hint: 'e4 taşının arkasındaki f4 boş.',
      },
    ],
    recap: ['Önündeki ya da yanındaki taşın arkası boşsa alırsın.', 'Alma zorunludur.'],
  },
  {
    id: 'multi',
    icon: '⛓️',
    title: 'Art arda almak',
    summary: 'Aldıktan sonra yine alabiliyorsan devam edersin.',
    steps: [
      {
        text: 'Bir taşı aldıktan sonra aynı taşla yine alabiliyorsan almaya devam edersin. Birden fazla yol varsa en çok taş alan yolu seçmek zorundasın.',
        position: DOUBLE,
      },
      {
        text: 'Bu hamlede iki taşı birden al. Taşına dokun, sonra en son varacağı kareye dokun.',
        answers: movesWhere(DOUBLE),
        success: 'İki taş tek hamlede! Alınan taşlar hemen tahtadan kalkar.',
        hint: 'd5 üzerinden d7 karesine kadar gidebilirsin.',
        hintMarks: hint('d7'),
      },
    ],
    recap: ['Alabildiğin sürece aynı hamlede almaya devam edersin.', 'En çok taş alan yol seçilmelidir.'],
  },
  {
    id: 'dama',
    icon: '👑',
    title: 'Dama olmak',
    summary: 'Son sıraya ulaşan taş dama olur ve uzağa gider.',
    steps: [
      {
        text: 'Taşın son sıraya (8. sıra) ulaşınca dama olur. Dama düz çizgide istediği kadar ileri, geri ve yana gidebilir.',
        position: PROMOTE,
        marks: hint('c8'),
      },
      {
        text: 'Taşını dama yap!',
        answers: ['c7-c8'],
        success: 'Artık bir daman var: çok güçlü bir taş.',
        hint: 'Bir kare ileri: c8.',
      },
      {
        text: 'Dama uzaktaki taşı da alabilir ve arkasındaki boş karelerden birine konar. Damanla siyah taşı al.',
        position: FLYING,
        answers: movesWhere(FLYING),
        success: 'Dama uzaktan aldı! Bu yüzden rakibin dama yapmasına izin verme.',
        hint: 'Daman d sütununda yukarı doğru gidip d5 taşını alabilir.',
      },
    ],
    recap: ['Son sıraya ulaşan taş dama olur.', 'Dama düz çizgide uzağa gider ve uzaktan alır.'],
  },
  {
    id: 'sacrifice',
    icon: '🎁',
    title: 'Taş verip kazanmak',
    summary: 'Rakibi zorunlu almaya sokup daha çok taş al.',
    steps: [
      {
        text: 'Alma zorunlu olduğu için bazen bir taş vermek iyidir: rakip almak zorunda kalır, sonra sen daha çok taş alırsın.',
        position: COMBINATION,
      },
      {
        text: 'Bir taşını öyle bir yere oyna ki siyah almak zorunda kalsın ve sonra sen iki taş alabilesin.',
        answers: movesWhere(COMBINATION).filter((code) => isSacrifice(decode(COMBINATION), code)),
        success: 'Siyah d5 taşıyla almak zorunda. Sonra sıra sende!',
        hint: 'd3 taşını d4 karesine oyna.',
      },
      {
        text: 'Siyah zorunlu olarak aldı. Şimdi iki taşı birden al!',
        position: AFTER_OFFER,
        lastMove: 'd5xd3',
        answers: movesWhere(AFTER_OFFER),
        success: 'Bir taş verdin, iki taş aldın!',
        hint: 'c3 taşınla sağa doğru iki kez al.',
      },
    ],
    recap: ['Rakibin almak zorunda olduğunu unutma: bunu kullanabilirsin.', 'Taş vermeden önce sonrasını hesapla.'],
  },
  {
    id: 'together',
    icon: '🤝',
    title: 'Birlikte durmak',
    summary: 'Taşlarını yan yana tut, tek taş bırakma.',
    steps: [
      {
        text: 'Taşlarını yan yana ve arka arkaya tut. Arkası boş kalan tek taş kolayca alınır.',
        position: TOGETHER,
      },
      {
        text: 'Siyahın hiçbir taşı alamayacağı güvenli bir hamle yap.',
        answers: movesWhere(TOGETHER, (after) => !opponentCanTake(after)),
        success: 'Güvenli! Hamle yapmadan önce rakibin taş alıp alamayacağına bak.',
        hint: 'İlerlettiğin taşın önünde ya da yanında siyah taş olmasın; arkası da boş kalmasın.',
      },
    ],
    recap: ['Her hamleden önce: rakip benim bir taşımı alabilir mi?', 'Taşlar birbirini arkadan korur.'],
  },
]
