import { listGames, listPuzzles, loadGamesStamp, loadLessonProgress, loadSummaryCache, saveSummaryCache } from '../../db/db'
import { duePuzzles } from '../puzzles/leitner'
import type { GameId, GameModule } from '../types'
import { playerSummary, type PlayerSummary } from './player'

/**
 * The home screen's figures, kept so that opening the home screen stays light. Working out the
 * player summary means reading every saved game with its analysis, so it is done once when a game
 * is saved or analysed and stored with a stamp; until the games change again the stored summary is
 * used as it is (also after the app is reopened). Puzzles due and lessons finished are cheap and
 * read every time.
 */

/** Bump when the player summary changes shape or meaning: stored summaries are then worked out again. */
export const SUMMARY_VERSION = 2

export interface Progress {
  gameId: GameId
  summary: PlayerSummary
  due: number
  lessonsDone: number
}

interface StoredSummary {
  version: number
  stamp: string
  summary: PlayerSummary
}

const memory = new Map<GameId, Progress>()

/** What the home screen showed last time in this visit, so coming back to it is instant. */
export const cachedProgress = (gameId: GameId): Progress | null => memory.get(gameId) ?? null

/** Works out one game's player summary from all its saved games and stores it. */
export async function refreshSummary(game: GameModule): Promise<PlayerSummary> {
  const stamp = (await loadGamesStamp(game.id)) ?? ''
  const summary = playerSummary(await listGames(game.id), game)
  await saveSummaryCache(game.id, { version: SUMMARY_VERSION, stamp, summary } satisfies StoredSummary)
  return summary
}

/** The home screen's figures for one game: the stored summary when no game changed since, otherwise worked out once. */
export async function loadProgress(game: GameModule): Promise<Progress> {
  const [stamp, saved, puzzles, lessons] = await Promise.all([
    loadGamesStamp(game.id),
    loadSummaryCache(game.id) as Promise<StoredSummary | undefined>,
    listPuzzles(game.id),
    loadLessonProgress(game.id),
  ])
  const fresh = saved && saved.version === SUMMARY_VERSION && saved.stamp === (stamp ?? '')
  const summary = fresh ? saved.summary : await refreshSummary(game)
  const progress: Progress = { gameId: game.id, summary, due: duePuzzles(puzzles, Date.now()).length, lessonsDone: lessons.length }
  memory.set(game.id, progress)
  return progress
}
