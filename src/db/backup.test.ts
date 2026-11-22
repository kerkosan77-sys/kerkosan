import { describe, expect, it } from 'vitest'
import { BACKUP_APP, attemptKey, backupFileName, newerPuzzle, parseBackup, restoredText } from './backup'
import type { PuzzleRecord } from './types'

const backup = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    app: BACKUP_APP,
    dbVersion: 4,
    exportedAt: 1,
    games: [{ id: 'g1' }],
    puzzles: [{ id: 'g1:4' }],
    attempts: [{ puzzleId: 'g1:4', at: 5 }],
    kv: [{ key: 'settings:app', value: {} }],
    ...extra,
  })

describe('backups', () => {
  it('reads a backup made by the app', () => {
    const data = parseBackup(backup(), 4)
    expect(data.games).toHaveLength(1)
    expect(data.kv[0].key).toBe('settings:app')
  })

  it('refuses files that are not backups', () => {
    expect(() => parseBackup('not json', 4)).toThrow(/bir yedek değil/)
    expect(() => parseBackup('{"games":[]}', 4)).toThrow(/bir yedek değil/)
    expect(() => parseBackup(backup({ games: 'x' }), 4)).toThrow(/bir yedek değil/)
    expect(() => parseBackup(backup({ games: [{ name: 'no id' }] }), 4)).toThrow(/bozuk/)
    expect(() => parseBackup(backup({ attempts: [{ puzzleId: 'p' }] }), 4)).toThrow(/bozuk/)
    expect(() => parseBackup(backup({ dbVersion: 9 }), 4)).toThrow(/daha yeni bir sürümüyle/)
  })

  it('keeps the puzzle reviewed last and spots repeated attempts', () => {
    const puzzle = (lastReviewedAt?: number) => ({ id: 'p', createdAt: 10, lastReviewedAt }) as PuzzleRecord
    expect(newerPuzzle(puzzle(50), puzzle(40)).lastReviewedAt).toBe(50)
    expect(newerPuzzle(puzzle(), puzzle(40)).lastReviewedAt).toBe(40)
    expect(attemptKey({ puzzleId: 'p', at: 3 })).toBe(attemptKey({ puzzleId: 'p', at: 3 }))
  })

  it('names the file by date and reports what was added', () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe('akil-oyunlari-yedek-2026-11-05.json')
    expect(restoredText({ games: 11, puzzles: 21 })).toBe('Yedek yüklendi: 11 oyun ve 21 bulmaca eklendi.')
    expect(restoredText({ games: 0, puzzles: 2 })).toBe('Yedek yüklendi: 2 bulmaca eklendi.')
    expect(restoredText({ games: 0, puzzles: 0 })).toContain('zaten buradaydı')
  })
})
