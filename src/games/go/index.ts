import type { BoardMark, GameEnd, GameModule, RecordMeta, Score, Side } from '../../core/types'
import { opposite } from '../../core/types'
import { BLACK, EMPTY, WHITE } from './fastboard'
import { goEngine } from './engine'
import GoBoard from './GoBoard'
import { LEVELS } from './levels'
import { GO_LESSONS } from './lessons'
import { GO_LESSONS_2 } from './lessons2'
import {
  COLOR_NAMES,
  PASS_MOVE,
  applyMove,
  coordOf,
  decode,
  encode,
  estimateDead,
  finalScore,
  formatPoints,
  indexOf,
  labelFor,
  moveLabelAt,
  sideOf,
  toggleDead,
  winnerOf,
  type AreaScore,
  type GoPosition,
} from './rules'
import { goCoachQuestions, goCoachTip, goCoachWarning } from './coach'
import { describeGoMove, goPhase } from './describe'
import { explainGoMove } from './explain'
import { goPuzzleHint } from './hints'
import ImportPanel from './ImportPanel'
import { moveRecord, newState, replay, resultForMover, type GoState } from './record'
import { territoryView } from './territory'
import { writeSgf } from './sgf'

export type { GoState } from './record'

function scoreMarks(position: GoPosition, score: AreaScore): BoardMark[] {
  const marks: BoardMark[] = []
  const dead = new Set(score.dead)
  for (let i = 0; i < position.board.length; i++) {
    const owner = score.owner[i]
    if (owner !== EMPTY && (position.board[i] === EMPTY || dead.has(i))) {
      marks.push({ kind: 'territory', square: coordOf(i, position.size), side: sideOf(owner) })
    }
  }
  for (const i of score.dead) marks.push({ kind: 'dead', square: coordOf(i, position.size) })
  return marks
}

