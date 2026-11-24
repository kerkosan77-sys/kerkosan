import type { GameEnd, GameModule, MoveRecord, MoverResult, ReadGame, RecordMeta, Score, Side } from '../../core/types'
import { reversiCoachQuestions, reversiCoachTip, reversiCoachWarning, reversiPuzzleHint } from './coach'
import { reversiEngine } from './engine'
import { describeReversiMove, reversiPhase } from './describe'
import { explainReversiMove, labelFor } from './explain'
import { LEVELS } from './levels'
import { REVERSI_LESSONS } from './lessons'
import { REVERSI_LESSONS_2 } from './lessons2'
import ReversiBoard from './ReversiBoard'
import {
  COLOR_NAMES,
  applyMove,
  countsBySide,
  decode,
  encode,
  initialPosition,
  opponentOf,
  winnerOf,
  type ReversiPosition,
} from './rules'

export interface ReversiState {
  position: ReversiPosition
  moves: MoveRecord[]
}

/** Record format: optional `[Key "Value"]` header lines, then the moves ("f5 d6 c3 …"). */
export function parseRecord(record: string): { headers: Record<string, string>; moves: string[] } {
  const headers: Record<string, string> = {}
  const moves: string[] = []
  for (const line of record.split(/\r?\n/)) {
    const header = /^\s*\[(\S+)\s+"(.*)"\]\s*$/.exec(line)
    if (header) {
      headers[header[1]] = header[2]
      continue
    }
    for (const token of line.trim().split(/\s+/)) {
      if (/^[a-h][1-8]$/i.test(token)) moves.push(token.toLowerCase())
    }
  }
  return { headers, moves }
}

function moverResult(position: ReversiPosition, mover: Side): MoverResult | null {
  const winner = winnerOf(position)
  if (winner === null) return null
  return winner === 'draw' ? 'draw' : winner === mover ? 'win' : 'loss'
}

function moveRecord(before: ReversiPosition, code: string): { record: MoveRecord; position: ReversiPosition } | null {
  const result = applyMove(before, code)
  if (!result) return null
  return {
    record: { code: code.toLowerCase(), label: labelFor(result), side: before.turn, before: encode(before), after: encode(result.position) },
    position: result.position,
  }
}

function replay(record: string): { state: ReversiState; terminal: ReadGame['terminal'] } {
  let position = initialPosition()
  const moves: MoveRecord[] = []
  const terminal: ReadGame['terminal'] = [null]
  parseRecord(record).moves.forEach((code, k) => {
    const played = moveRecord(position, code)
    if (!played) throw new Error(`Geçersiz Reversi hamlesi: ${k + 1}. hamle (${code})`)
    moves.push(played.record)
    position = played.position
    terminal.push(moverResult(position, played.record.side))
  })
  return { state: { position, moves }, terminal }
}

