import type { Lesson } from '../../core/lessons'
import { STORE, applyMove, decode, encode, legalMoves, type MoveResult, type Position } from './rules'

/** Mangala level 2: thinking a move ahead. Answers are worked out from the rules. */

const at = (pits: number[]) => `w:${pits.join(',')}`

function movesWhere(position: string, keep: (result: MoveResult, start: Position) => boolean): string[] {
  const start = decode(position)
  return legalMoves(start)
    .filter((move) => {
      const result = applyMove(start, move)
      return result !== null && keep(result, start)
    })
    .map(String)
}

const opponentHasExtraTurn = (position: Position) =>
  legalMoves({ ...position, turn: 'b' }).some((move) => applyMove({ ...position, turn: 'b' }, move)?.extraTurn)

/** The opponent's moves (pit indices) that end in their store. */
const opponentExtraTurns = (position: string) => {
  const start = { ...decode(position), turn: 'b' as const }
  return legalMoves(start).filter((move) => applyMove(start, move)?.extraTurn)
}

// Lesson 1: two extra turns in a row (pit 6 with one stone, pit 4 with four).
const CHAIN = at([2, 3, 1, 4, 0, 1, 5, 4, 4, 4, 4, 4, 4, 3])
const CHAIN_NEXT = encode(applyMove(decode(CHAIN), 5)!.position)
// Lesson 2: the opponent has pits that would end in their store; one move changes all of them.
const DENY = at([2, 1, 2, 1, 9, 2, 7, 0, 1, 8, 7, 1, 1, 6])
// Lesson 3: one move takes far more stones than the others.
const GAIN = at([1, 2, 6, 3, 6, 1, 2, 1, 3, 7, 6, 5, 5, 0])
const gainOf = (result: MoveResult, start: Position) => result.position.pits[STORE.w] - start.pits[STORE.w]
const bestGain = (() => {
  const start = decode(GAIN)
  const gains = legalMoves(start).map((move) => gainOf(applyMove(start, move)!, start))
  return Math.max(...gains)
})()
// Lesson 4: the opponent's pit 2 (one stone) would end in their empty pit 3, opposite your pit 4 (6 stones).
const EMPTY_THREAT = at([2, 3, 1, 6, 2, 5, 5, 4, 1, 0, 3, 2, 4, 10])
/** Stones the opponent could take from your pit 4 (index 3) with one move. */
const takenFromPit4 = (position: Position) => {
  const start = { ...position, turn: 'b' as const }
  return Math.max(0, ...legalMoves(start).map((move) => {
    const capture = applyMove(start, move)?.capture
    return capture && capture.pit === 3 ? capture.stones : 0
  }))
}

