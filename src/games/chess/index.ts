import { Chess, type Move } from 'chess.js'
import type { GameModule, MoveRecord, ReadGame, RecordMeta, Side } from '../../core/types'
import { chessEngine } from './engine/adapter'
import { LEVELS } from './engine/levels'
import { CHESS_LESSONS } from './lessons'
import { CHESS_LESSONS_2 } from './lessons2'
import { attackersOf, chessCoachTip, coachQuestions, hangingWarningText } from './logic/coach'
import { CHESS_ERROR_TYPES } from './logic/errorTypes'
import { explainMove } from './logic/explain'
import { chessPhase, describeChessMove } from './logic/describe'
import { detectGameEnd, pgnDate } from './logic/gameEnd'
import { shouldWarn } from './logic/hanging'
import { parseUci, playUci, uciToSan } from './logic/motifs'
import { PIECE_WORDS, formatSan } from './logic/pieces'
import { winPercent } from './logic/winPercent'
import ChessBoardView from './ui/ChessBoardView'
import ImportPanel from './ui/ImportPanel'

/** Treated as immutable: `play` returns a new state. */
export interface ChessState {
  game: Chess
}

interface KnownMoves {
  records: MoveRecord[]
  /** The moves in plain SAN, for copying the game. */
  san: string[]
}

/**
 * The moves of every game state, worked out once. chess.js rebuilds its whole move list (working out
 * every legal move again for each one) whenever it is asked for the history; the play screen asks on
 * every redraw, which made long games stutter on phones. A state made by `play` gets the list of
 * the state before plus its one new move.
 */
const known = new WeakMap<Chess, KnownMoves>()

function knownMoves(game: Chess): KnownMoves {
  let moves = known.get(game)
  if (!moves) {
    const verbose = game.history({ verbose: true })
    moves = { records: verbose.map(toRecord), san: verbose.map((move) => move.san) }
    known.set(game, moves)
  }
  return moves
}

function toRecord(move: Move): MoveRecord {
  return { code: move.lan, label: formatSan(move.san), side: move.color, before: move.before, after: move.after }
}

/** One move in chess.js's history, as version 1.4 keeps it. */
interface HistoryEntry {
  move: unknown
  kings: Record<string, number>
  castling: Record<string, number>
}

