import type { Lesson } from '../../core/lessons'
import { opponentThreat } from './coach'
import { applyMove, decode, legalMoves, type MoveResult } from './rules'

/**
 * Mangala basics, in order. The learner is the first player (bottom row, pits 1-6 from left to
 * right). Exercise answers are worked out from the rules.
 */

const at = (pits: number[]) => `w:${pits.join(',')}`
const START = at([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0])

/** Moves (pit indices as text) whose result passes `keep`. */
function movesWhere(position: string, keep: (result: MoveResult) => boolean): string[] {
  const start = decode(position)
  return legalMoves(start)
    .filter((move) => {
      const result = applyMove(start, move)
      return result !== null && keep(result)
    })
    .map(String)
}

const pit = (index: number) => ({ kind: 'hint' as const, square: String(index) })

// Lesson 2: a position with more than one way to land in the store.
const EXTRA_TURNS = at([1, 1, 4, 2, 3, 1, 3, 4, 4, 4, 4, 4, 4, 3])

// Lesson 3: three stones from pit 6 end in the opponent's pit with 3 stones, making it 4.
const EVEN = at([4, 4, 4, 4, 1, 3, 0, 3, 4, 4, 4, 4, 4, 0])

// Lesson 4: one stone from pit 1 lands in the empty pit 2; 5 stones face it.
const EMPTY = at([1, 0, 4, 4, 4, 4, 0, 4, 4, 4, 4, 5, 4, 0])

// Lesson 5: the opponent's pit 5 (5 stones) would end in your pit 2 and make its 3 stones even.
const THREAT = at([2, 3, 4, 1, 2, 5, 0, 3, 2, 4, 1, 5, 2, 0])
const threatAfter = (result: MoveResult) =>
  opponentThreat({ pits: result.position.pits, turn: 'b' })?.stones ?? 0
const SAFE = movesWhere(THREAT, (result) => threatAfter(result) < 2 || result.extraTurn)

// Lesson 6: one stone left on your side; playing it ends the game.
const LAST_STONE = at([0, 0, 0, 0, 0, 1, 22, 2, 3, 1, 0, 2, 4, 13])

