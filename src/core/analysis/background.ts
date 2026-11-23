import { addPuzzles, getGame, saveGame } from '../../db/db'
import { analysable } from '../analysable'
import type { GameRecord } from '../../db/types'
import { buildPuzzles } from '../puzzles/fromAnalysis'
import { gamePoints } from '../stats/points'
import type { GameModule } from '../types'
import { analysisVersion, analyzeGame } from './analyzeGame'

/**
 * Game analysis that keeps running in the background, one game at a time: started when a game
 * ends (and for games never analysed), it saves the analysis and the new puzzles by itself, so
 * leaving the page loses nothing. Screens only watch its progress.
 */

export interface AnalysisJob {
  gameId: string
  /** 'unsupported': this game's moves are not analysed (see GameModule.canAnalyse); its result points still count. */
  status: 'waiting' | 'running' | 'done' | 'error' | 'unsupported'
  done: number
  total: number
  error?: string
  /** Puzzles this analysis added to the bank. */
  newPuzzles?: number
  /** Points the analysed game is worth. */
  points?: number
}

type Listener = (job: AnalysisJob) => void

const jobs = new Map<string, AnalysisJob>()
const listeners = new Map<string, Set<Listener>>()
const running = new Map<string, Promise<GameRecord | null>>()
let queue: Promise<unknown> = Promise.resolve()

function update(job: AnalysisJob) {
  jobs.set(job.gameId, job)
  for (const listener of listeners.get(job.gameId) ?? []) listener(job)
}

/** The latest state of a game's analysis, if one was started in this session. */
export function analysisJob(gameId: string): AnalysisJob | null {
  return jobs.get(gameId) ?? null
}

/** Calls `listener` with every change of a game's analysis (and once now if there is one). Returns the unsubscribe function. */
export function watchAnalysis(gameId: string, listener: Listener): () => void {
  let set = listeners.get(gameId)
  if (!set) {
    set = new Set()
    listeners.set(gameId, set)
  }
  set.add(listener)
  const current = jobs.get(gameId)
  if (current) listener(current)
  return () => {
    set.delete(listener)
  }
}

/**
 * Queues a saved game for analysis. Resolves with the analysed game, or null if it could not be
 * analysed. Asking again while it is queued or running returns the same promise.
 */
export function queueAnalysis(game: GameModule, gameId: string): Promise<GameRecord | null> {
  const existing = running.get(gameId)
  if (existing) return existing
  update({ gameId, status: 'waiting', done: 0, total: 0 })
  const promise = queue.then(() => run(game, gameId)).finally(() => running.delete(gameId))
  queue = promise.catch(() => undefined)
  running.set(gameId, promise)
  return promise
}

async function run(game: GameModule, gameId: string): Promise<GameRecord | null> {
  const found = await getGame(gameId)
  if (!found || found.gameType !== game.id) {
    update({ gameId, status: 'error', done: 0, total: 0, error: 'Oyun bulunamadı.' })
    return null
  }
  if (!analysable(game, found.record)) {
    update({ gameId, status: 'unsupported', done: 1, total: 1, newPuzzles: 0, points: gamePoints(found).total })
    return null
  }
  if (found.analysis?.version === analysisVersion(game)) {
    update({ gameId, status: 'done', done: 1, total: 1, newPuzzles: 0 })
    return found
  }
  update({ gameId, status: 'running', done: 0, total: 0 })
  try {
    const engine = game.engine('analysis')
    await engine.start()
    const analysis = await analyzeGame(game, engine, found.record, found.userSide, {
      onProgress: (done, total) => update({ gameId, status: 'running', done, total }),
    })
    // The game may have changed meanwhile (Go: dead stones corrected after the end): start over.
    const latest = await getGame(gameId)
    if (!latest) return null
    if (latest.record !== found.record) return run(game, gameId)
    const updated: GameRecord = { ...latest, analysis }
    await saveGame(updated)
    const newPuzzles = await addPuzzles(buildPuzzles(updated, Date.now(), game.phaseOf))
    update({ gameId, status: 'done', done: 1, total: 1, newPuzzles, points: gamePoints(updated).total })
    return updated
  } catch (error) {
    update({
      gameId,
      status: 'error',
      done: 0,
      total: 0,
      error: error instanceof Error ? error.message : 'Analiz sırasında bir sorun oluştu.',
    })
    return null
  }
}

/** Analyses, one after the other, every saved game that was never analysed (so their puzzles exist). */
export function analyseMissing(games: GameRecord[], moduleOf: (record: GameRecord) => GameModule | undefined): void {
  for (const record of games) {
    if (record.analysis) continue
    const module = moduleOf(record)
    if (module && analysable(module, record.record)) void queueAnalysis(module, record.id)
  }
}