/** chess.js's own fields, as version 1.4 keeps them (checked before they are copied). */
interface ChessFields {
  _board: unknown[]
  _kings: Record<string, number>
  _castling: Record<string, number>
  _header: Record<string, string>
  _comments: Record<string, string>
  _history: HistoryEntry[]
  _positionCount: Map<unknown, number>
  _hash: bigint
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/**
 * A copy made straight from chess.js's fields, in a few microseconds: replaying the moves took
 * longer with every move (about 8 ms at move 50 on a computer, several times that on a phone, for
 * every move of both sides). chess.js changes the king and castling records of a move when it takes
 * the move back, so each copy gets its own; the board's pieces and the moves themselves are never
 * changed once made and are shared. Null if chess.js keeps its fields differently (another
 * version): the moves are replayed then.
 */
function copyFields(game: Chess): Chess | null {
  const fields = game as unknown as ChessFields
  const first = fields._history?.[0] as unknown
  if (
    !Array.isArray(fields._board) ||
    fields._board.length !== 128 ||
    !Array.isArray(fields._history) ||
    !(fields._positionCount instanceof Map) ||
    typeof fields._hash !== 'bigint' ||
    !isRecord(fields._kings) ||
    !isRecord(fields._castling) ||
    (first !== undefined && !(isRecord(first) && 'move' in first && isRecord(first.kings) && isRecord(first.castling)))
  ) {
    return null
  }
  const copy = Object.assign(Object.create(Chess.prototype) as Chess, game) as unknown as ChessFields
  copy._board = fields._board.slice()
  copy._kings = { ...fields._kings }
  copy._castling = { ...fields._castling }
  copy._header = { ...fields._header }
  copy._comments = { ...fields._comments }
  copy._history = fields._history.map((entry) => ({ ...entry, kings: { ...entry.kings }, castling: { ...entry.castling } }))
  copy._positionCount = new Map(fields._positionCount)
  const result = copy as unknown as Chess
  return result.fen() === game.fen() ? result : null
}

function clone(game: Chess): Chess {
  const { san } = knownMoves(game)
  if (san.length === 0) return new Chess(game.fen())
  const fast = copyFields(game)
  if (fast) {
    known.set(fast, knownMoves(game))
    return fast
  }
  const copy = new Chess()
  // Games set up from a position keep their headers; ordinary games are copied from their moves alone.
  if (game.getHeaders().FEN) copy.loadPgn(game.pgn())
  else copy.loadPgn(san.map((move, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${move}` : move)).join(' '))
  known.set(copy, knownMoves(game))
  return copy
}

/** PGN of a game from the standard start position. */
function pgnText(san: string[], meta?: RecordMeta): string {
  const headers: [string, string][] = []
  if (meta) {
    headers.push(['Event', 'Akıl Oyunları Koçu'])
    if (meta.date) headers.push(['Date', pgnDate(meta.date)])
    if (meta.names) headers.push(['White', meta.names.w], ['Black', meta.names.b])
    if (meta.result) headers.push(['Result', meta.result])
  }
  const moves = san.map((move, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${move}` : move))
  if (meta?.result) moves.push(meta.result)
  const head = headers.map(([key, value]) => `[${key} "${value.replace(/"/g, "'")}"]`).join('\n')
  return head ? `${head}\n\n${moves.join(' ')}` : moves.join(' ')
}

function historyOf(game: Chess): MoveRecord[] {
  return knownMoves(game).records
}

/** Plays through a PGN and returns its moves plus how each position ended (if it did). */
export function readChessGame(pgn: string): ReadGame {
  const game = new Chess()
  game.loadPgn(pgn)
  const moves = historyOf(game)
  const replay = new Chess(moves[0]?.before ?? game.fen())
  const terminal: ReadGame['terminal'] = [null]
  for (const move of moves) {
    replay.move(parseUci(move.code))
    terminal.push(replay.isCheckmate() ? 'win' : replay.isDraw() ? 'draw' : null)
  }
  return { moves, terminal }
}

export const chessModule: GameModule<ChessState> = {
  id: 'chess',
  slug: 'satranc',
  name: 'Satranç',
  icon: '♞',
  engineName: 'Stockfish',
  sideLabels: { w: 'Beyaz', b: 'Siyah' },
  sideChoiceTitle: 'Rengin',
  sideChoices: [
    { value: 'w', label: 'Beyaz' },
    { value: 'b', label: 'Siyah' },
    { value: 'random', label: 'Rastgele' },
  ],
  levels: LEVELS,
  defaultLevel: 3,
  analysisDepth: 14,
  errorTypes: CHESS_ERROR_TYPES,
  phaseTips: {
    opening: [
      'Merkezi tut, atlarını ve fillerini çıkar, erken rok yap.',
      'Açılışta aynı taşı iki kez oynama; her hamlede yeni bir taş çıkar.',
      'Vezirini erken çıkarma; rakip onu kovalarken taşlarını geliştirir.',
      'Rok yapmadan şahının önündeki piyonları oynatma.',
    ],
    middlegame: [
      'Her hamleden önce saldırı altındaki taşlarına ve rakibin tehditlerine bak.',
      'Rakibin son hamlesi neyi tehdit ediyor? Önce bunu sor.',
      'Hamle seçmeden önce şah, alma ve tehdit hamlelerine bak: önce seninkiler, sonra rakibinkiler.',
      'Korumasız taş bırakma; her taşının en az bir koruyucusu olsun.',
    ],
    endgame: [
      'Şahını oyuna sok, geçer piyonunu ilerlet.',
      'Öndeysen taş değiş; gerideysen değişten kaçın.',
      'Kaleni geçer piyonların arkasına yerleştir.',
      'Piyonunun vezire çıkacağı yolu şahınla destekle.',
    ],
  },
  moveListLayout: 'pairs',
  computerDelayMs: 450,
  warningLabel: {
    title: 'Taş bırakma uyarısı',
    description: 'Bir taşını karşılıksız kaptıracak bir hamle yaparsan hamlenin altında seni uyarır; istersen Geri al ile hamleni geri alırsın.',
  },

  newState: () => ({ game: new Chess() }),
  stateFromRecord(record) {
    const game = new Chess()
    if (record.trim()) game.loadPgn(record)
    return { game }
  },
  stateToRecord(state, meta) {
    // Saved after every move: written from the known moves instead of asking chess.js to replay the game.
    if (!state.game.getHeaders().FEN) return pgnText(knownMoves(state.game).san, meta)
    const game = clone(state.game)
    if (meta) {
      game.setHeader('Event', 'Akıl Oyunları Koçu')
      if (meta.date) game.setHeader('Date', pgnDate(meta.date))
      if (meta.names) {
        game.setHeader('White', meta.names.w)
        game.setHeader('Black', meta.names.b)
      }
      if (meta.result) game.setHeader('Result', meta.result)
    }
    return game.pgn()
  },
  position: (state) => state.game.fen(),
  turn: (state) => state.game.turn(),
  history: (state) => historyOf(state.game),
  play(state, move) {
    const game = clone(state.game)
    const before = knownMoves(state.game)
    let played: Move
    try {
      played = game.move(parseUci(move))
    } catch {
      return null
    }
    known.set(game, { records: [...before.records, toRecord(played)], san: [...before.san, played.san] })
    return { game }
  },
  end: (state, userSide) => detectGameEnd(state.game, userSide),

  readGame: readChessGame,
  playAt(position, move) {
    const played = playUci(position, move)
    if (!played) return null
    const after = new Chess(played.fen)
    return {
      position: played.fen,
      label: formatSan(played.move.san),
      turn: after.turn(),
      ended: after.isCheckmate() ? 'win' : after.isDraw() ? 'draw' : null,
    }
  },
  moveLabel: (position, move) => formatSan(uciToSan(position, move)),
  moveTitle: (ply, side, label) => `${Math.floor(ply / 2) + 1}${side === 'w' ? '.' : '...'} ${label}`,

  engine: chessEngine,
  winPercent,
  explain: (input) =>
    explainMove({
      fenBefore: input.before,
      playedUci: input.move,
      userColor: input.userSide,
      best: input.best,
      reply: input.reply,
      winBefore: input.winBefore,
      winAfter: input.winAfter,
      endedInDraw: input.endedInDraw,
    }),
  describeMove: describeChessMove,
  lessons: [...CHESS_LESSONS, ...CHESS_LESSONS_2],
  phaseOf: (position) => chessPhase(position),
  statusNote: (state, userSide) =>
    state.game.turn() === userSide && state.game.inCheck() ? 'Şah! Şahını tehlikeden kurtarman gerekiyor.' : null,
  coachQuestions(state) {
    const history = knownMoves(state.game).san
    return coachQuestions(history.length > 0 ? formatSan(history[history.length - 1]) : null)
  },
  coachTip: (state) => chessCoachTip(state.game.fen()),
  coachWarning(state, move) {
    const fen = state.game.fen()
    const warning = shouldWarn(fen, parseUci(move))
    if (!warning) return null
    const after = playUci(fen, move)
    if (!after) return null
    const opponent: Side = state.game.turn() === 'w' ? 'b' : 'w'
    const square = warning.piece.square
    return {
      text: hangingWarningText(warning),
      marks: [
        { kind: 'danger', square },
        ...attackersOf(after.fen, square, opponent).map((from) => ({ kind: 'threat' as const, move: `${from}${square}` })),
      ],
    }
  },
  puzzleHint(puzzle) {
    const from = puzzle.bestMove.slice(0, 2)
    const piece = playUci(puzzle.position, puzzle.bestMove)?.move.piece ?? 'p'
    return {
      text: `İpucu: ${from} karesindeki ${PIECE_WORDS[piece].yoursWith} oyna. (Yeşil çerçeveli kare)`,
      marks: [{ kind: 'hint', square: from }],
    }
  },

  Board: ChessBoardView,
  ImportPanel,
}
