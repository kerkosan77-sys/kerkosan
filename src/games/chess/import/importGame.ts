import { newId } from '../../../core/records'
import type { Side } from '../../../core/types'
import { findGameByUrl, saveGame } from '../../../db/db'
import type { GameRecord } from '../../../db/types'
import type { ChessComGame } from './chesscom'
import { parsePgn, type ParsedPgn } from './pgn'

/** Saves a pasted PGN game and returns its id. */
export async function importPgnGame(parsed: ParsedPgn, userSide: Side): Promise<string> {
  const game: GameRecord = {
    id: newId(),
    gameType: 'chess',
    createdAt: Date.now(),
    source: 'pgn',
    record: parsed.pgn,
    userSide,
    names: { w: parsed.white, b: parsed.black },
    result: parsed.result,
  }
  await saveGame(game)
  return game.id
}

/** Saves a Chess.com game (or reuses it if it was imported before) and returns its id. */
export async function importChessComGame(source: ChessComGame): Promise<string> {
  const existing = await findGameByUrl(source.url)
  if (existing) return existing.id
  const parsed = parsePgn(source.pgn)
  const game: GameRecord = {
    id: newId(),
    gameType: 'chess',
    createdAt: Date.now(),
    playedAt: source.endTime ? source.endTime * 1000 : undefined,
    source: 'chesscom',
    record: parsed.pgn,
    userSide: source.userColor,
    names: { w: source.white, b: source.black },
    result: parsed.result,
    externalUrl: source.url,
  }
  await saveGame(game)
  return game.id
}
