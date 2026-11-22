import { Chess } from 'chess.js'
import type { Lesson } from '../../core/lessons'

/** Chess level 2: tactics and simple endgames. Answers are worked out with the rules where possible. */

/** UCI codes of the legal moves in `fen` whose resulting position passes `keep`. */
function movesWhere(fen: string, keep: (after: Chess, captured?: string) => boolean): string[] {
  return new Chess(fen)
    .moves({ verbose: true })
    .filter((move) => {
      const after = new Chess(fen)
      after.move(move)
      return keep(after, move.captured)
    })
    .map((move) => move.lan)
}

/** After the check, every reply of the other side still lets the checker take the queen. */
const winsQueenAfterCheck = (after: Chess) =>
  after.inCheck() &&
  after.moves({ verbose: true }).every((reply) => {
    const next = new Chess(after.fen())
    next.move(reply)
    return next.moves({ verbose: true }).some((m) => m.captured === 'q')
  })

/** The other side has no mate in one. */
const noMateInOne = (after: Chess) =>
  after.moves({ verbose: true }).every((reply) => {
    const next = new Chess(after.fen())
    next.move(reply)
    return !next.isCheckmate()
  })

const SKEWER = '3k3q/8/8/8/8/8/8/R5K1 w - - 0 1'
const DISCOVERED = '7k/8/2q5/8/3N4/8/1B6/6K1 w - - 0 1'
const MATE_THREAT = '4r1k1/5ppp/8/8/8/2N5/5PPP/6K1 w - - 0 1'
const TWO_ROOKS = '7k/1R6/8/8/8/8/8/R5K1 w - - 0 1'
const RUNNER = '8/7k/3P4/8/8/8/8/6K1 w - - 0 1'
const PROMOTE = '8/3P2k1/8/8/8/8/8/6K1 w - - 0 1'