function endOf(state: GoState, userSide: Side): GameEnd | null {
  const { position } = state
  if (position.passes < 2) return null
  const score = finalScore(position, state.dead ?? undefined)
  const winner = winnerOf(score)
  const result: GameEnd['result'] = winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : '1/2-1/2'
  const mine = userSide === 'w' ? score.black : score.white
  const theirs = userSide === 'w' ? score.white : score.black
  const komi = formatPoints(score.komi)
  const area = (points: number, side: Side) => (side === 'b' && score.komi !== 0 ? `${points} + ${komi} komi` : `${points}`)
  const count = `Senin alanın: ${area(mine, userSide)} · Rakibinin: ${area(theirs, opposite(userSide))}.`
  const diff = formatPoints(Math.abs(score.margin))
  const marks = scoreMarks(position, score)
  if (winner === 'draw') return { result, outcome: 'draw', title: 'Berabere', detail: `${count} Alanlar eşit.`, marks }
  return winner === userSide
    ? { result, outcome: 'win', title: 'Kazandın!', detail: `${count} ${diff} farkla kazandın. Tebrikler!`, marks }
    : { result, outcome: 'loss', title: 'Kaybettin', detail: `${count} ${diff} farkla kaybettin. Analizde nerede alan kaçırdığına bakalım.`, marks }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function recordText(state: GoState, meta?: RecordMeta): string {
  const { position } = state
  const over = position.passes >= 2
  const info: Record<string, string> = {}
  if (meta?.date) {
    const d = meta.date
    info.DT = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  if (meta?.names) {
    info.PB = meta.names.w
    info.PW = meta.names.b
  }
  const dead = over ? (state.dead ?? estimateDead(position)) : null
  if (over) {
    const score = finalScore(position, dead ?? undefined)
    const winner = winnerOf(score)
    info.RE = winner === 'draw' ? '0' : `${winner === 'w' ? 'B' : 'W'}+${Math.abs(score.margin)}`
  } else if (meta?.result) {
    info.RE = meta.result === '1-0' ? 'B+R' : meta.result === '0-1' ? 'W+R' : '0'
  }
  const setup = { black: [] as number[], white: [] as number[] }
  state.start.board.forEach((stone, i) => {
    if (stone === BLACK) setup.black.push(i)
    else if (stone === WHITE) setup.white.push(i)
  })
  return writeSgf({
    size: position.size,
    komi: position.komi,
    info,
    setup,
    moves: state.moves.map((m) => ({ side: m.side, move: m.code })),
    dead,
  })
}

/** Winning chances from the expected final margin in centi-points: about 73% when 8 points ahead. */
export function goWinPercent(score: Score): number {
  if (score.kind === 'mate') return score.value > 0 ? 100 : 0
  const cp = Math.max(-8000, Math.min(8000, score.value))
  return 100 / (1 + Math.exp(-cp / 800))
}

const RULES = [
  'Siyah başlar. Sırayla çizgilerin kesiştiği boş noktalara birer taş koyarsınız; konan taş bir daha yer değiştirmez.',
  'Bir taşın hemen yanındaki (sağ, sol, üst, alt) boş noktalar onun nefesidir. Yan yana duran aynı renk taşlar bir grup olur ve nefeslerini paylaşır.',
  'Bir grubun bütün nefeslerini kapatırsan o taşları yakalayıp tahtadan alırsın. Tek nefesi kalan gruba "atari" denir.',
  'Taşını nefessiz bırakacağın bir yere oynayamazsın (rakibi yakalamıyorsan). Az önce tek taş yakalayan taşı hemen geri yakalamak da yasaktır (ko); önce başka bir yere oyna.',
  'Amaç daha çok alan çevirmek. Oyun bitince tahtadaki taşların ve çevirdiğin boş noktalar sayılır. Beyaz ikinci başladığı için 7,5 ekstra alan (komi) alır.',
  'Oynayacak işe yarar yer kalmayınca "Pas geç"e bas. İki oyuncu üst üste pas geçince oyun biter ve alanlar sayılır.',
]

export const goModule: GameModule<GoState> = {
  id: 'go',
  slug: 'go',
  name: 'Go',
  icon: '⚫',
  engineName: 'Bilgisayar',
  sideLabels: COLOR_NAMES,
  sideColors: { w: 'b', b: 'w' },
  sideChoiceTitle: 'Hangi renkle oynamak istersin?',
  sideChoices: [
    { value: 'w', label: 'Siyah (ilk sen başla)' },
    { value: 'b', label: 'Beyaz' },
    { value: 'random', label: 'Rastgele' },
  ],
  levels: LEVELS,
  defaultLevel: 2,
  analysisDepth: 10,
  // Monte Carlo search is optimistic for the side to move at the root (about 2-4 points on 9x9).
  compareAfterBest: true,
  analysisRevision: 1,
  phaseTips: {
    opening: 'Önce köşelere, sonra kenarlara oyna.',
    middlegame: 'Zayıf gruplarını güçlendir, rakibin zayıf gruplarına saldır.',
    endgame: 'Sınırları kapat; açık nokta kalmayınca pas geç.',
  },
  errorTypes: [
    { id: 'lost_group', label: 'Taşlarını yakalatma', tip: 'Taşlarının nefeslerini say; tek nefesi kalan gruplarını kurtar.' },
    { id: 'self_atari', label: 'Kendi taşlarını atariye sokma', tip: 'Hamlenden sonra kendi taşlarının kaç nefesi kaldığına bak.' },
    { id: 'missed_capture', label: 'Yakalama fırsatını kaçırma', tip: 'Rakibin tek nefesi kalan taşlarını ara ve yakala.' },
    { id: 'early_pass', label: 'Erken pas geçme', tip: 'Tahtada hâlâ açık sınır varken pas geçme.' },
    { id: 'small_move', label: 'Küçük hamle (büyük yeri kaçırma)', tip: 'Her hamlede tahtadaki en büyük boş bölgeyi düşün.' },
    { id: 'other', label: 'Diğer (plan hatası)', tip: 'Gruplarını bağlı ve canlı tut, alanını büyüt.' },
  ],
  moveListLayout: 'pairs',
  computerDelayMs: 500,
  warningLabel: {
    title: 'Taş kaptırma uyarısı',
    description:
      'Taşlarını atariye sokan ya da atarideki taşlarını kurtarmayan bir hamle yaparsan, ya da erken pas geçersen seni uyarır ve hamleni geri almanı sağlar.',
  },
  rules: { title: 'Go nasıl oynanır?', items: RULES },

  newState,
  stateFromRecord: (record) => replay(record).state,
  stateToRecord: recordText,
  position: (state) => encode(state.position),
  turn: (state) => state.position.turn,
  history: (state) => state.moves,
  play(state, move) {
    const result = applyMove(state.position, move)
    if (!result) return null
    return { ...state, position: result.position, moves: [...state.moves, moveRecord(state.position, move, result)], dead: null }
  },
  end: endOf,

  readGame(record) {
    const { state, terminal } = replay(record)
    return { moves: state.moves, terminal }
  },
  playAt(position, move) {
    try {
      const result = applyMove(decode(position), move)
      if (!result) return null
      return {
        position: encode(result.position),
        label: labelFor(result),
        turn: result.position.turn,
        ended: result.over ? resultForMover(finalScore(result.position), result.mover) : null,
      }
    } catch {
      return null
    }
  },
  moveLabel: moveLabelAt,
  moveTitle: (ply, side, label) => `${ply + 1}. hamle · ${COLOR_NAMES[side]} ${label}`,

  engine: goEngine,
  winPercent: goWinPercent,
  explain: explainGoMove,
  describeMove: describeGoMove,
  territory: (state) => territoryView(state.position),
  lessons: [...GO_LESSONS, ...GO_LESSONS_2],
  phaseOf: (position) => goPhase(position),
  statusNote(state, userSide) {
    const last = state.moves[state.moves.length - 1]
    if (last && last.side !== userSide && last.code === PASS_MOVE && state.position.passes < 2) {
      return 'Rakibin pas geçti. Sen de pas geçersen oyun biter ve alanlar sayılır.'
    }
    return null
  },
  coachQuestions: (state) => goCoachQuestions(state.position),
  coachTip: (state) => goCoachTip(state.position),
  coachWarning: (state, move) => goCoachWarning(state.position, move),
  puzzleHint: goPuzzleHint,

  pass: {
    move: PASS_MOVE,
    confirm: (state) =>
      state.position.passes > 0
        ? 'Rakibin pas geçti. Sen de pas geçersen oyun biter ve alanlar sayılır.'
        : 'Pas geçersen sıra rakibine geçer. İkiniz üst üste pas geçerseniz oyun biter ve alanlar sayılır. Oynayacak işe yarar yer kalmadıysa pas geç.',
  },
  scoring: {
    toggle(state, square) {
      const index = indexOf(square, state.position.size)
      if (index === null || state.position.passes < 2) return null
      const dead = toggleDead(state.position, state.dead ?? estimateDead(state.position), index)
      return dead ? { ...state, dead } : null
    },
    help: 'Ölü sayılan taşlar soluk ve ✕ işaretli; küçük kareler kimin alanı olduğunu gösteriyor. Yanlış sayılan bir grup varsa taşına dokunarak düzelt, sonuç hemen güncellenir.',
  },

  Board: GoBoard,
  ImportPanel,
}
