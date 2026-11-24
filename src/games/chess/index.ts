import { Chess } from 'chess.js'
import type { GameModule, MoveRecord, ReadGame, Side } from '../../core/types'
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

function clone(game: Chess): Chess {
  if (game.history().length === 0) return new Chess(game.fen())
  const copy = new Chess()
  copy.loadPgn(game.pgn())
  return copy
}

function historyOf(game: Chess): MoveRecord[] {
  return game.history({ verbose: true }).map((move) => ({
    code: move.lan,
    label: formatSan(move.san),
    side: move.color,
    before: move.before,
    after: move.after,
  }))
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
    try {
      game.move(parseUci(move))
    } catch {
      return null
    }
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
    const history = state.game.history()
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
