import type { AttemptRecord, GameRecord, PuzzleRecord } from './types'

/** Marks a file as a backup of this app. */
export const BACKUP_APP = 'akil-oyunlari-kocu'

export interface BackupKeyValue {
  key: string
  value: unknown
}

/** Everything the app stores, as one JSON file. */
export interface Backup {
  app: typeof BACKUP_APP
  /** Database version the records were written with. */
  dbVersion: number
  exportedAt: number
  games: GameRecord[]
  puzzles: PuzzleRecord[]
  attempts: AttemptRecord[]
  kv: BackupKeyValue[]
}

const NOT_A_BACKUP = 'Bu dosya bir yedek değil. Uygulamadaki "Yedekle" düğmesiyle aldığın .json dosyasını seç.'

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const hasStringKey = (field: string) => (value: unknown) => isObject(value) && typeof value[field] === 'string' && value[field] !== ''

/** Reads a backup file; throws an Error with a message for the user when it is not usable. */
export function parseBackup(text: string, currentDbVersion: number): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(NOT_A_BACKUP)
  }
  if (!isObject(data) || data.app !== BACKUP_APP || typeof data.dbVersion !== 'number') throw new Error(NOT_A_BACKUP)
  if (data.dbVersion > currentDbVersion) {
    throw new Error('Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Önce uygulamayı güncelle.')
  }
  const lists = ['games', 'puzzles', 'attempts', 'kv'] as const
  if (!lists.every((name) => Array.isArray(data[name]))) throw new Error(NOT_A_BACKUP)
  const games = data.games as unknown[]
  const puzzles = data.puzzles as unknown[]
  const attempts = data.attempts as unknown[]
  const kv = data.kv as unknown[]
  const valid =
    games.every(hasStringKey('id')) &&
    puzzles.every(hasStringKey('id')) &&
    kv.every(hasStringKey('key')) &&
    attempts.every((a) => hasStringKey('puzzleId')(a) && typeof (a as Record<string, unknown>).at === 'number')
  if (!valid) throw new Error('Yedek dosyası bozuk görünüyor, içindeki kayıtlar okunamadı.')
  return data as unknown as Backup
}

/** "akil-oyunlari-yedek-2026-11-20.json" */
export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `akil-oyunlari-yedek-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

/** Same attempt in two files: same puzzle at the same moment. */
export const attemptKey = (attempt: Pick<AttemptRecord, 'puzzleId' | 'at'>) => `${attempt.puzzleId}|${attempt.at}`

/**
 * Which copy of a puzzle to keep when both this device and the backup have it: the one reviewed
 * most recently, so spaced-repetition progress is not lost.
 */
export function newerPuzzle(existing: PuzzleRecord, incoming: PuzzleRecord): PuzzleRecord {
  const time = (p: PuzzleRecord) => p.lastReviewedAt ?? p.createdAt
  return time(incoming) > time(existing) ? incoming : existing
}

export function restoredText(result: { games: number; puzzles: number }): string {
  if (result.games === 0 && result.puzzles === 0) return 'Yedek yüklendi. İçindeki oyunlar ve bulmacalar zaten buradaydı.'
  const parts = [result.games > 0 && `${result.games} oyun`, result.puzzles > 0 && `${result.puzzles} bulmaca`].filter(Boolean)
  return `Yedek yüklendi: ${parts.join(' ve ')} eklendi.`
}
