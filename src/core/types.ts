import type { Lesson } from './lessons'
import type { ComponentType } from 'react'

export type GameId = 'chess' | 'mangala' | 'go' | 'dama' | 'reversi'

/** 'w' = the side that moves first (white in chess, the starting player in mangala). */
export type Side = 'w' | 'b'
export type SideChoice = Side | 'random'

export const opposite = (side: Side): Side => (side === 'w' ? 'b' : 'w')

/**
 * Engine score from the point of view of the side to move.
 * "cp" is a game-specific advantage number, "mate" a forced win (+) or loss (-) in N moves.
 */
export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; value: number }

/** One engine line: its score and the best continuation (move codes). */
export interface EngineLine {
  score: Score
  pv: string[]
}

export interface GameEngine {
  start(): Promise<void>
  newGame(): Promise<void>
  /** Best lines for the side to move, best first. */
  analyze(position: string, options: { depth?: number; multiPV?: number }): Promise<EngineLine[]>
  /** A move for the computer at the given difficulty level. */
  chooseMove(position: string, levelId: number): Promise<string | null>
  /** Stops the running search and drops queued ones. */
  cancelAll(): void
}

export interface Level {
  id: number
  name: string
  description: string
}

export type Outcome = 'win' | 'loss' | 'draw'

export interface GameEnd {
  /** "1-0" = first side won, "0-1" = second side won. */
  result: '1-0' | '0-1' | '1/2-1/2'
  outcome: Outcome
  title: string
  detail: string
  /** Shown on the final board, e.g. the counted areas and dead stones in Go. */
  marks?: BoardMark[]
}

/** A move inside a recorded game. */
export interface MoveRecord {
  /** Machine-readable move code (UCI in chess, pit number in mangala). */
  code: string
  /** Human-readable move text shown to the user. */
  label: string
  side: Side
  before: string
  after: string
}

/** How a game ended, from the point of view of the side that made the last move. */
export type MoverResult = 'win' | 'loss' | 'draw'

export interface ReadGame {
  moves: MoveRecord[]
  /** For each position (0..moves.length): the result for the side that just moved, or null if the game goes on. */
  terminal: (MoverResult | null)[]
}

/** Result of playing one move on a bare position. */
export interface PlayedMove {
  position: string
  label: string
  /** Side to move in the resulting position. */
  turn: Side
  /** Set if the move ended the game: the result for the mover. */
  ended: MoverResult | null
}

/** 'territory' and 'dead' show the end-of-game count in games scored by area (Go). */
export type BoardMarkKind = 'played' | 'best' | 'threat' | 'danger' | 'hint' | 'territory' | 'dead'

/** Something to highlight on a board: a move (arrow) or a square/pit. */
export interface BoardMark {
  kind: BoardMarkKind
  move?: string
  square?: string
  /** Owner of a 'territory' point. */
  side?: Side
}

export interface BoardProps {
  position: string
  /** The side shown at the bottom (the user). */
  perspective: Side
  /** Whether the user may move now (it must also be the side to move). */
  interactive: boolean
  onMove?: (move: string) => boolean
  lastMove?: string | null
  marks?: BoardMark[]
  id?: string
  /** End-of-game counting (Go): called when the user taps a point to mark stones dead or alive. */
  onMark?: (square: string) => void
}

export interface ExplainInput {
  before: string
  move: string
  userSide: Side
  /** Engine's best line before the move (user to move). */
  best: { pv: string[]; score: Score } | null
  /** Engine's best line in the position after the move, from that position's side to move. Null if the game ended. */
  reply: { pv: string[]; score: Score } | null
  winBefore: number
  winAfter: number
  endedInDraw?: boolean
}

/**
 * Separate engine instances, so they never wait for or cancel each other: "play" picks the computer's
 * moves, "analysis" analyses whole games in the background, "coach" answers the live coach and puzzle checks.
 */
export type EngineRole = 'play' | 'analysis' | 'coach'

/** Part of the game a position belongs to; puzzles are grouped by it. */
export type GamePhase = 'opening' | 'middlegame' | 'endgame'

export const PHASE_LABELS: Record<GamePhase, string> = {
  opening: 'Oyun başı',
  middlegame: 'Oyun ortası',
  endgame: 'Oyun sonu',
}

export interface Explanation {
  text: string
  type: string
}

/** See GameModule.describeMove. */
export interface MoveFacts {
  /** One short sentence ("Atı alıyor ve şah çekiyor."), or null when the move does nothing notable. */
  text: string | null
  /** The only legal move. */
  forced?: boolean
  /** Gives material away on purpose (a "Parlak" move when it holds up). */
  sacrifice?: boolean
  /** A natural move anyone would play, such as taking back a piece: never called "Harika". */
  obvious?: boolean
}

export interface CoachWarning {
  text: string
  marks: BoardMark[]
  /** What the marks mean, when they are not the usual red danger marks. */
  note?: string
}

export interface RecordMeta {
  names?: Record<Side, string>
  result?: string
  date?: Date
}

export interface PuzzleHint {
  text: string
  marks: BoardMark[]
}

