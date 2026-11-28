// The five games as the training games need them: the app's own rules and searches, nothing else.
import { Chess } from 'chess.js'
import { botMove, type BotStyle } from '../../src/core/humanize'
import type { Side } from '../../src/core/types'
import { chooseEngineMove } from '../../src/games/chess/engine/levels'
import * as dama from '../../src/games/dama/rules'
import { analyzeDama } from '../../src/games/dama/search'
import { chooseGoMove } from '../../src/games/go/bot'
import type { Rng } from '../../src/games/go/fastboard'
import * as go from '../../src/games/go/rules'
import * as mangala from '../../src/games/mangala/rules'
import { analyzePosition as analyzeMangala } from '../../src/games/mangala/search'
import * as reversi from '../../src/games/reversi/rules'
import { analyzeReversi } from '../../src/games/reversi/search'
import type { NodeStockfish } from './stockfish-node'

/** A bot: the BotStyle of the app's levels, plus the Go engine's random games and a time limit. */
export interface Bot extends BotStyle {
  playouts?: number
  maxMs?: number
}

/**
 * Time limits are scaled to a phone: this computer thinks about 3 times faster than a mid-range
 * phone, so a bot allowed 3 seconds on the phone gets 1 second here and reaches about the same depth.
 */
const PHONE_SPEED = 1 / 3
const phoneTime = (ms: number | undefined) => (ms ? Math.round(ms * PHONE_SPEED) : undefined)

export interface Players {
  /** Chess only: one engine per side, so neither sees the other's thinking. */
  engines?: Record<Side, NodeStockfish>
}

export interface TrainGame<S> {
  id: string
  /** Random moves at the start, so the same two bots do not play the same game again and again. */
  openingPlies: number
  /** Longer games are decided by adjudicate(). */
  maxPlies: number
  start(): S
  turn(state: S): Side
  legal(state: S): string[]
  play(state: S, move: string): S
  /** The winner of a finished game, 'draw', or null while it goes on. */
  result(state: S): Side | 'draw' | null
  adjudicate(state: S): Side | 'draw'
  choose(state: S, bot: Bot, players: Players, random: Rng): Promise<string>
  newGame?(players: Players): Promise<void>
}

const mangalaGame: TrainGame<mangala.Position> = {
  id: 'mangala',
  openingPlies: 2,
  maxPlies: 300,
  start: () => mangala.initialPosition(),
  turn: (p) => p.turn,
  legal: (p) => mangala.legalMoves(p).map(String),
  play: (p, move) => mangala.applyMove(p, Number(move))!.position,
  result: (p) => (mangala.isOver(p.pits) ? mangala.winner(p.pits) : null),
  adjudicate: (p) => mangala.winner(p.pits),
  choose: async (p, bot, _players, random) =>
    (await botMove(bot, mangalaGame.legal(p), (depth, multiPV) => analyzeMangala(mangala.encode(p), { depth, multiPV }), random))!,
}

interface DamaState {
  position: dama.DamaPosition
  keys: string[]
}

const damaGame: TrainGame<DamaState> = {
  id: 'dama',
  openingPlies: 2,
  maxPlies: 400,
  start: () => {
    const position = dama.initialPosition()
    return { position, keys: [dama.boardKey(position)] }
  },
  turn: (s) => s.position.turn,
  legal: (s) => dama.legalMoves(s.position).map(dama.moveCode),
  play: (s, move) => {
    const position = dama.applyMove(s.position, move)!.position
    return { position, keys: [...s.keys, dama.boardKey(position)] }
  },
  result: (s) => {
    const status = dama.statusOf(s.position)
    if (status) return status.winner
    const key = s.keys[s.keys.length - 1]
    return s.keys.filter((k) => k === key).length >= 3 ? 'draw' : null
  },
  adjudicate: () => 'draw',
  choose: async (s, bot, _players, random) =>
    (await botMove(
      bot,
      damaGame.legal(s),
      (depth, multiPV) => analyzeDama(dama.encode(s.position), { depth, multiPV, maxMs: phoneTime(bot.maxMs) }),
      random,
    ))!,
}

const reversiGame: TrainGame<reversi.ReversiPosition> = {
  id: 'reversi',
  openingPlies: 4,
  maxPlies: 80,
  start: () => reversi.initialPosition(),
  turn: (p) => p.turn,
  legal: (p) => reversi.legalMoves(p).map((m) => reversi.squareName(m.square)),
  play: (p, move) => reversi.applyMove(p, move)!.position,
  result: (p) => reversi.winnerOf(p),
  adjudicate: (p) => {
    const count = reversi.countsBySide(p.board)
    return count.w > count.b ? 'w' : count.b > count.w ? 'b' : 'draw'
  },
  choose: async (p, bot, _players, random) =>
    (await botMove(
      bot,
      reversiGame.legal(p),
      (depth, multiPV) => analyzeReversi(reversi.encode(p), { depth, multiPV, maxMs: phoneTime(bot.maxMs) }),
      random,
    ))!,
}

const goGame: TrainGame<go.GoPosition> = {
  id: 'go',
  openingPlies: 2,
  maxPlies: 250,
  start: () => go.initialPosition(9),
  turn: (p) => p.turn,
  legal: (p) => {
    // Opening moves: legal points that do not fill the mover's own eye.
    const fast = go.toFast(p)
    const color = fast.turn
    const moves: string[] = []
    for (let i = 0; i < fast.nEmpty; i++) {
      const point = fast.empties[i]
      if (!fast.isEyeLike(point, color) && fast.isLegal(point, color)) moves.push(go.coordOf(fast.plain(point), p.size))
    }
    return moves
  },
  play: (p, move) => go.applyMove(p, move)!.position,
  result: (p) => (p.passes >= 2 ? go.winnerOf(go.finalScore(p)) : null),
  adjudicate: (p) => go.winnerOf(go.finalScore(p)),
  choose: async (p, bot, _players, random) =>
    chooseGoMove(go.encode(p), { id: 0, name: '', description: '', playouts: bot.playouts ?? 1000, humanize: bot.humanize }, random),
}

const chessGame: TrainGame<Chess> = {
  id: 'chess',
  openingPlies: 2,
  maxPlies: 400,
  start: () => new Chess(),
  turn: (game) => game.turn(),
  legal: (game) => game.moves({ verbose: true }).map((m) => m.lan),
  play: (game, move) => {
    game.move(move)
    return game
  },
  result: (game) => (game.isCheckmate() ? (game.turn() === 'w' ? 'b' : 'w') : game.isDraw() || game.isStalemate() ? 'draw' : null),
  adjudicate: () => 'draw',
  newGame: async (players) => {
    await Promise.all([players.engines!.w.newGame(), players.engines!.b.newGame()])
  },
  choose: async (game, bot, players, random) =>
    (await chooseEngineMove(players.engines![game.turn()], game.fen(), bot, random)) ?? chessGame.legal(game)[0],
}

export const GAMES: Record<string, TrainGame<unknown>> = {
  mangala: mangalaGame as TrainGame<unknown>,
  dama: damaGame as TrainGame<unknown>,
  reversi: reversiGame as TrainGame<unknown>,
  go: goGame as TrainGame<unknown>,
  chess: chessGame as TrainGame<unknown>,
}
