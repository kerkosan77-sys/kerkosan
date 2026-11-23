import type { GameEnd, GameModule, MoveRecord, MoverResult, ReadGame, RecordMeta, Score, Side } from '../../core/types'
import { damaCoachQuestions, damaCoachTip, damaCoachWarning } from './coach'
import DamaBoard from './DamaBoard'
import { damaEngine } from './engine'
import { damaPhase, describeDamaMove } from './describe'
import { explainDamaMove, labelFor } from './explain'
import { damaPuzzleHint } from './hints'
import { LEVELS } from './levels'
import { DAMA_LESSONS } from './lessons'
import { DAMA_LESSONS_2 } from './lessons2'
import {
  COLOR_NAMES,
  applyMove,
  boardKey,
  decode,
  encode,
  initialPosition,
  legalMoves,
  statusOf,
  type DamaPosition,
  type EndReason,
} from './rules'

export interface DamaState {
  position: DamaPosition
  moves: MoveRecord[]
}

const MOVE_PATTERN = /^[a-h][1-8](?:[-x][a-h][1-8])+$/

/** Record format: optional `[Key "Value"]` header lines, then the moves ("c3-c4 f6-f5 d4xd6 …"). */
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
      if (MOVE_PATTERN.test(token.toLowerCase())) moves.push(token.toLowerCase())
    }
  }
  return { headers, moves }
}

/** How the game stands after the last move: a finished game's winner and reason, or null. */
function endStatus(position: DamaPosition, history: string[]): { winner: Side | 'draw'; reason: EndReason } | null {
  const status = statusOf(position)
  if (status) return status
  const key = boardKey(position)
  if (history.filter((k) => k === key).length >= 3) return { winner: 'draw', reason: 'repetition' }
  return null
}

function moverResult(winner: Side | 'draw', mover: Side): MoverResult {
  return winner === 'draw' ? 'draw' : winner === mover ? 'win' : 'loss'
}

function moveRecord(before: DamaPosition, code: string): { record: MoveRecord; position: DamaPosition } | null {
  const result = applyMove(before, code)
  if (!result) return null
  const canonical = code.toLowerCase()
  return {
    record: { code: canonical, label: labelFor(canonical, result.move), side: before.turn, before: encode(before), after: encode(result.position) },
    position: result.position,
  }
}

function replay(record: string): { state: DamaState; terminal: ReadGame['terminal'] } {
  let position = initialPosition()
  const keys = [boardKey(position)]
  const moves: MoveRecord[] = []
  const terminal: ReadGame['terminal'] = [null]
  parseRecord(record).moves.forEach((code, k) => {
    const played = moveRecord(position, code)
    if (!played) throw new Error(`Geçersiz Dama hamlesi: ${k + 1}. hamle (${code})`)
    moves.push(played.record)
    position = played.position
    keys.push(boardKey(position))
    const status = endStatus(position, keys)
    terminal.push(status ? moverResult(status.winner, played.record.side) : null)
  })
  return { state: { position, moves }, terminal }
}

const DRAW_TEXT: Partial<Record<EndReason, string>> = {
  one_each: 'İkinizin de birer taşı kaldı: oyun berabere.',
  quiet: '32 hamle boyunca taş alınmadı: oyun berabere.',
  repetition: 'Aynı pozisyon üç kez tekrarlandı: oyun berabere.',
}

