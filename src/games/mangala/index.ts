import type { GameEnd, GameModule, MoveRecord, MoverResult, ReadGame, RecordMeta, Score, Side } from '../../core/types'
import { mangalaCoachQuestions, mangalaCoachTip, mangalaCoachWarning } from './coach'
import { mangalaEngine } from './engine'
import { describeMangalaMove, mangalaPhase } from './describe'
import { explainMangalaMove } from './explain'
import { mangalaPuzzleHint } from './hints'
import { LEVELS } from './levels'
import { MANGALA_LESSONS } from './lessons'
import { MANGALA_LESSONS_2 } from './lessons2'
import MangalaBoard from './MangalaBoard'
import {
  STORE,
  applyMove,
  decode,
  encode,
  initialPosition,
  isOver,
  pitNumber,
  winner,
  type MoveResult,
  type Position,
} from './rules'

export interface MangalaState {
  position: Position
  moves: MoveRecord[]
}

/** "3. kuyu", "5. kuyu (+6 taş)", "4. kuyu (tekrar)", "2. kuyu (oyun bitti)" */
export function labelFor(index: number, result: MoveResult): string {
  let label = `${pitNumber(index)}. kuyu`
  if (result.capture) label += ` (+${result.capture.stones} taş)`
  if (result.extraTurn) label += ' (tekrar)'
  if (result.over) label += ' (oyun bitti)'
  return label
}

function moverResult(result: MoveResult): MoverResult | null {
  if (!result.over) return null
  const won = winner(result.position.pits)
  return won === 'draw' ? 'draw' : won === result.mover ? 'win' : 'loss'
}

/** Record format: optional `[Key "Value"]` header lines, then the moves as pit indices. */
export function parseRecord(record: string): { headers: Record<string, string>; moves: number[] } {
  const headers: Record<string, string> = {}
  const moves: number[] = []
  for (const line of record.split(/\r?\n/)) {
    const header = /^\s*\[(\S+)\s+"(.*)"\]\s*$/.exec(line)
    if (header) {
      headers[header[1]] = header[2]
      continue
    }
    for (const token of line.trim().split(/\s+/)) {
      if (/^\d+$/.test(token)) moves.push(Number(token))
    }
  }
  return { headers, moves }
}

