import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import {
  migrateAttemptV4,
  migrateGameV4,
  migratePuzzleV4,
  migrateSavedPlayV4,
  migrateSettingsV4,
  sanListToPgn,
} from './migrate'
import { chessModule } from '../games/chess'

describe('migration from the chess-only app (v3 -> v4)', () => {
  it('converts the saved unfinished game into a replayable record', () => {
    // Same shape as a real unfinished game stored by the old version.
    const old = {
      moves: ['e4', 'e6', 'd4', 'Nc6', 'Be3', 'd5', 'Nc3', 'Nge7', 'Nf3', 'a6', 'a3', 'dxe4', 'Nxe4', 'Nf5', 'Bg5', 'Be7'],
      userColor: 'w',
      level: 5,
      startedAt: 1795068719075,
    }
    const play = migrateSavedPlayV4(old)
    expect(play).toMatchObject({ userSide: 'w', level: 5, startedAt: 1795068719075 })
    expect(play.record.startsWith('1. e4 e6 2. d4 Nc6')).toBe(true)

    const state = chessModule.stateFromRecord(play.record)
    expect(chessModule.history(state)).toHaveLength(16)
    const expected = new Chess()
    for (const move of old.moves) expected.move(move)
    expect(chessModule.position(state)).toBe(expected.fen())
  })

  it('splits the old settings into app and chess settings', () => {
    expect(
      migrateSettingsV4({ level: 5, colorChoice: 'random', coachMode: true, hangingWarning: false, chesscomUsername: 'abc' }),
    ).toEqual({
      app: { lastGame: 'chess', chesscomUsername: 'abc' },
      chess: { level: 5, sideChoice: 'random', mode: 'learn', coachMode: true, dangerWarning: false, liveAnalysis: true },
    })
    expect(migrateSettingsV4(undefined).chess).toEqual({
      level: 3,
      sideChoice: 'w',
      mode: 'learn',
      coachMode: true,
      dangerWarning: true,
      liveAnalysis: true,
    })
    expect(migrateSettingsV4({ coachMode: false }).chess.mode).toBe('play')
  })

  it('renames game fields and marks the game as chess', () => {
    const game = migrateGameV4({
      id: 'g',
      createdAt: 1,
      source: 'pgn',
      pgn: '1. e4 *',
      userColor: 'b',
      white: 'A',
      black: 'B',
      result: '*',
    })
    expect(game).toEqual({
      id: 'g',
      createdAt: 1,
      source: 'pgn',
      gameType: 'chess',
      record: '1. e4 *',
      userSide: 'b',
      names: { w: 'A', b: 'B' },
      result: '*',
    })
  })

  it('renames puzzle fields and keeps the review progress', () => {
    const puzzle = migratePuzzleV4({
      id: 'g:8',
      gameId: 'g',
      ply: 8,
      fen: 'fen',
      prevUci: 'd8g5',
      userColor: 'w',
      playedUci: 'e5f7',
      playedSan: 'Nxf7',
      bestUci: 'c4f7',
      bestSan: 'Bxf7+',
      candidates: [{ uci: 'c4f7', san: 'Bxf7+', win: 43.3 }],
      explanation: 'x',
      errorType: 'hung_piece',
      classification: 'blunder',
      createdAt: 5,
      box: 3,
      dueAt: 99,
    })
    expect(puzzle).toMatchObject({
      gameType: 'chess',
      position: 'fen',
      prevMove: 'd8g5',
      userSide: 'w',
      playedMove: 'e5f7',
      playedLabel: '♘xf7',
      bestMove: 'c4f7',
      bestLabel: '♗xf7+',
      candidates: [{ move: 'c4f7', label: '♗xf7+', win: 43.3 }],
      box: 3,
      dueAt: 99,
    })
    expect(puzzle).not.toHaveProperty('fen')
  })

  it('marks attempts as chess', () => {
    expect(migrateAttemptV4({ id: 1, puzzleId: 'p', at: 2, result: 'hint' })).toEqual({
      id: 1,
      puzzleId: 'p',
      at: 2,
      result: 'hint',
      gameType: 'chess',
    })
  })

  it('writes SAN lists as numbered PGN move text', () => {
    expect(sanListToPgn(['e4', 'e5', 'Nf3'])).toBe('1. e4 e5 2. Nf3')
    expect(sanListToPgn([])).toBe('')
  })
})
