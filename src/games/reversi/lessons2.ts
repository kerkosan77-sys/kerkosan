import type { Lesson } from '../../core/lessons'
import { applyMove, countsBySide, decode, legalMoves, squareName, type ReversiPosition } from './rules'

/** Reversi level 2: tempo, quiet moves and exact endgames. Boards from the top row: x = Black (the learner). */

const codesOf = (position: ReversiPosition) => legalMoves(position).map((m) => squareName(m.square))

/** Black's discs that touch an empty square: the fewer, the fewer moves White gets. */
function frontier(position: ReversiPosition): number {
  let count = 0
  for (let i = 0; i < 64; i++) {
    if (position.board[i] !== 1) continue
    const row = Math.floor(i / 8)
    const col = i % 8
    let open = false
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr
        const c = col + dc
        if ((dr || dc) && r >= 0 && r < 8 && c >= 0 && c < 8 && position.board[r * 8 + c] === 0) open = true
      }
    }
    if (open) count++
  }
  return count
}

/** Final disc difference for Black with perfect play (only for a few empty squares). */
function exactResult(position: ReversiPosition): number {
  const moves = legalMoves(position)
  if (moves.length === 0) {
    const counts = countsBySide(position.board)
    return counts.w - counts.b
  }
  const results = moves.map((move) => exactResult(applyMove(position, squareName(move.square))!.position))
  return position.turn === 'w' ? Math.max(...results) : Math.min(...results)
}

function best(position: string, score: (code: string) => number): string[] {
  const codes = codesOf(decode(position))
  const values = codes.map(score)
  const top = Math.max(...values)
  return codes.filter((_, i) => values[i] === top)
}

const after = (position: string, code: string) => applyMove(decode(position), code)!

// Lesson 1: only one move leaves White without a move (White must pass).
const PASS = 'x xxxo..ox/xxooooox/ooxoxxxx/ooxoxooo/ooxoxxoo/.oxoxxoo/.ooxxooo/.ooooo.x'
// Lesson 2: e8 turns one disc and leaves Black few discs next to empty squares; d1 turns five but opens everything.
const QUIET = 'x .x....../..xo...o/.xxo..o./...oxo.o/ooooooo./.oxoxo../..xxooo./..xx.o..'
// Lesson 3: eight empty squares: the greedy move loses, the right one wins.
const ENDGAME = 'x xoxx.o.o/oooooooo/.ooxoxox/xooxooo./xoxoxoo./xxxooooo/xxxxxoxx/oooo.o..'
const greedy = (() => {
  const moves = legalMoves(decode(ENDGAME))
  return squareName(moves.reduce((a, b) => (b.flips.length > a.flips.length ? b : a)).square)
})()

export const REVERSI_LESSONS_2: Lesson[] = [
  {
    id: 'force-pass',
    level: 2,
    icon: '⏭️',
    title: 'Rakibi pas geçirmek',
    summary: 'Rakibin oynayacak yeri kalmazsa sen bir daha oynarsın.',
    steps: [
      {
        text: 'Rakibin oynayabileceği hiçbir kare kalmazsa pas geçmek zorunda kalır ve sen üst üste oynarsın. Oyun sonuna doğru bu çok güçlüdür.',
        position: PASS,
      },
      {
        text: 'Beyazın hiçbir hamlesi kalmayacak şekilde oyna.',
        answers: codesOf(decode(PASS)).filter((code) => after(PASS, code).opponentPassed),
        success: 'Beyaz pas geçmek zorunda: sıra yine sende!',
        hint: 'Her hamleden sonra beyazın oynayabileceği kare kalıyor mu, bak. Alt sıraya dikkat.',
      },
    ],
    recap: ['Rakibi pas geçirmek, bir hamle fazladan oynamaktır.', 'Oyun sonunda rakibin oynayabileceği kareleri say.'],
  },
  {
    id: 'quiet-move',
    level: 2,
    icon: '🤫',
    title: 'Sessiz hamle',
    summary: 'Az ve içerideki taşları çevir, rakibe yer açma.',
    steps: [
      {
        text: 'Boş karelere değen taşlar rakibe oynayacak yer verir. Ustalar az taş çevirir ve kendi taşlarının boş karelere değmemesine çalışır: buna sessiz hamle denir.',
        position: QUIET,
      },
      {
        text: 'Boş karelere değen siyah taş sayısını en az tutan sessiz hamleyi bul.',
        answers: best(QUIET, (code) => -frontier(after(QUIET, code).position)),
        success: 'Sadece bir taş çevirdin ve taşlarını içeride tuttun. Beyazın seçenekleri azaldı.',
        hint: 'Çok taş çeviren hamleler taşlarını açığa çıkarır. Alt kenardaki tek taşı çeviren hamleye bak.',
      },
    ],
    recap: ['Az taş çevir, boş karelere değen taşlarını azalt.', 'Sessiz hamle rakibin seçeneklerini azaltır.'],
  },
  {
    id: 'exact-endgame',
    level: 2,
    icon: '🧠',
    title: 'Sona kadar hesap',
    summary: 'Son hamlelerde en çok çeviren değil, sonunda en çok bırakan hamle iyidir.',
    steps: [
      {
        text: `8 boş kare kaldı. En çok taş çeviren hamle ${greedy}, ama bu hamle oyunu kaybettiriyor. Sonuna kadar hesaplayınca kazandıran tek bir hamle var.`,
        position: ENDGAME,
      },
      {
        text: 'Oyunu kazandıran hamleyi bul.',
        answers: best(ENDGAME, (code) => exactResult(after(ENDGAME, code).position)),
        success: 'Doğru! Bu hamleyle oyunun sonunda sende daha çok taş kalıyor.',
        hint: 'Köşeye ve kenarlara bak: beyazın sonra ne alabileceğini düşün. Sol kenardaki boş kare önemli.',
      },
    ],
    recap: ['Son hamlelerde açgözlü olma: sona kadar hesapla.', 'Pas ve parite (kalan boş karelerin tek/çift olması) sonucu değiştirir.'],
  },
]
