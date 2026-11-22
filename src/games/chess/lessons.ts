import { Chess } from 'chess.js'
import type { Lesson } from '../../core/lessons'
import { findHangingPieces } from './logic/hanging'

/** Chess basics for a beginner, in order. Exercise answers are worked out from the rules where possible. */

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** UCI codes of the legal moves in `fen` that pass `keep` (given the position after the move). */
function movesWhere(fen: string, keep: (after: Chess, move: { from: string; to: string; san: string }) => boolean): string[] {
  const chess = new Chess(fen)
  return chess
    .moves({ verbose: true })
    .filter((move) => {
      const after = new Chess(fen)
      after.move(move)
      return keep(after, move)
    })
    .map((move) => move.lan)
}

// Lesson 2: the bishop on c4 is attacked by the knight on b6 and nothing guards it.
const HANGING_BISHOP = '7k/8/1n6/8/2B5/8/8/6K1 w - - 0 1'
const SAVE_BISHOP = movesWhere(HANGING_BISHOP, (after, move) => move.from === 'c4' && findHangingPieces(after.fen(), 'w').length === 0)

// Lesson 6: king and queen against a lone king; every mate counts.
const QUEEN_MATE = '7k/Q7/6K1/8/8/8/8/8 w - - 0 1'
const QUEEN_MATES = movesWhere(QUEEN_MATE, (after) => after.isCheckmate())

