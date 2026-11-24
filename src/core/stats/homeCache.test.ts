import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { exportBackup, getDB, importBackup, loadGamesStamp, readBackup, saveGame } from '../../db/db'
import type { GameRecord } from '../../db/types'
import { GAMES } from '../../games/registry'
import { emptyCounts } from '../analysis/summary'
import { loadProgress, refreshSummary } from './homeCache'

const chess = GAMES.find((g) => g.id === 'chess')!

function record(id: string, result: string, classes: ('best' | 'blunder' | 'mistake')[] = []): GameRecord {
  const moves = classes.map((classification, i) => ({
    ply: i * 2,
    label: `m${i}`,
    code: '',
    side: 'w' as const,
    before: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    after: '',
    isUserMove: true,
    classification,
    drop: classification === 'blunder' ? 30 : 10,
    errorType: classification === 'best' ? undefined : 'hung_piece',
  }))
  return {
    id,
    gameType: 'chess',
    createdAt: Number(id.replace(/\D/g, '')),
    source: 'play',
    record: '',
    userSide: 'w',
    names: { w: 'Sen', b: 'Bot' },
    result,
    level: 3,
    analysis: { version: 6, depth: 1, analyzedAt: 1, moves, summary: { userMoves: moves.length, counts: emptyCounts(), errorTypes: {} } },
  }
}

async function clearAll() {
  const db = await getDB()
  await Promise.all((['games', 'puzzles', 'attempts', 'kv'] as const).map((store) => db.clear(store)))
}

describe('the stored home-screen summary', () => {
  it('is used as it is until a game is saved, then worked out again', async () => {
    await clearAll()
    await saveGame(record('g1', '1-0'))
    const first = await loadProgress(chess)
    expect(first.summary.points).toBe(30)

    // Change a game behind the cache's back: the stored summary is still used (nothing was read again).
    await (await getDB()).put('games', record('g2', '1-0'))
    expect((await loadProgress(chess)).summary.points).toBe(30)

    // Saving a game changes the stamp, so the summary is worked out again.
    await saveGame(record('g3', '1-0'))
    expect((await loadProgress(chess)).summary.points).toBe(90)
  })

  it('is refreshed right after an analysis and points at the worst error of the latest game', async () => {
    await clearAll()
    await saveGame(record('g1', '0-1', ['best', 'mistake', 'blunder', 'mistake']))
    const summary = await refreshSummary(chess)
    expect(summary.lastMistake).toMatchObject({ gameId: 'g1', ply: 4, errorType: 'hung_piece' })
    expect((await loadProgress(chess)).summary.lastMistake?.ply).toBe(4)
  })

  it('stays on its device: not in backups, and a sync that brings games changes the stamp', async () => {
    await clearAll()
    await saveGame(record('g1', '1-0'))
    await loadProgress(chess)
    const backup = await exportBackup()
    expect(backup.kv.some((row) => row.key.startsWith('summary:') || row.key.startsWith('gamesStamp:'))).toBe(false)

    const before = await loadGamesStamp('chess')
    await importBackup(readBackup(JSON.stringify({ ...backup, games: [...backup.games, record('g9', '1-0')] })))
    expect(await loadGamesStamp('chess')).not.toBe(before)
    expect((await loadProgress(chess)).summary.points).toBe(60)
  })
})