export const MANGALA_LESSONS: Lesson[] = [
  {
    id: 'sowing',
    icon: '🫘',
    title: 'Taşları dağıtmak',
    summary: 'Bir kuyudaki taşları alıp sırayla dağıtırsın.',
    steps: [
      {
        text: 'Her oyuncunun 6 kuyusu ve sağında bir hazinesi var. Başta her kuyuda 4 taş bulunur. Alttaki sıra senin.',
        position: START,
      },
      {
        text: 'Sıran gelince kendi kuyularından birindeki bütün taşları alırsın. İlkini aynı kuyuya bırakıp kalanları sağa doğru birer birer dağıtırsın.',
      },
      {
        text: 'Dene: 1. kuyundaki 4 taşı dağıt. (En soldaki kuyu.)',
        answers: ['0'],
        success: 'Taşlar 1, 2, 3 ve 4. kuyulara birer birer dağıldı.',
        hint: 'En soldaki kuyuya dokun.',
        hintMarks: [pit(0)],
      },
      {
        text: 'Taşlar sağdaki hazinene, sonra rakibin kuyularına devam eder. Rakibin hazinesine taş koymazsın, onu atlarsın. Kuyuda tek taş varsa o taş bir sonraki kuyuya geçer.',
      },
    ],
    recap: ['İlk taş aldığın kuyuya geri konur, kalanlar sağa doğru dağıtılır.', 'Rakibin hazinesi atlanır.'],
  },
  {
    id: 'extra-turn',
    icon: '🔁',
    title: 'Tekrar oynama hakkı',
    summary: 'Son taşın hazinene düşerse bir daha oynarsın.',
    steps: [
      {
        text: 'Son taşın kendi hazinene düşerse bir kez daha oynarsın. Bu çok güçlüdür: rakip beklerken sen iki hamle yaparsın.',
        position: START,
        marks: [{ kind: 'hint', square: '6' }],
      },
      {
        text: 'Başlangıç pozisyonunda son taşı hazinene düşüren tek bir kuyu var. Bul!',
        answers: movesWhere(START, (result) => result.extraTurn),
        success: '4 taş: 4., 5., 6. kuyulara ve hazineye. Tekrar sıra sende!',
        hint: 'Kuyudaki taş sayısını, hazineye olan uzaklıkla karşılaştır.',
      },
      {
        text: 'Burada son taşı hazineye düşüren birden fazla kuyu var. Birini bul.',
        position: EXTRA_TURNS,
        answers: movesWhere(EXTRA_TURNS, (result) => result.extraTurn),
        success: 'Doğru! Hazineye uzaklık ile taş sayısı tutunca tekrar oynarsın.',
        hint: 'Tek taşlı kuyu bir kare ilerler. 3 taşlı kuyu, ilki kendine olmak üzere 3 kareye dağılır.',
      },
    ],
    recap: ['Son taş hazineye düşerse tekrar oynarsın.', 'Her hamleden önce bunu sağlayan bir kuyu var mı diye bak.'],
  },
  {
    id: 'even',
    icon: '✌️',
    title: 'Çift kuralı',
    summary: 'Rakibin kuyusunu çift yaparsan oradaki taşları alırsın.',
    steps: [
      {
        text: 'Son taşın rakibin bir kuyusuna düşer ve oradaki taş sayısını çift yaparsa (2, 4, 6…), o kuyudaki bütün taşlar senin olur.',
        position: EVEN,
      },
      {
        text: 'Rakibin bir kuyusunu çift yapıp taşlarını alacak hamleyi bul.',
        answers: movesWhere(EVEN, (result) => result.capture?.kind === 'even'),
        success: 'Rakibin 3 taşına senin taşın eklendi: 4 taş, çift. Hepsi hazinende!',
        hint: '6. kuyundaki 3 taş nereye kadar gider?',
      },
      {
        text: 'Dikkat: aynı kural rakibin için de geçerli. Kuyularında tek sayıda taş bırakırsan rakip son taşını oraya düşürüp onları alabilir.',
      },
    ],
    recap: ['Rakibin kuyusunu çift yaparsan taşları alırsın.', 'Kendi kuyularında tek sayıda taş bırakırken dikkatli ol.'],
  },
  {
    id: 'empty',
    icon: '🕳️',
    title: 'Boş kuyu kuralı',
    summary: 'Son taşın kendi boş kuyuna düşerse karşıdakileri alırsın.',
    steps: [
      {
        text: 'Son taşın kendi boş kuyuna düşerse ve karşısındaki rakip kuyusunda taş varsa, o taşların hepsini ve kendi taşını alırsın.',
        position: EMPTY,
        marks: [pit(1), pit(11)],
      },
      {
        text: '2. kuyun boş ve karşısında 5 taş var. Boş kuyu kuralıyla onları al!',
        answers: movesWhere(EMPTY, (result) => result.capture?.kind === 'empty'),
        success: '5 taş artı kendi taşın: 6 taş hazinende!',
        hint: '1. kuyundaki tek taş bir kare ilerler.',
      },
    ],
    recap: ['Son taş kendi boş kuyuna düşerse karşıdaki taşlar senin olur.', 'Rakibin boş kuyularının karşısında çok taş biriktirme.'],
  },
  {
    id: 'defend',
    icon: '🛡️',
    title: 'Taşlarını korumak',
    summary: 'Rakibin bir sonraki hamlesinde ne alabileceğine bak.',
    steps: [
      {
        text: 'Rakip bir sonraki hamlesinde 2. kuyundaki 3 taşı alabilir: 5. kuyusundaki 5 taşın sonuncusu oraya düşer ve sayıyı 4 yapar (çift).',
        position: THREAT,
        marks: [
          { kind: 'danger', square: '1' },
          { kind: 'threat', square: '11' },
        ],
      },
      {
        text: 'Taşlarını kurtaracak hamleyi bul: o kuyudaki taş sayısını değiştir ki rakibin taşı onu çift yapamasın.',
        answers: SAFE,
        success: '2. kuyunda artık 4 taş var: rakibin taşı düşünce 5 olur, tek sayı. Taşların güvende!',
        hint: '2. kuyudan oynamak işe yaramaz: ilk taş geri konur ve kuyu yine tek kalır. 1. kuyundan oynayıp 2. kuyuya taş eklemeyi dene.',
        hintMarks: [{ kind: 'danger', square: '1' }],
      },
    ],
    recap: ['Hamle yapmadan önce: rakip benden ne alabilir?', 'Tehlikedeki kuyudan oynamak ya da taş sayısını değiştirmek onu korur.'],
  },
  {
    id: 'ending',
    icon: '🏁',
    title: 'Oyunun sonu',
    summary: 'Kuyuları ilk boşalan, rakibin kalan taşlarını alır.',
    steps: [
      {
        text: 'Bir oyuncunun kuyularındaki taşlar bitince oyun biter. Kuyuları boşalan oyuncu, rakibinin kuyularında kalan bütün taşları alır. Sonunda hazinesinde çok taş olan kazanır.',
        position: LAST_STONE,
      },
      {
        text: 'Tek taşın kaldı. Onu hazinene koy: kuyuların boşalır, oyun biter ve rakibin kuyularındaki taşlar senin olur.',
        answers: movesWhere(LAST_STONE, (result) => result.over),
        success: 'Oyun bitti! Rakibin kuyularındaki 12 taş da senin hazinene geldi.',
      },
    ],
    recap: ['Kuyuları ilk boşalan, rakibin kalan taşlarını alır.', 'Oyun sonunda taşları saymayı unutma: 24 taştan fazlası kazandırır.'],
  },
]
