import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb'
import type { GameId } from '../core/types'
import { BACKUP_APP, attemptKey, newerPuzzle, parseBackup, type Backup } from './backup'
import { migrateAttemptV4, migrateGameV4, migratePuzzleV4, migrateSavedPlayV4, migrateSettingsV4 } from './migrate'
import {
  DEFAULT_APP_SETTINGS,
  defaultGameSettings,
  type AppSettings,
  type AttemptRecord,
  type GameRecord,
  type GameSettings,
  type MineStats,
  type PuzzleRecord,
  type SavedPlay,
} from './types'

interface KeyValue {
  key: string
  value: unknown
}

interface CoachDB extends DBSchema {
  games: { key: string; value: GameRecord; indexes: { createdAt: number } }
  puzzles: { key: string; value: PuzzleRecord; indexes: { dueAt: number; gameId: string } }
  attempts: { key: number; value: AttemptRecord; indexes: { at: number } }
  kv: { key: string; value: KeyValue }
}

// The name dates back to the chess-only version; keeping it keeps existing data.
const DB_NAME = 'satranc-koc'
const DB_VERSION = 4

let dbPromise: Promise<IDBPDatabase<CoachDB>> | null = null

export function getDB(): Promise<IDBPDatabase<CoachDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CoachDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const games = db.createObjectStore('games', { keyPath: 'id' })
          games.createIndex('createdAt', 'createdAt')
          db.createObjectStore('kv', { keyPath: 'key' })
        }
        if (oldVersion < 2) {
          const puzzles = db.createObjectStore('puzzles', { keyPath: 'id' })
          puzzles.createIndex('dueAt', 'dueAt')
          puzzles.createIndex('gameId', 'gameId')
        }
        if (oldVersion < 3) {
          const attempts = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true })
          attempts.createIndex('at', 'at')
        }
        if (oldVersion >= 1 && oldVersion < 4) {
          // Requests are chained inside the upgrade transaction, which stays open until they finish.
          void migrateToV4(transaction)
        }
      },
    })
  }
  return dbPromise
}

type UpgradeTx = IDBPTransaction<CoachDB, StoreNames<CoachDB>[], 'versionchange'>

async function migrateToV4(tx: UpgradeTx) {
  const convert = async <N extends 'games' | 'puzzles' | 'attempts'>(name: N, fn: (old: Record<string, unknown>) => unknown) => {
    let cursor = await tx.objectStore(name).openCursor()
    while (cursor) {
      const value = cursor.value as unknown as Record<string, unknown>
      if (!('gameType' in value)) await cursor.update(fn(value) as CoachDB[N]['value'])
      cursor = await cursor.continue()
    }
  }
  await convert('games', migrateGameV4)
  await convert('puzzles', migratePuzzleV4)
  await convert('attempts', migrateAttemptV4)

  const kv = tx.objectStore('kv')
  const oldSettings = await kv.get('settings')
  if (oldSettings) {
    const { app, chess } = migrateSettingsV4(oldSettings.value as Record<string, unknown>)
    await kv.put({ key: 'settings:app', value: app })
    await kv.put({ key: 'settings:chess', value: chess })
    await kv.delete('settings')
  }
  const oldPlay = await kv.get('currentGame')
  if (oldPlay) {
    await kv.put({ key: 'currentGame:chess', value: migrateSavedPlayV4(oldPlay.value as Record<string, unknown>) })
    await kv.delete('currentGame')
  }
}

// ---------- key/value ----------

async function getValue<T>(key: string): Promise<T | undefined> {
  const row = await (await getDB()).get('kv', key)
  return row?.value as T | undefined
}

async function setValue(key: string, value: unknown): Promise<void> {
  await (await getDB()).put('kv', { key, value })
}

async function deleteValue(key: string): Promise<void> {
  await (await getDB()).delete('kv', key)
}

/** Mayın Tarlası: the level played last and the results on each level. */
export async function loadMineStats(): Promise<MineStats> {
  return { level: 2, levels: {}, ...(await getValue<Partial<MineStats>>('minesweeper:stats')) }
}

export const saveMineStats = (stats: MineStats) => setValue('minesweeper:stats', stats)