/**
 * Everything the shared screens (play, analysis, puzzles, progress) need from a game.
 * `S` is the game's own in-memory state; screens only pass it back to the module.
 * Members use method syntax so a GameModule<ChessState> fits where GameModule<unknown> is expected.
 */
export interface GameModule<S = unknown> {
  id: GameId
  /** URL segment: "satranc", "mangala". */
  slug: string
  name: string
  icon: string
  /** Name of the computer opponent in saved games. */
  engineName: string
  sideLabels: Record<Side, string>
  sideChoiceTitle: string
  sideChoices: { value: SideChoice; label: string }[]
  levels: Level[]
  defaultLevel: number
  analysisDepth: number
  /** Error categories, most fundamental first; must include "other". `tip` says what to watch out for. */
  errorTypes: { id: string; label: string; tip?: string }[]
  /** One short piece of advice per part of the game, for the player summary. */
  /** Short advice for each part of the game; one is picked each time, so "Dikkat et" changes. */
  phaseTips?: Record<GamePhase, string[]>
  /** 'pairs' = two moves per row (chess), 'list' = one move per row (games with extra turns). */
  moveListLayout: 'pairs' | 'list'
  warningLabel: { title: string; description: string }
  /** Minimum time before the computer's move appears (lets move animations finish). */
  computerDelayMs: number

  /** A fresh game; `boardSize` for games with a choice of boards (Go). */
  newState(options?: { boardSize?: number }): S
  /**
   * Whether the engine can judge the moves of a game in this position (Go: only on the 9×9 board).
   * Without it a game is played and saved with its result points, but its moves are not analysed,
   * no advantage bar is shown and no puzzles are made from it. Missing means always.
   */
  canAnalyse?(position: string): boolean
  /** Shown instead of the analysis for games the engine cannot judge. */
  noAnalysisNote?: string
  /** Board sizes to choose from (Go), the first one is the default. */
  boardSizes?: { value: number; label: string; note: string }[]
  stateFromRecord(record: string): S
  stateToRecord(state: S, meta?: RecordMeta): string
  position(state: S): string
  turn(state: S): Side
  history(state: S): MoveRecord[]
  play(state: S, move: string): S | null
  end(state: S, userSide: Side): GameEnd | null

  readGame(record: string): ReadGame
  playAt(position: string, move: string): PlayedMove | null
  moveLabel(position: string, move: string): string
  /** "12. ♘e5", "Hamle 7: 3. kuyu" */
  moveTitle(ply: number, side: Side, label: string): string

  engine(role: EngineRole): GameEngine
  winPercent(score: Score): number
  explain(input: ExplainInput): Explanation
  /** Extra status line for the user's turn ("Şah!", "Tekrar oynuyorsun"), or null. */
  statusNote(state: S, userSide: Side): string | null
  coachQuestions(state: S): string[]
  /** One short note shown in large text before each of the user's moves in learning mode (never names a move). */
  coachTip?(state: S): string
  /** Opening, middlegame or endgame, for grouping puzzles. `ply` is the number of moves played before the position. */
  phaseOf?(position: string, ply: number): GamePhase
  coachWarning(state: S, move: string): CoachWarning | null
  puzzleHint(puzzle: { position: string; bestMove: string; playedMove: string; errorType: string }): PuzzleHint

  Board: ComponentType<BoardProps>
  /** Short lessons teaching the basics, in order. */
  lessons?: Lesson[]
  /** Optional extra ways to add games for analysis (PGN, online accounts). */
  ImportPanel?: ComponentType

  /**
   * What a move does, in a few words true for either player ("Atı alıyor.", "Dama oluyor."), for the
   * move-by-move explanations of the analysis. Also says whether the move was the only legal one,
   * gives material away on purpose, or is an obvious reply (taking a piece back).
   */
  describeMove?(position: string, move: string): MoveFacts | null

  /** Boards much wider than tall (Mangala): the board gets the full page width, the panel goes below. */
  wideBoard?: boolean
  /** How many stones a move puts down one by one (Mangala sowing), so its sound clicks once per stone. */
  stonesPlaced?(position: string, move: string): number
  /** Colours of the players' dots when they differ from the side ids (in Go the first player is black). */
  sideColors?: Record<Side, 'w' | 'b'>
  /** Short rules for beginners, shown before a game. */
  rules?: { title: string; items: string[] }
  /** Games where a player may pass instead of moving (Go). */
  pass?: {
    move: string
    /** Explains what passing does in this position, shown before the user confirms. */
    confirm(state: S): string
  }
  /**
   * For engines whose numbers at the root are optimistic for the side to move (Monte Carlo search):
   * the position after the best move is searched as well, so the best and the played move are
   * compared by the same kind of search, in analysis and in puzzle answers.
   */
  compareAfterBest?: boolean
  /** Bump when this game's analysis or explanations change: its stored analyses are redone. */
  analysisRevision?: number
  /** Games scored by area (Go): the likely territory now, for the "Alanı göster" button in learning mode. */
  territory?(state: S): { marks: BoardMark[]; text: string }
  /** Games counted at the end (Go): the user may correct which stones count as dead. */
  scoring?: {
    /** Marks the stones at `square` dead or alive again; null if there is nothing to toggle. */
    toggle(state: S, square: string): S | null
    help: string
  }
}
