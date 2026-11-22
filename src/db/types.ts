import type { CandidateMove, GameAnalysis } from '../core/analysis/types'
import type { GamePhase, GameId, Side, SideChoice } from '../core/types'

export type GameSource = 'play' | 'pgn' | 'chesscom' | 'sgf'

/** learn = coach reminders, warnings and take-backs on; play = no help, like a real game. */
export type PlayMode = 'learn' | 'play'

/** How much the coach helped during a game (learning mode). */
export interface CoachStats {
  /** Warnings shown before a risky move. */
  warnings: number
  /** Times the user took the risky move back after a warning. */
  takebacks: number
}

export interface GameRecord {
  id: string
  gameType: GameId
  createdAt: number
  /** When the game was played, if known (e.g. Chess.com end time). */
  playedAt?: number
  source: GameSource
  /** The game in the module's own text format (PGN for chess). */
  record: string
  userSide: Side
  names: Record<Side, string>
  /** "1-0", "0-1", "1/2-1/2" or "*" */
  result: string
  /** Computer level when the game was played in the app. */
  level?: number
  /** Online game URL, used to avoid importing the same game twice. */
  externalUrl?: string
  /** Mode the game was played in (games played in the app). Imported games have none. */
  mode?: PlayMode
  coachStats?: CoachStats
  analysis?: GameAnalysis
}

export interface PuzzleRecord {
  /** `${gameId}:${ply}` so re-analysing a game never duplicates puzzles. */
  id: string
  gameType: GameId
  gameId: string
  ply: number
  /** Position where the user went wrong (user to move). */
  position: string
  /** The opponent's move that led to this position (highlighted on the board). */
  prevMove?: string
  userSide: Side
  playedMove: string
  playedLabel: string
  bestMove: string
  bestLabel: string
  /** Moves accepted as correct: the best move plus near-equal alternatives. */
  candidates: CandidateMove[]
  explanation: string
  errorType: string
  classification: 'mistake' | 'blunder'
  /** Opening, middlegame or endgame (missing in puzzles saved before this was added). */
  phase?: GamePhase
  createdAt: number
  /** Leitner box 1-5. */
  box: number
  /** Timestamp (ms) when the puzzle is due again. */
  dueAt: number
  lastReviewedAt?: number
}

/** correct = solved on the first try, hint = solved after the hint, failed = solution shown. */
export type AttemptResult = 'correct' | 'hint' | 'failed'

export interface AttemptRecord {
  id?: number
  gameType: GameId
  puzzleId: string
  at: number
  result: AttemptResult
}

/** Settings kept separately for each game. */
export interface GameSettings {
  level: number
  sideChoice: SideChoice
  /** Last chosen mode; the play screen asks again before every game with this preselected. */
  mode: PlayMode
  /** Learning mode: reminder questions before each move. */
  coachMode: boolean
  /** Learning mode: the "you are about to give something away" warning with take-back. */
  dangerWarning: boolean
  /** Learning mode: each move classified and explained as it is played, and the advantage bar. */
  liveAnalysis: boolean
}

export interface AppSettings {
  lastGame: GameId
  chesscomUsername: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = { lastGame: 'chess', chesscomUsername: '' }

export function defaultGameSettings(defaultLevel: number): GameSettings {
  return { level: defaultLevel, sideChoice: 'w', mode: 'learn', coachMode: true, dangerWarning: true, liveAnalysis: true }
}

/** A game in progress, saved after every move so a page refresh does not lose it. */
export interface SavedPlay {
  record: string
  userSide: Side
  level: number
  startedAt: number
  /** Missing in games saved before modes existed: those had the coach on, so they count as learning. */
  mode?: PlayMode
  coachStats?: CoachStats
}