function replay(record: string): { state: MangalaState; terminal: ReadGame['terminal'] } {
  let position = initialPosition()
  const moves: MoveRecord[] = []
  const terminal: ReadGame['terminal'] = [null]
  for (const index of parseRecord(record).moves) {
    const result = applyMove(position, index)
    if (!result) throw new Error(`Geçersiz Mangala hamlesi: ${index}`)
    moves.push({
      code: String(index),
      label: labelFor(index, result),
      side: result.mover,
      before: encode(position),
      after: encode(result.position),
    })
    terminal.push(moverResult(result))
    position = result.position
  }
  return { state: { position, moves }, terminal }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function endOf(position: Position, userSide: Side): GameEnd | null {
  if (!isOver(position.pits)) return null
  const won = winner(position.pits)
  const opponent: Side = userSide === 'w' ? 'b' : 'w'
  const mine = position.pits[STORE[userSide]]
  const theirs = position.pits[STORE[opponent]]
  const result: GameEnd['result'] = won === 'w' ? '1-0' : won === 'b' ? '0-1' : '1/2-1/2'
  if (won === 'draw') {
    return { result, outcome: 'draw', title: 'Berabere', detail: `İkinizin hazinesinde de ${mine} taş var.` }
  }
  return won === userSide
    ? { result, outcome: 'win', title: 'Kazandın!', detail: `Hazinende ${mine} taş var, rakibinde ${theirs}. Tebrikler!` }
    : {
        result,
        outcome: 'loss',
        title: 'Kaybettin',
        detail: `Hazinende ${mine} taş var, rakibinde ${theirs}. Analizde nerede taş kaçırdığına bakalım.`,
      }
}

function recordText(state: MangalaState, meta?: RecordMeta): string {
  const moves = state.moves.map((m) => m.code).join(' ')
  if (!meta) return moves
  const lines = ['[Oyun "Mangala"]']
  if (meta.date) {
    const d = meta.date
    lines.push(`[Tarih "${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}"]`)
  }
  if (meta.names) lines.push(`[Birinci "${meta.names.w}"]`, `[Ikinci "${meta.names.b}"]`)
  if (meta.result) lines.push(`[Sonuc "${meta.result}"]`)
  return `${lines.join('\n')}\n\n${moves}${meta.result ? ` ${meta.result}` : ''}`
}

/** Winning chances from a score in centi-stones: about 73% when 5 stones ahead. */
export function mangalaWinPercent(score: Score): number {
  if (score.kind === 'mate') return score.value > 0 ? 100 : 0
  const cp = Math.max(-2400, Math.min(2400, score.value))
  return 50 + 50 * (2 / (1 + Math.exp(-0.002 * cp)) - 1)
}

function moveLabelAt(position: string, move: string): string {
  try {
    const index = Number(move)
    const result = applyMove(decode(position), index)
    return result ? labelFor(index, result) : `${move}`
  } catch {
    return move
  }
}

export const mangalaModule: GameModule<MangalaState> = {
  id: 'mangala',
  slug: 'mangala',
  name: 'Mangala',
  icon: '🟤',
  engineName: 'Bilgisayar',
  sideLabels: { w: 'Birinci oyuncu', b: 'İkinci oyuncu' },
  sideChoiceTitle: 'Kim başlasın?',
  sideChoices: [
    { value: 'w', label: 'Ben başlayayım' },
    { value: 'b', label: 'Bilgisayar başlasın' },
    { value: 'random', label: 'Rastgele' },
  ],
  levels: LEVELS,
  defaultLevel: 3,
  analysisDepth: 14,
  phaseTips: {
    opening: [
      'İlk hamlelerde tekrar oynama fırsatlarını kullan.',
      'Hamleden önce son taşın nereye düşeceğini say.',
      'Son taşı hazineye düşen kuyuları, başka hamleden önce oyna.',
      'Çok taşlı kuyunu erken boşaltma; taşların rakibin tarafına geçer.',
    ],
    middlegame: [
      'Rakibin çift ve boş kuyu tehditlerine karşı kuyularını koru.',
      'Rakibin tek sayıda taş olan kuyularını bul: son taşınla çift yapıp alabilirsin.',
      'Son taşı kendi boş kuyuna düşürüp karşıdaki taşları almayı ara.',
      'Hamleden sonra rakibin hangi kuyuna dokunabileceğine bak.',
    ],
    endgame: [
      'Kalan taşları say, kuyularının ne zaman boşalacağını hesapla.',
      'Kendi tarafı önce boşalan, rakibin kalan taşlarını kazanır: bunu hesaba kat.',
      'Taşlar azaldıkça her hamlenin sonunu tek tek say.',
      'Hazinende 24\'ten fazla taş varsa oyunu kazandın; riske girme.',
    ],
  },
  errorTypes: [
    { id: 'allowed_capture', label: 'Rakibe taş kaptırma', tip: 'Kuyularında tek sayıda taş bırakma: rakip onları çift yapıp alabilir.' },
    { id: 'allowed_extra_turn', label: 'Rakibe tekrar oynama fırsatı verme', tip: 'Hamlenden sonra rakip son taşını hazinesine düşürebilir mi, bak.' },
    { id: 'missed_capture', label: 'Taş alma fırsatını kaçırma', tip: 'Her kuyunun son taşının nereye düştüğünü say: alabileceğin taş var mı?' },
    { id: 'missed_extra_turn', label: 'Tekrar oynama fırsatını kaçırma', tip: 'Son taşı hazinene düşen kuyuları ara: tekrar oynamak güçlüdür.' },
    { id: 'endgame', label: 'Oyun sonu hatası', tip: 'Oyun sonunda taşları say: kuyuları boşalan, rakibin kalan taşlarını alır.' },
    { id: 'other', label: 'Diğer (plan hatası)', tip: 'Taşlarını güvende tut, rakibe fırsat verme.' },
  ],
  moveListLayout: 'list',
  wideBoard: true,
  stonesPlaced: (position, move) => decode(position).pits[Number(move)] || 1,
  computerDelayMs: 1300,
  warningLabel: {
    title: 'Taş kaptırma uyarısı',
    description: 'Rakibine çok taş kazandıracak bir hamle yaparsan hamlenin altında seni uyarır; istersen Geri al ile hamleni geri alırsın.',
  },

  newState: () => ({ position: initialPosition(), moves: [] }),
  stateFromRecord: (record) => replay(record).state,
  stateToRecord: recordText,
  position: (state) => encode(state.position),
  turn: (state) => state.position.turn,
  history: (state) => state.moves,
  play(state, move) {
    const index = Number(move)
    const result = applyMove(state.position, index)
    if (!result) return null
    return {
      position: result.position,
      moves: [
        ...state.moves,
        {
          code: String(index),
          label: labelFor(index, result),
          side: result.mover,
          before: encode(state.position),
          after: encode(result.position),
        },
      ],
    }
  },
  end: (state, userSide) => endOf(state.position, userSide),

  readGame(record) {
    const { state, terminal } = replay(record)
    return { moves: state.moves, terminal }
  },
  playAt(position, move) {
    try {
      const index = Number(move)
      const result = applyMove(decode(position), index)
      if (!result) return null
      return {
        position: encode(result.position),
        label: labelFor(index, result),
        turn: result.position.turn,
        ended: moverResult(result),
      }
    } catch {
      return null
    }
  },
  moveLabel: moveLabelAt,
  moveTitle: (ply, _side, label) => `${ply + 1}. hamle: ${label}`,

  engine: mangalaEngine,
  winPercent: mangalaWinPercent,
  explain: explainMangalaMove,
  describeMove: describeMangalaMove,
  lessons: [...MANGALA_LESSONS, ...MANGALA_LESSONS_2],
  phaseOf: mangalaPhase,
  statusNote(state, userSide) {
    const last = state.moves[state.moves.length - 1]
    if (last && last.side === userSide && state.position.turn === userSide && !isOver(state.position.pits)) {
      return 'Son taşın hazinene düştü: tekrar oynuyorsun!'
    }
    return null
  },
  coachQuestions: (state) => mangalaCoachQuestions(state.position),
  coachTip: (state) => mangalaCoachTip(state.position),
  coachWarning: (state, move) => mangalaCoachWarning(state.position, Number(move)),
  puzzleHint: mangalaPuzzleHint,

  Board: MangalaBoard,
}