function endOf(state: ReversiState, userSide: Side): GameEnd | null {
  const winner = winnerOf(state.position)
  if (winner === null) return null
  const counts = countsBySide(state.position.board)
  const mine = counts[userSide]
  const theirs = counts[opponentOf(userSide)]
  const result: GameEnd['result'] = winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : '1/2-1/2'
  const count = `Senin taşların: ${mine} · Rakibinin: ${theirs}.`
  if (winner === 'draw') return { result, outcome: 'draw', title: 'Berabere', detail: `${count} Taş sayıları eşit.` }
  return winner === userSide
    ? { result, outcome: 'win', title: 'Kazandın!', detail: `${count} ${mine - theirs} farkla kazandın. Tebrikler!` }
    : { result, outcome: 'loss', title: 'Kaybettin', detail: `${count} ${theirs - mine} farkla kaybettin. Analizde nerede köşe ya da taş kaçırdığına bakalım.` }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function recordText(state: ReversiState, meta?: RecordMeta): string {
  const moves = state.moves.map((m) => m.code).join(' ')
  if (!meta) return moves
  const lines = ['[Oyun "Reversi"]']
  if (meta.date) {
    const d = meta.date
    lines.push(`[Tarih "${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}"]`)
  }
  if (meta.names) lines.push(`[Siyah "${meta.names.w}"]`, `[Beyaz "${meta.names.b}"]`)
  if (meta.result) lines.push(`[Sonuc "${meta.result}"]`)
  return `${lines.join('\n')}\n\n${moves}${meta.result ? ` ${meta.result}` : ''}`
}

/** Winning chances from the evaluation: about 62% a corner ahead (100 points), 81% at 300. */
export function reversiWinPercent(score: Score): number {
  if (score.kind === 'mate') return score.value > 0 ? 100 : 0
  const cp = Math.max(-2000, Math.min(2000, score.value))
  return 50 + 50 * Math.tanh(cp / 400)
}

function moveLabelAt(position: string, move: string): string {
  try {
    const result = applyMove(decode(position), move)
    return result ? labelFor(result) : move
  } catch {
    return move
  }
}

const RULES = [
  'Siyah başlar. Taşını öyle bir kareye koymalısın ki rakibin bir ya da daha fazla taşı, yeni taşınla eski bir taşın arasında düz bir çizgide (yatay, dikey ya da çapraz) kalsın.',
  'Arada kalan bütün rakip taşları ters çevrilir ve senin rengine döner. Oynayabileceğin kareler küçük noktalarla gösterilir.',
  'Oynayacak yerin yoksa sıra kendiliğinden rakibine geçer. İkiniz de oynayamazsanız oyun biter.',
  'Oyun sonunda tahtada daha çok taşı olan kazanır.',
  'Köşeler çok değerlidir: köşedeki taş bir daha çevrilemez. Boş bir köşenin hemen yanındaki karelere (özellikle çaprazdakine) oynamak çoğu zaman rakibe köşeyi açar.',
]

export const reversiModule: GameModule<ReversiState> = {
  id: 'reversi',
  slug: 'reversi',
  name: 'Reversi',
  icon: '◐',
  engineName: 'Bilgisayar',
  sideLabels: COLOR_NAMES,
  sideColors: { w: 'b', b: 'w' },
  sideChoiceTitle: 'Hangi renkle oynamak istersin?',
  sideChoices: [
    { value: 'w', label: 'Siyah' },
    { value: 'b', label: 'Beyaz' },
    { value: 'random', label: 'Rastgele' },
  ],
  levels: LEVELS,
  defaultLevel: 3,
  analysisDepth: 7,
  phaseTips: {
    opening: [
      'Az taş çevir, ortada kal.',
      'Kenarlara erken gitme; ortadaki küçük alanda kal.',
      'Rakibe az hamle seçeneği bırakan hamleleri ara.',
      'Çok taş çevirmek her zaman iyi değil; az ama güvenli çevir.',
    ],
    middlegame: [
      'Köşeleri koru, rakibe az seçenek bırak.',
      'Köşenin hemen yanındaki karelere oynama; rakibe köşeyi açar.',
      'Kenar boyunca tek başına taş bırakma.',
      'Rakibin hamle sayısını azaltan hamleler seni öne geçirir.',
    ],
    endgame: [
      'Taşları say ve sona kadar hesapla.',
      'Köşeler ve kenarlar artık çok değerli: fırsat bulunca al.',
      'Son boş karelerde sıranın kimde olacağını hesapla.',
      'Rakibini pas geçmeye zorlayacak hamleleri ara.',
    ],
  },
  errorTypes: [
    { id: 'gave_corner', label: 'Rakibe köşe verme', tip: 'Boş köşenin yanındaki karelere (özellikle çaprazdakine) oynama.' },
    { id: 'missed_corner', label: 'Köşe almayı kaçırma', tip: 'Her hamlede alabileceğin bir köşe var mı, bak.' },
    { id: 'mobility', label: 'Rakibe çok seçenek bırakma', tip: 'Rakibe az oynayacak yer bırakan hamleleri seç.' },
    { id: 'greedy', label: 'Erken çok taş çevirme', tip: 'Oyunun başında az taş çevir: çok çevirmek rakibe yer açar.' },
    { id: 'endgame', label: 'Oyun sonu hatası', tip: 'Son hamlelerde sona kadar hesapla: en çok çeviren hamle her zaman iyi değildir.' },
    { id: 'other', label: 'Diğer (plan hatası)', tip: 'Taşlarını içeride tut, köşelere dikkat et.' },
  ],
  moveListLayout: 'list',
  computerDelayMs: 500,
  warningLabel: {
    title: 'Köşe uyarısı',
    description: 'Rakibine köşe açacak bir hamle yaparsan hamlenin altında seni uyarır; istersen Geri al ile hamleni geri alırsın.',
  },
  rules: { title: 'Reversi nasıl oynanır?', items: RULES },

  newState: () => ({ position: initialPosition(), moves: [] }),
  stateFromRecord: (record) => replay(record).state,
  stateToRecord: recordText,
  position: (state) => encode(state.position),
  turn: (state) => state.position.turn,
  history: (state) => state.moves,
  play(state, move) {
    const played = moveRecord(state.position, move)
    if (!played) return null
    return { position: played.position, moves: [...state.moves, played.record] }
  },
  end: endOf,

  readGame(record) {
    const { state, terminal } = replay(record)
    return { moves: state.moves, terminal }
  },
  playAt(position, move) {
    try {
      const before = decode(position)
      const played = moveRecord(before, move)
      if (!played) return null
      return {
        position: encode(played.position),
        label: played.record.label,
        turn: played.position.turn,
        ended: moverResult(played.position, before.turn),
      }
    } catch {
      return null
    }
  },
  moveLabel: moveLabelAt,
  moveTitle: (ply, side, label) => `${ply + 1}. hamle · ${COLOR_NAMES[side]} ${label}`,

  engine: reversiEngine,
  winPercent: reversiWinPercent,
  explain: explainReversiMove,
  describeMove: describeReversiMove,
  lessons: [...REVERSI_LESSONS, ...REVERSI_LESSONS_2],
  phaseOf: (position) => reversiPhase(position),
  statusNote(state, userSide) {
    if (state.position.turn !== userSide || winnerOf(state.position) !== null) return null
    const n = state.moves.length
    const last = state.moves[n - 1]
    const previous = state.moves[n - 2]
    if (last?.side === userSide) return 'Rakibinin oynayacak yeri yoktu: tekrar sen oynuyorsun.'
    if (last && previous && previous.side === last.side) return 'Oynayacak yerin olmadığı için sıra rakibine geçmişti; rakip iki kez oynadı.'
    return null
  },
  coachQuestions: (state) => reversiCoachQuestions(state.position),
  coachTip: (state) => reversiCoachTip(state.position),
  coachWarning: (state, move) => reversiCoachWarning(state.position, move),
  puzzleHint: reversiPuzzleHint,

  Board: ReversiBoard,
}
