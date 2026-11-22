import type { Lesson } from '../../core/lessons'
import { applyMove, decode, legalMoves, moveCode, type DamaPosition } from './rules'

/** Dama level 2: damas and choosing the right capture. Boards from the 8th rank down. */

const pos = (rows: string[]) => `w ${[...rows, ...Array(8 - rows.length).fill('........')].join('/')} 0`

function movesWhere(position: string, keep: (after: DamaPosition) => boolean = () => true): string[] {
  const start = decode(position)
  return legalMoves(start)
    .map(moveCode)
    .filter((code) => {
      const result = applyMove(start, code)
      return result !== null && keep(result.position)
    })
}

const blackCanPromote = (after: DamaPosition) => after.turn === 'b' && legalMoves(after).some((m) => m.promotes)
const blackCanTake = (after: DamaPosition) => after.turn === 'b' && legalMoves(after).some((m) => m.captured.length > 0)

// Lesson 1: a black man on c2 is one step from becoming a dama; your dama on a1 can block c1.
const BLOCK = pos(['........', '.......b', '........', '........', '....w...', '........', '..b.....', 'W.......'])
// Lesson 2: your dama on a1 can take a3 and then turn to take c5.
const DAMA_DOUBLE = pos(['.......b', '........', '........', '..b.....', '........', 'b.......', '........', 'W.......'])
// Lesson 3: g4 takes two either way; one way lands on g8 as a dama, the other can be taken back.
const ROUTES = pos(['........', 'bbbb.bbb', '.bbb.b..', '......bb', 'w....ww.', '..wwww.w', '.wwwww.w', '........'])

export const DAMA_LESSONS_2: Lesson[] = [
  {
    id: 'stop-dama',
    level: 2,
    icon: '✋',
    title: 'Dama olmayı engellemek',
    summary: 'Rakibin son sıraya ulaşacak taşını durdur.',
    steps: [
      {
        text: 'Siyahın c2 taşı bir adım sonra 1. sıraya ulaşıp dama olacak. Rakibin dama yapması çoğu zaman oyunu ona verir.',
        position: BLOCK,
        marks: [
          { kind: 'danger', square: 'c2' },
          { kind: 'hint', square: 'c1' },
        ],
      },
      {
        text: 'Damanla siyah taşın önünü kapat: bu hamleden sonra siyah dama olamasın.',
        answers: movesWhere(BLOCK, (after) => !blackCanPromote(after)),
        success: 'Önü kapandı! Siyah taş artık dama olamıyor.',
        hint: 'Daman 1. sırada sağa doğru gidebilir.',
      },
    ],
    recap: ['Rakibin son sıraya yakın taşlarını takip et.', 'Önünü kapatmak ya da onu almak dama olmasını engeller.'],
  },
  {
    id: 'dama-double',
    level: 2,
    icon: '🪃',
    title: 'Damayla art arda almak',
    summary: 'Dama aldıktan sonra yön değiştirip almaya devam edebilir.',
    steps: [
      {
        text: 'Dama bir taşı aldıktan sonra yana dönüp başka bir taşı da alabilir. Ama aynı hamlede geri dönüp ters yöne alamaz.',
        position: DAMA_DOUBLE,
        marks: [
          { kind: 'danger', square: 'a3' },
          { kind: 'danger', square: 'c5' },
        ],
      },
      {
        text: 'Damanla iki taşı birden al. Damana dokun, sonra en son varacağı kareye dokun.',
        answers: movesWhere(DAMA_DOUBLE),
        success: 'İki taş tek hamlede! Dama uzaktan alır ve yön değiştirebilir.',
        hint: 'Önce yukarı doğru a3 taşını al, a5 karesinde dur ve sağa dön.',
      },
    ],
    recap: ['Dama aldıktan sonra 90 derece dönerek almaya devam edebilir.', 'Dama varken taşlarını aynı çizgide boşluklu bırakma.'],
  },
  {
    id: 'best-route',
    level: 2,
    icon: '🛤️',
    title: 'Doğru alma yolu',
    summary: 'Eşit alma yollarından güvenli olanı seç.',
    steps: [
      {
        text: 'Alma zorunlu ve en çok taş alan yol seçilmeli. Ama iki yol da aynı sayıda taş alıyorsa seçim senin: aldıktan sonra rakibin seni geri alamayacağı yolu seç.',
        position: ROUTES,
        marks: [
          { kind: 'hint', square: 'g8' },
          { kind: 'hint', square: 'e6' },
        ],
      },
      {
        text: 'g4 taşın iki yoldan da iki taş alabiliyor. Siyahın geri alamayacağı yolu seç.',
        answers: movesWhere(ROUTES, (after) => !blackCanTake(after)),
        success: 'g8\'de durdun ve dama oldun! Öbür yolda e6\'da duran taşını siyah hemen alırdı.',
        hint: 'Sonunda nerede duracağına bak: e6 mı, g8 mi?',
      },
    ],
    recap: ['Aynı sayıda taş alan yollar arasında güvenli olanı seç.', 'Mümkünse son sıraya varan yolu seç: dama olursun.'],
  },
]