export const CHESS_LESSONS: Lesson[] = [
  {
    id: 'values',
    icon: '⚖️',
    title: 'Taşların değeri',
    summary: 'Hangi taş ne kadar değerli? Takas yaparken buna bak.',
    steps: [
      {
        text: 'Her taşın bir değeri vardır: piyon 1, at 3, fil 3, kale 5, vezir 9. Şahın değeri biçilemez: şahını kaybeden oyunu kaybeder.',
        position: START,
      },
      {
        text: 'Takas yaparken değerleri karşılaştır. Atını verip kale almak iyidir: 3 verip 5 alırsın. Vezirini verip at almak kötüdür.',
      },
      {
        text: 'Atın iki taşa birden saldırıyor: bir kaleye ve bir piyona. Hangisini almalısın? Değerli olanı al.',
        position: '6k1/2r5/1p6/3N4/8/8/8/6K1 w - - 0 1',
        answers: ['d5c7'],
        success: 'Doğru! Kale 5 değerinde, piyon sadece 1.',
        hint: 'Kale piyondan çok daha değerlidir.',
        hintMarks: [{ kind: 'hint', square: 'c7' }],
      },
    ],
    recap: ['Piyon 1, at 3, fil 3, kale 5, vezir 9.', 'Az değerli taşla çok değerli taşı almak kazançlıdır.'],
  },
  {
    id: 'hanging',
    icon: '🛡️',
    title: 'Korumasız taşlar',
    summary: 'Saldırı altındaki taşını kurtar, rakibin bıraktığı taşı al.',
    steps: [
      {
        text: 'Korumasız taş: rakibin saldırdığı ama senin hiçbir taşının korumadığı taş. Rakip onu bedavaya alabilir.',
        position: HANGING_BISHOP,
        marks: [
          { kind: 'danger', square: 'c4' },
          { kind: 'threat', move: 'b6c4' },
        ],
      },
      {
        text: 'Filin saldırı altında ve onu koruyan yok. Fili, atın ulaşamayacağı güvenli bir kareye kaçır.',
        answers: SAVE_BISHOP,
        success: 'Aferin! Her hamleden önce taşlarından biri saldırı altında mı diye bak.',
        hint: 'At d5, a4 ve d7 gibi karelere de saldırıyor. Fili başka bir yere götür.',
      },
      {
        text: 'Şimdi tersi: siyahın korumasız bir taşı var. Bul ve al!',
        position: '6k1/8/3b4/8/8/8/8/3R2K1 w - - 0 1',
        answers: ['d1d6'],
        success: 'Bedava bir fil! Rakibin bıraktığı taşları her zaman ara.',
        hint: 'Kalen d sütununda yukarı doğru gidebilir.',
        hintMarks: [{ kind: 'hint', square: 'd6' }],
      },
    ],
    recap: ['Her hamleden önce: taşlarımdan biri saldırı altında mı?', 'Rakibin korumasız bıraktığı taşları al.'],
  },
  {
    id: 'fork',
    icon: '🍴',
    title: 'Çatal',
    summary: 'Bir taşla aynı anda iki taşa saldır.',
    steps: [
      {
        text: 'Çatal: bir taşın aynı anda iki rakip taşa saldırması. Rakip ikisini birden kurtaramaz, biri gider. Atlar çatal yapmakta çok iyidir.',
        position: 'r3k3/2N5/8/8/8/8/8/6K1 b - - 0 1',
        marks: [
          { kind: 'threat', move: 'c7e8' },
          { kind: 'threat', move: 'c7a8' },
        ],
      },
      {
        text: 'Atınla şah çekip aynı anda kaleye de saldır.',
        position: 'r3k3/8/8/1N6/8/8/8/6K1 w - - 0 1',
        answers: ['b5c7'],
        success: 'Çatal! Şah kaçmak zorunda, sonra kaleyi alırsın.',
        hint: 'Atın hem e8 hem a8 karesine saldırabileceği kareyi bul.',
      },
      {
        text: 'Piyonlar da çatal yapabilir. Bir piyon hamlesiyle iki siyah taşa birden saldır.',
        position: '6k1/8/3n1b2/8/3PP3/8/8/6K1 w - - 0 1',
        answers: ['e4e5'],
        success: 'Piyon çatalı! Siyah ya atını ya filini kaybedecek.',
        hint: 'Piyon çapraz alır: e5 karesinden d6 ve f6 karelerine saldırır.',
      },
    ],
    recap: ['Çatal: tek taşla iki hedefe saldırmak.', 'Şah çeken çatal en güçlüsüdür, çünkü rakip önce şahını kurtarmak zorundadır.'],
  },
  {
    id: 'pin',
    icon: '📌',
    title: 'Açmaz',
    summary: 'Arkasında değerli taş olan bir taşı yerine çivile.',
    steps: [
      {
        text: 'Açmaz: bir taş kıpırdarsa arkasındaki daha değerli taş alınır. Burada siyah at kıpırdayamaz, çünkü arkasında şahı var.',
        position: '4k3/8/2n5/8/B7/8/8/4K3 w - - 0 1',
        marks: [
          { kind: 'hint', square: 'c6' },
          { kind: 'threat', move: 'a4e8' },
        ],
      },
      {
        text: 'Filinle bir açmaz kur: siyah atı vezire çivile.',
        position: '3qk3/8/5n2/8/8/8/8/2B1K3 w - - 0 1',
        answers: ['c1g5'],
        success: 'Şimdi at kaçarsa filin veziri alır.',
        hint: 'Fil, at ve vezir aynı çapraz çizgide olmalı.',
      },
      {
        text: 'Çivili ata saldır! Bir piyonla kovala; at kaçamaz, kaçarsa vezir gider.',
        position: '3qk3/8/5n2/6B1/4P3/8/8/4K3 w - - 0 1',
        answers: ['e4e5'],
        success: 'Siyah atını kurtaramaz: açmazdaki taş kolay hedeftir.',
        hint: 'Piyonun bir kare ilerleyince f6 karesine saldırır.',
      },
    ],
    recap: ['Açmazdaki taş yerinden oynayamaz (ya da oynarsa daha değerli taş gider).', 'Açmazdaki taşa piyonla saldırmak çoğu zaman taş kazandırır.'],
  },
  {
    id: 'opening',
    icon: '🏁',
    title: 'Açılışın üç kuralı',
    summary: 'Merkezi tut, taşlarını oyuna sok, rok yap.',
    steps: [
      {
        text: 'Oyunun başında üç şey yap: 1) Merkezi tut (e4, d4, e5, d5). 2) Atlarını ve fillerini oyuna sok. 3) Rok yaparak şahını güvenceye al.',
        position: START,
        marks: ['e4', 'd4', 'e5', 'd5'].map((square) => ({ kind: 'hint' as const, square })),
      },
      {
        text: 'İlk hamleni yap: bir piyonu iki kare ilerleterek merkeze koy.',
        answers: ['e2e4', 'd2d4'],
        success: 'Merkezdeki piyon taşlarına yol açar ve önemli karelere saldırır.',
        hint: 'e ya da d piyonunu iki kare ilerlet.',
      },
      {
        text: 'Siyah da merkeze oynadı. Şimdi bir atını oyuna sok.',
        position: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
        lastMove: 'e7e5',
        answers: ['g1f3', 'b1c3'],
        success: 'Atlar merkeze doğru gelince en iyi işi yapar.',
        hint: 'Atlarını f3 ya da c3 karesine getir.',
      },
      {
        text: 'Atın ve filin oyunda. Şimdi rok yap: şahını iki kare kaleye doğru götür.',
        position: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        answers: ['e1g1'],
        success: 'Rok! Şahın köşede güvende, kalen de oyuna girmeye hazır.',
        hint: 'Şaha dokun, sonra g1 karesine dokun.',
        hintMarks: [{ kind: 'hint', square: 'g1' }],
      },
    ],
    recap: ['Merkezi piyonlarla tut.', 'Önce atları ve filleri çıkar, aynı taşı iki kez oynama.', 'Erken rok yap.'],
  },
  {
    id: 'mate',
    icon: '👑',
    title: 'Tek hamlede mat',
    summary: 'Şahı kaçacak yer bırakmadan sıkıştır.',
    steps: [
      {
        text: 'Mat: şah saldırı altında ve kaçacak yeri yok. Mat oyunu hemen bitirir. Hamle yapmadan önce rakibi mat edebilir misin diye bak.',
        position: '3R2k1/5ppp/8/8/8/8/8/6K1 b - - 1 1',
        marks: [{ kind: 'danger', square: 'g8' }],
      },
      {
        text: 'Arka sıra matı: siyah şahın önündeki kendi piyonları onu hapsetmiş. Kalenle mat et!',
        position: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
        answers: ['d1d8'],
        success: 'Mat! Şahın kaçacak yeri yoktu.',
        hint: 'Kaleni 8. sıraya götür.',
      },
      {
        text: 'Şahın ve vezirin birlikte çalışıyor. Tek hamlede mat et.',
        position: QUEEN_MATE,
        answers: QUEEN_MATES,
        success: 'Mat! Şahın veziri koruyor, siyah şah onu alamıyor.',
        hint: 'Veziri siyah şahın yanına götür; senin şahın onu korusun.',
      },
    ],
    recap: ['Mat: şaha saldırı var ve kaçış yok.', 'Arka sıradaki şahına dikkat: önüne bir kaçış karesi aç.'],
  },
]
