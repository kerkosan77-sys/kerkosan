/**
 * Data written by the chess-only app (database version 3 and earlier) converted to
 * the multi-game format (version 4). Pure functions so they can be unit tested.
 */
import { formatSan } from '../games/chess/logic/pieces'
import type { AppSettings, AttemptRecord, GameRecord, GameSettings, PuzzleRecord, SavedPlay } from './types'

type Old = Record<string, unknown>

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const side = (value: unknown): 'w' | 'b' => (value === 'b' ? 'b' : 'w')

export function migrateGameV4(old: Old): GameRecord {
  const { pgn, userColor, white, black, ...rest } = old
  return {
    ...(rest as unknown as GameRecord),
    gameType: 'chess',
    record: str(pgn),
    userSide: side(userColor),
    names: { w: str(white, 'Beyaz'), b: str(black, 'Siyah') },
  }
}

interface OldCandidate {
  uci?: string
  san?: string
  win?: number
}

export function migratePuzzleV4(old: Old): PuzzleRecord {
  const { fen, prevUci, userColor, playedUci, playedSan, bestUci, bestSan, candidates, ...rest } = old
  const migrated: PuzzleRecord = {
    ...(rest as unknown as PuzzleRecord),
    gameType: 'chess',
    position: str(fen),
    userSide: side(userColor),
    playedMove: str(playedUci),
    // Old puzzles stored plain SAN ("Nxf7"); labels now carry piece symbols ("♘xf7").
    playedLabel: formatSan(str(playedSan)),
    bestMove: str(bestUci),
    bestLabel: formatSan(str(bestSan)),
    candidates: ((candidates as OldCandidate[] | undefined) ?? []).map((c) => ({
      move: str(c.uci),
      label: formatSan(str(c.san)),
      win: typeof c.win === 'number' ? c.win : 50,
    })),
  }
  if (typeof prevUci === 'string') migrated.prevMove = prevUci
  return migrated
}

export function migrateAttemptV4(old: Old): AttemptRecord {
  return { ...(old as unknown as AttemptRecord), gameType: 'chess' }
}

export function migrateSettingsV4(old: Old | undefined): { app: AppSettings; chess: GameSettings } {
  const value = old ?? {}
  return {
    app: { lastGame: 'chess', chesscomUsername: str(value.chesscomUsername) },
    chess: {
      level: typeof value.level === 'number' ? value.level : 3,
      sideChoice: value.colorChoice === 'b' || value.colorChoice === 'random' ? value.colorChoice : 'w',
      // A coach that was switched off means the user preferred to play without help.
      mode: value.coachMode === false ? 'play' : 'learn',
      coachMode: value.coachMode !== false,
      dangerWarning: value.hangingWarning !== false,
      liveAnalysis: true,
    },
  }
}

/** ["e4", "e5", "Nf3"] -> "1. e4 e5 2. Nf3" */
export function sanListToPgn(moves: string[]): string {
  const parts: string[] = []
  moves.forEach((san, i) => {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`)
    parts.push(san)
  })
  return parts.join(' ')
}

export function migrateSavedPlayV4(old: Old): SavedPlay {
  const moves = Array.isArray(old.moves) ? (old.moves as unknown[]).filter((m): m is string => typeof m === 'string') : []
  return {
    record: sanListToPgn(moves),
    userSide: side(old.userColor),
    level: typeof old.level === 'number' ? old.level : 3,
    startedAt: typeof old.startedAt === 'number' ? old.startedAt : Date.now(),
  }
}