export async function loadAppSettings(): Promise<AppSettings> {
  return { ...DEFAULT_APP_SETTINGS, ...(await getValue<Partial<AppSettings>>('settings:app')) }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await setValue('settings:app', settings)
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await loadAppSettings()), ...patch }
  await saveAppSettings(next)
  return next
}

export async function loadGameSettings(game: GameId, defaultLevel: number): Promise<GameSettings> {
  return { ...defaultGameSettings(defaultLevel), ...(await getValue<Partial<GameSettings>>(`settings:${game}`)) }
}

export async function saveGameSettings(game: GameId, settings: GameSettings): Promise<void> {
  await setValue(`settings:${game}`, settings)
}

export const loadSavedPlay = (game: GameId) => getValue<SavedPlay>(`currentGame:${game}`)
export const saveSavedPlay = (game: GameId, play: SavedPlay) => setValue(`currentGame:${game}`, play)
export const clearSavedPlay = (game: GameId) => deleteValue(`currentGame:${game}`)

// ---------- games ----------

/**
 * A stamp per game type that changes whenever one of its games is saved, so the stored player
 * summary (see core/stats/homeCache) is worked out again only after a change.
 */
const stampKey = (game: GameId) => `gamesStamp:${game}`
const newStamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
export const loadGamesStamp = (game: GameId) => getValue<string>(stampKey(game))
export const loadSummaryCache = (game: GameId) => getValue<unknown>(`summary:${game}`)
export const saveSummaryCache = (game: GameId, value: unknown) => setValue(`summary:${game}`, value)

export async function saveGame(game: GameRecord): Promise<void> {
  await (await getDB()).put('games', game)
  await setValue(stampKey(game.gameType), newStamp())
}

export async function getGame(id: string): Promise<GameRecord | undefined> {
  return (await getDB()).get('games', id)
}

/** Newest first, optionally only one game type. */
export async function listGames(gameType?: GameId): Promise<GameRecord[]> {
  const games = await (await getDB()).getAllFromIndex('games', 'createdAt')
  return games.reverse().filter((g) => !gameType || g.gameType === gameType)
}

export async function findGameByUrl(url: string): Promise<GameRecord | undefined> {
  const games = await (await getDB()).getAll('games')
  return games.find((game) => game.externalUrl === url)
}

// ---------- puzzles ----------

/**
 * Adds new puzzles to the bank. Puzzles that already exist (same game and move) get the fresh
 * explanation and answers but keep their review progress. Returns how many were new.
 */
export async function addPuzzles(puzzles: PuzzleRecord[]): Promise<number> {
  const tx = (await getDB()).transaction('puzzles', 'readwrite')
  let added = 0
  for (const puzzle of puzzles) {
    const existing = await tx.store.get(puzzle.id)
    if (existing) {
      await tx.store.put({
        ...puzzle,
        createdAt: existing.createdAt,
        box: existing.box,
        dueAt: existing.dueAt,
        lastReviewedAt: existing.lastReviewedAt,
      })
    } else {
      await tx.store.add(puzzle)
      added++
    }
  }
  await tx.done
  return added
}

export async function listPuzzles(gameType?: GameId): Promise<PuzzleRecord[]> {
  const puzzles = await (await getDB()).getAll('puzzles')
  return puzzles.filter((p) => !gameType || p.gameType === gameType)
}

export async function savePuzzle(puzzle: PuzzleRecord): Promise<void> {
  await (await getDB()).put('puzzles', puzzle)
}

// ---------- puzzle attempts ----------

export async function addAttempt(attempt: AttemptRecord): Promise<void> {
  await (await getDB()).add('attempts', attempt)
}

/** Most recent attempts first, optionally only one game type. */
export async function listRecentAttempts(limit: number, gameType?: GameId): Promise<AttemptRecord[]> {
  const attempts: AttemptRecord[] = []
  let cursor = await (await getDB()).transaction('attempts').store.index('at').openCursor(null, 'prev')
  while (cursor && attempts.length < limit) {
    if (!gameType || cursor.value.gameType === gameType) attempts.push(cursor.value)
    cursor = await cursor.continue()
  }
  return attempts
}