export const MANGALA_LESSONS_2: Lesson[] = [
  {
    id: 'chain',
    level: 2,
    icon: '⛓️',
    title: 'Zincirleme tekrar oynama',
    summary: 'Üst üste birkaç kez tekrar oynama hakkı kazan.',
    steps: [
      {
        text: 'Tekrar oynama hakkı kazandıktan sonra yine son taşı hazineye düşürebilirsen bir daha oynarsın. Ustalar böyle zincirler kurar.',
        position: CHAIN,
      },
      {
        text: 'Son taşı hazinene düşen bir kuyu bul.',
        answers: movesWhere(CHAIN, (result) => result.extraTurn),
        success: 'Tekrar oynuyorsun!',
        hint: '6. kuyudaki tek taş doğrudan hazineye gider. 4. kuyudaki 4 taşı da say.',
      },
      {
        text: '6. kuyudan oynadın ve sıra yine sende. Bir kez daha hazineye düşüren kuyuyu bul.',
        position: CHAIN_NEXT,
        lastMove: '5',
        answers: movesWhere(CHAIN_NEXT, (result) => result.extraTurn),
        success: 'Zincir! Rakip beklerken sen üst üste oynadın.',
        hint: '4. kuyudaki 4 taş: 4., 5., 6. kuyulara ve hazineye.',
      },
    ],
    recap: ['Tekrar oynadıktan sonra yine hazineye düşüren kuyu ara.', 'Hazineye yakın kuyulardaki az taş, tekrar oynama fırsatıdır.'],
  },
  {
    id: 'deny',
    level: 2,
    icon: '🚫',
    title: 'Rakibe fırsat verme',
    summary: 'Rakibin tekrar oynama fırsatlarını boz.',
    steps: [
      {
        text: 'Rakibin işaretli kuyularındaki taşlar tam onun hazinesine kadar gidiyor: sıra ona geçince tekrar oynama hakkı kazanır.',
        position: DENY,
        marks: opponentExtraTurns(DENY).map((pit) => ({ kind: 'threat' as const, square: String(pit) })),
      },
      {
        text: 'Öyle bir hamle yap ki rakibin hiçbir kuyusu son taşını hazinesine düşüremesin.',
        answers: movesWhere(DENY, (result) => !result.extraTurn && !opponentHasExtraTurn(result.position)),
        success: 'Rakibin bütün kuyularına birer taş ekledin; artık hiçbiri hazinesine tam denk gelmiyor.',
        hint: 'Çok taşlı kuyundan oynarsan rakibin kuyularına birer taş eklenir ve sayıları değişir.',
      },
    ],
    recap: ['Hamle yapmadan önce rakibin tekrar oynama fırsatlarına bak.', 'Rakibin kuyularına taş eklemek onun hesabını bozar.'],
  },
  {
    id: 'count',
    level: 2,
    icon: '🧮',
    title: 'Hamleleri saymak',
    summary: 'Her hamleden sonra hazinende kaç taş olacağını hesapla.',
    steps: [
      {
        text: 'İyi oyuncular her kuyuyu tek tek dener: son taş nereye düşer, bir şey alır mıyım? En çok kazandıran hamleyi seçer.',
        position: GAIN,
      },
      {
        text: 'Hazinene en çok taş getirecek hamleyi bul.',
        answers: movesWhere(GAIN, (result, start) => gainOf(result, start) === bestGain),
        success: `Son taş rakibin 7 taşlı kuyusuna düştü ve onu çift yaptı: ${bestGain} taş hazinende!`,
        hint: 'Her kuyunun son taşının nereye düştüğünü say. Rakibin tek sayılı büyük kuyularına bak.',
      },
    ],
    recap: ['Her hamlenin son taşının nereye düşeceğini say.', 'Büyük bir alma, küçük bir tekrar oynamadan çoğu zaman daha değerlidir.'],
  },
  {
    id: 'empty-defend',
    level: 2,
    icon: '🛡️',
    title: 'Boş kuyu tehlikesi',
    summary: 'Rakibin boş kuyusunun karşısındaki taşlarını koru.',
    steps: [
      {
        text: 'Rakibin 3. kuyusu boş ve tam karşısında senin 4. kuyunda 6 taş var. Rakip 2. kuyusundaki tek taşı oraya oynarsa boş kuyu kuralıyla 6 taşını alır.',
        position: EMPTY_THREAT,
        marks: [
          { kind: 'danger', square: '3' },
          { kind: 'threat', square: '9' },
          { kind: 'threat', square: '8' },
        ],
      },
      {
        text: 'Taşlarını kurtar: ya o kuyudan oyna ya da rakibin boş kuyusuna taş düşür.',
        answers: movesWhere(EMPTY_THREAT, (result) => !result.extraTurn && takenFromPit4(result.position) <= 2),
        success: 'Tehlike geçti. Rakibin boş kuyularının karşısında çok taş biriktirirken dikkatli ol.',
        hint: 'Çok taşlı bir kuyundan oynarsan taşlar rakibin kuyularına kadar gider ve boş kuyuyu doldurur.',
      },
    ],
    recap: ['Rakibin boş kuyularının karşısındaki taşlarına dikkat et.', 'Boş kuyuya taş düşürmek ya da o kuyudan oynamak tehlikeyi bitirir.'],
  },
]