export const CHESS_LESSONS_2: Lesson[] = [
  {
    id: 'skewer',
    level: 2,
    icon: '🍢',
    title: 'Şiş',
    summary: 'Değerli taşa saldır, kaçınca arkasındakini al.',
    steps: [
      {
        text: 'Şiş, çatalın tersidir: önce değerli taşa (çoğu zaman şaha) saldırırsın. O kaçınca arkasındaki taş açıkta kalır ve onu alırsın.',
        position: SKEWER,
        marks: [
          { kind: 'hint', square: 'd8' },
          { kind: 'hint', square: 'h8' },
        ],
      },
      {
        text: 'Siyah şah ile vezir aynı sırada. Kalenle şah çek ve veziri kazan.',
        answers: movesWhere(SKEWER, winsQueenAfterCheck),
        success: 'Şah kaçmak zorunda, sonra kalen veziri alır.',
        hint: 'Kaleni 8. sıraya götür: hem şaha hem arkasındaki vezire saldırsın.',
      },
    ],
    recap: ['Şiş: öndeki değerli taşa saldır, arkadakini kazan.', 'Kale ve fil şiş yapmakta iyidir.'],
  },
  {
    id: 'discovered',
    level: 2,
    icon: '🎭',
    title: 'Açarak saldırı',
    summary: 'Bir taşı çekince arkasındaki taşın saldırısı açılır.',
    steps: [
      {
        text: 'Atın filinin önünü kapatıyor. At yerinden oynayınca fil siyah şaha şah çeker: buna açarak şah denir. Rakip önce şahını kurtarmak zorundadır.',
        position: DISCOVERED,
        marks: [
          { kind: 'threat', move: 'b2h8' },
          { kind: 'hint', square: 'd4' },
        ],
      },
      {
        text: 'Atını öyle bir kareye oynat ki fil şah çeksin ve at da bir şey kazansın.',
        answers: movesWhere(DISCOVERED, (_after, captured) => captured === 'q'),
        success: 'Vezir gitti! Siyah önce şahını kurtarmak zorunda olduğu için atını alamıyor.',
        hint: 'At hangi kareye gidince siyah veziri alır?',
      },
    ],
    recap: ['Açarak saldırı: öndeki taş oynayınca arkadaki taş saldırır.', 'Öndeki taş da bir şeye saldırırsa rakip ikisini birden karşılayamaz.'],
  },
  {
    id: 'defend-mate',
    level: 2,
    icon: '🧱',
    title: 'Mat tehdidini savmak',
    summary: 'Rakibin tek hamlede mat tehdidini gör ve önle.',
    steps: [
      {
        text: 'Siyah e1 karesine kale oynarsa mat olursun: şahının önündeki kendi piyonları onu hapsetmiş. Buna arka sıra zayıflığı denir.',
        position: MATE_THREAT,
        marks: [
          { kind: 'threat', move: 'e8e1' },
          { kind: 'danger', square: 'g1' },
        ],
      },
      {
        text: 'Mat tehdidini önleyen bir hamle yap.',
        answers: movesWhere(MATE_THREAT, noMateInOne),
        success: 'Tehdit savuşturuldu. Şahına bir kaçış karesi açmak (örneğin h3) çoğu zaman en kolay çözümdür.',
        hint: 'Şahına bir kaçış karesi aç: önündeki piyonlardan birini oynat.',
      },
    ],
    recap: ['Her hamleden önce: rakip beni mat edebilir mi?', 'Arka sıradaki şaha bir piyon oynatarak kaçış karesi aç.'],
  },
  {
    id: 'two-rooks',
    level: 2,
    icon: '🪜',
    title: 'İki kaleyle mat',
    summary: 'Kaleler sırayla ilerleyerek şahı kenara iter.',
    steps: [
      {
        text: 'İki kale merdiven gibi çalışır: biri bir sırayı kapatır, öbürü bir üst sırada şah çeker. Böylece şah adım adım kenara itilir.',
        position: TWO_ROOKS,
        marks: [{ kind: 'hint', square: 'b7' }],
      },
      {
        text: 'b7 kalen 7. sırayı kapatıyor. Öbür kalenle mat et.',
        answers: movesWhere(TWO_ROOKS, (after) => after.isCheckmate()),
        success: 'Mat! Şah 8. sırada ve 7. sıraya da kaçamıyor.',
        hint: 'a1 kalesini 8. sıraya götür.',
      },
    ],
    recap: ['İki kale: biri sırayı kapatır, öbürü şah çeker.', 'Kaleleri şahtan uzak tut ki şah onları alamasın.'],
  },
  {
    id: 'promotion',
    level: 2,
    icon: '♛',
    title: 'Piyonu vezire çıkarmak',
    summary: 'Önü açık piyon rakip şahtan hızlıysa vezir olur.',
    steps: [
      {
        text: 'Önünde rakip piyon olmayan piyona geçer piyon denir. Rakip şah yetişemezse son sıraya ulaşıp vezir olur. Kare kuralı: piyondan son sıraya kadar bir kare çiz; rakip şah bu karenin dışındaysa yetişemez.',
        position: RUNNER,
        marks: ['d6', 'd8', 'f8', 'f6'].map((square) => ({ kind: 'hint' as const, square })),
      },
      {
        text: 'Siyah şah karenin dışında. Piyonunu ilerlet!',
        answers: ['d6d7'],
        success: 'Siyah şah yetişemiyor.',
        hint: 'Piyonu bir kare ileri oynat.',
      },
      {
        text: 'Şimdi piyonunu son sıraya oynat ve vezir seç.',
        position: PROMOTE,
        answers: ['d7d8q'],
        success: 'Yeni bir vezirin oldu! Bu oyunu kazandırır.',
        hint: 'd8 karesine oyna, sonra veziri seç.',
      },
    ],
    recap: ['Geçer piyon değerlidir: onu ilerlet.', 'Kare kuralı: rakip şah karenin dışındaysa piyon vezir olur.'],
  },
]
