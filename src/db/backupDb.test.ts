import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { addAttempt, addPuzzles, exportBackup, getDB, importBackup, listGames, listPuzzles, readBackup, saveGame } from './db'
import type { GameRecord, PuzzleRecord } from './types'

const game = { id: 'g1', gameType: 'mangala', createdAt: 100 } as unknown as GameRecord
const puzzle = { id: 'g1:4', gameId: 'g1', gameType: 'mangala', createdAt: 100, box: 2, dueAt: 500 } as unknown as PuzzleRecord

async function clearAll() {
  const db = await getDB()
  await Promise.all((['games', 'puzzles', 'attempts', 'kv'] as const).map((store) => db.clear(store)))
}

describe('backup round trip', () => {
  it('moves everything to an empty device and does not double it when loaded twice', async () => {
    await saveGame(game)
    await addPuzzles([puzzle])
    await addAttempt({ gameType: 'mangala', puzzleId: 'g1:4', at: 200, result: 'correct' })
    const file = JSON.stringify(await exportBackup())

    await clearAll()
    expect(await listGames()).toHaveLength(0)

    expect(await importBackup(readBackup(file))).toEqual({ games: 1, puzzles: 1 })
    expect((await listGames()).map((g) => g.id)).toEqual(['g1'])
    expect((await listPuzzles())[0].box).toBe(2)
    expect(await importBackup(readBackup(file))).toEqual({ games: 0, puzzles: 0 })
    expect(await (await getDB()).count('attempts')).toBe(1)
  })

  it('keeps puzzle progress made here after the backup was taken', async () => {
    const file = JSON.stringify(await exportBackup())
    await (await getDB()).put('puzzles', { ...puzzle, box: 4, lastReviewedAt: 900 })
    await importBackup(readBackup(file))
    expect((await listPuzzles())[0].box).toBe(4)
  })
})

describe('merging backups from another device', () => {
  it('keeps the newer analysis and joins finished lessons', async () => {
    const { markLessonDone, loadLessonProgress } = await import('./db')
    const db = await getDB()
    await db.clear('games')
    await db.clear('kv')
    const analysed = (at: number) => ({ version: 6, depth: 1, analyzedAt: at, moves: [], summary: { userMoves: 0, counts: {}, errorTypes: {} } })
    await saveGame({ ...game, id: 'm1', analysis: analysed(200) } as unknown as GameRecord)
    await markLessonDone('chess', 'values')
    const other = {
      app: 'akil-oyunlari-kocu',
      dbVersion: 4,
      exportedAt: 0,
      games: [{ ...game, id: 'm1', analysis: analysed(100) }],
      puzzles: [],
      attempts: [],
      kv: [{ key: 'lessons:chess', value: { done: ['fork'] } }],
    }
    expect(await importBackup(readBackup(JSON.stringify(other)))).toEqual({ games: 0, puzzles: 0 })
    expect((await db.get('games', 'm1'))?.analysis?.analyzedAt).toBe(200)
    expect((await loadLessonProgress('chess')).sort()).toEqual(['fork', 'values'])
  })
})