function endOf(state: DamaState, userSide: Side): GameEnd | null {
  const keys = [boardKey(initialPosition()), ...state.moves.map((m) => boardKey(decode(m.after)))]
  const status = endStatus(state.position, keys)
  if (!status) return null
  const { winner, reason } = status
  const result: GameEnd['result'] = winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : '1/2-1/2'
  if (winner === 'draw') return { result, outcome: 'draw', title: 'Berabere', detail: DRAW_TEXT[reason] ?? 'Oyun berabere.' }
  if (winner === userSide) {
    const detail = reason === 'no_pieces' ? 'Rakibinin bütün taşlarını aldın. Tebrikler!' : 'Rakibinin oynayacak hamlesi kalmadı. Tebrikler!'
    return { result, outcome: 'win', title: 'Kazandın!', detail }
  }
  const detail = reason === 'no_pieces' ? 'Bütün taşların alındı.' : 'Oynayacak hamlen kalmadı.'
  return { result, outcome: 'loss', title: 'Kaybettin', detail: `${detail} Analizde nerede taş kaptırdığına bakalım.` }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function recordText(state: DamaState, meta?: RecordMeta): string {
  const moves = state.moves.map((m) => m.code).join(' ')
  if (!meta) return moves
  const lines = ['[Oyun "Dama"]']
  if (meta.date) {
    const d = meta.date
    lines.push(`[Tarih "${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}"]`)
  }
  if (meta.names) lines.push(`[Beyaz "${meta.names.w}"]`, `[Siyah "${meta.names.b}"]`)
  if (meta.result) lines.push(`[Sonuc "${meta.result}"]`)
  return `${lines.join('\n')}\n\n${moves}${meta.result ? ` ${meta.result}` : ''}`
}

/** Winning chances from a score in centi-men: about 65% one man ahead, 86% a dama ahead. */
export function damaWinPercent(score: Score): number {
  if (score.kind === 'mate') return score.value > 0 ? 100 : 0
  const cp = Math.max(-2000, Math.min(2000, score.value))
  return 50 + 50 * Math.tanh(0.003 * cp)
}

function moveLabelAt(position: string, move: string): string {
  try {
    const result = applyMove(decode(position), move)
    return result ? labelFor(move.toLowerCase(), result.move) : move
  } catch {
    return move
  }
}

const RULES = [
  'Beyaz başlar. Taşlar bir kare ileri ya da yana (sağa, sola) gider; geri ve çapraz gitmez.',
  'Rakip taşın hemen önündeki ya da yanındaki taşın arkası boşsa, üstünden atlayıp onu alırsın. Aldıktan sonra yine alabiliyorsan almaya devam edersin.',
  'Alma zorunludur. Birden fazla yol varsa en çok taş alan yolu seçmek zorundasın. Bilgisayar alman gereken taşları turuncu halkayla gösterir.',
  'Son sıraya ulaşan taş dama olur (üstünde taç görünür). Dama düz çizgide istediği kadar ileri, geri ve yana gider; uzaktaki taşı da üstünden atlayarak alır.',
  'Rakibin bütün taşlarını alırsan ya da rakibin oynayacak hamlesi kalmazsa kazanırsın.',
  'İkinizin de birer taşı kalırsa, aynı pozisyon üç kez tekrarlanırsa ya da 32 hamle boyunca taş alınmazsa oyun berabere biter.',
]

export const damaModule: GameModule<DamaState> = {
  id: 'dama',
  slug: 'dama',
  name: 'Dama',
  icon: '⛀',
  engineName: 'Bilgisayar',
  sideLabels: COLOR_NAMES,
  sideChoiceTitle: 'Hangi renkle oynamak istersin?',
  sideChoices: [
    { value: 'w', label: 'Beyaz' },
    { value: 'b', label: 'Siyah' },
    { value: 'random', label: 'Rastgele' },
  ],
  levels: LEVELS,
  defaultLevel: 3,
  analysisDepth: 7,
  phaseTips: {
    opening: 'Taşlarını birlikte ilerlet, arkalarını boş bırakma.',
    middlegame: 'Zorunlu alma tuzaklarına ve taş kaptırma tehditlerine dikkat et.',
    endgame: 'Dama yapmaya çalış, rakibin dama olmasını engelle.',
  },
  errorTypes: [
    { id: 'allowed_capture', label: 'Rakibe taş kaptırma', tip: 'Hamlenden sonra rakip taş alabilir mi, bak.' },
    { id: 'allowed_trap', label: 'Zorunlu alma tuzağına düşme', tip: 'Rakibin verdiği taşı almadan önce sonrasını hesapla: zorunlu alma tuzak olabilir.' },
    { id: 'allowed_promotion', label: 'Rakibe dama yaptırma', tip: 'Rakibin son sıraya yakın taşlarını durdur.' },
    { id: 'missed_combination', label: 'Taş verip kazanma fırsatını kaçırma', tip: 'Bir taş verip rakibi zorunlu almaya sokacak fırsatları ara.' },
    { id: 'missed_promotion', label: 'Dama yapma fırsatını kaçırma', tip: 'Dama olabilecek taşlarını ilerlet.' },
    { id: 'endgame', label: 'Oyun sonu hatası', tip: 'Oyun sonunda damanı etkin kullan, taşlarını korumalı ilerlet.' },
    { id: 'other', label: 'Diğer (plan hatası)', tip: 'Taşlarını yan yana tut, tek başına taş bırakma.' },
  ],
  moveListLayout: 'pairs',
  computerDelayMs: 500,
  warningLabel: {
    title: 'Taş kaptırma uyarısı',
    description: 'Rakibine taş kazandıracak ya da dama yaptıracak bir hamle yaparsan hamlenin altında seni uyarır; istersen Geri al ile hamleni geri alırsın.',
  },
  rules: { title: 'Dama nasıl oynanır?', items: RULES },

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
      const status = statusOf(played.position)
      return {
        position: encode(played.position),
        label: played.record.label,
        turn: played.position.turn,
        ended: status ? moverResult(status.winner, before.turn) : null,
      }
    } catch {
      return null
    }
  },
  moveLabel: moveLabelAt,
  moveTitle: (ply, side, label) => `${ply + 1}. hamle · ${COLOR_NAMES[side]} ${label}`,

  engine: damaEngine,
  winPercent: damaWinPercent,
  explain: explainDamaMove,
  describeMove: describeDamaMove,
  lessons: [...DAMA_LESSONS, ...DAMA_LESSONS_2],
  phaseOf: (position) => damaPhase(position),
  statusNote(state, userSide) {
    if (state.position.turn !== userSide) return null
    const moves = legalMoves(state.position)
    if (moves.length === 0 || moves[0].captured.length === 0) return null
    const most = moves[0].captured.length
    return most === 1
      ? 'Alma zorunlu: turuncu halkalı taşla rakibin taşını almalısın.'
      : `Alma zorunlu: turuncu halkalı taşla en çok taşı (${most} taş) alan yolu seçmelisin.`
  },
  coachQuestions: (state) => damaCoachQuestions(state.position),
  coachTip: (state) => damaCoachTip(state.position),
  coachWarning: (state, move) => damaCoachWarning(state.position, move),
  puzzleHint: damaPuzzleHint,

  Board: DamaBoard,
}