// ---------- lessons ----------

/** Ids of the lessons finished in a game. */
export async function loadLessonProgress(game: GameId): Promise<string[]> {
  return (await getValue<{ done: string[] }>(`lessons:${game}`))?.done ?? []
}

/** Marks a lesson finished; returns the updated list. */
export async function markLessonDone(game: GameId, lessonId: string): Promise<string[]> {
  const done = await loadLessonProgress(game)
  if (!done.includes(lessonId)) done.push(lessonId)
  await setValue(`lessons:${game}`, { done })
  return done
}

const lessonList = (value: unknown): string[] =>
  Array.isArray((value as { done?: unknown })?.done) ? (value as { done: unknown[] }).done.filter((id): id is string => typeof id === 'string') : []

// ---------- backup ----------

/** Everything stored on this device, for the "Yedekle" button. */
/**
 * Rows that belong to one device and never travel in a backup: the unfinished game (if it did, a game
 * finished or deleted here would come back from the Drive copy at the next sync, again and again) and
 * the stored home-screen summary with its stamp (worked out on each device from its own games).
 */
const deviceOnly = (key: string) => key.startsWith('currentGame:') || key.startsWith('gamesStamp:') || key.startsWith('summary:')

export async function exportBackup(): Promise<Backup> {
  const db = await getDB()
  const [games, puzzles, attempts, kv] = await Promise.all([db.getAll('games'), db.getAll('puzzles'), db.getAll('attempts'), db.getAll('kv')])
  return { app: BACKUP_APP, dbVersion: DB_VERSION, exportedAt: Date.now(), games, puzzles, attempts, kv: kv.filter((row) => !deviceOnly(row.key)) }
}

/** Reads a backup file's text; throws an Error with a message for the user. */
export const readBackup = (text: string) => parseBackup(text, DB_VERSION)

/**
 * Adds a backup to what is already here; nothing on this device is deleted. Games are matched by id,
 * puzzles keep the most recently reviewed copy, attempts are not doubled, and settings already set
 * here stay. Returns how many games and puzzles were new.
 */
export async function importBackup(backup: Backup): Promise<{ games: number; puzzles: number }> {
  const tx = (await getDB()).transaction(['games', 'puzzles', 'attempts', 'kv'], 'readwrite')
  let games = 0
  let puzzles = 0
  const changedTypes = new Set<GameId>()
  const gameStore = tx.objectStore('games')
  for (const game of backup.games) {
    const existing = await gameStore.get(game.id)
    if (!existing) games++
    // Keep the copy with the newer analysis (another device may have analysed it later, or not yet).
    if (existing && (existing.analysis?.analyzedAt ?? 0) >= (game.analysis?.analyzedAt ?? 0)) continue
    await gameStore.put(game)
    changedTypes.add(game.gameType)
  }
  const puzzleStore = tx.objectStore('puzzles')
  for (const puzzle of backup.puzzles) {
    const existing = await puzzleStore.get(puzzle.id)
    if (!existing) puzzles++
    await puzzleStore.put(existing ? newerPuzzle(existing, puzzle) : puzzle)
  }
  const attemptStore = tx.objectStore('attempts')
  const known = new Set((await attemptStore.getAll()).map(attemptKey))
  for (const attempt of backup.attempts) {
    if (known.has(attemptKey(attempt))) continue
    known.add(attemptKey(attempt))
    const { id: _id, ...rest } = attempt
    await attemptStore.add(rest)
  }
  const kvStore = tx.objectStore('kv')
  for (const row of backup.kv) {
    // Older backups (and the Drive copy) may still hold an unfinished game: it is not brought back.
    if (deviceOnly(row.key)) continue
    const existing = await kvStore.get(row.key)
    if (!existing) await kvStore.put(row)
    else if (row.key.startsWith('lessons:')) {
      // Lessons finished on either device count as finished.
      const done = new Set([...lessonList(existing.value), ...lessonList(row.value)])
      await kvStore.put({ key: row.key, value: { done: [...done] } })
    }
  }
  await tx.done
  for (const type of changedTypes) await setValue(stampKey(type), newStamp())
  return { games, puzzles }
}
