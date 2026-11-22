import { EngineCancelledError } from './engine'
import { pickHumanMove, type Humanize } from './humanize'
import type { EngineLine, GameEngine } from './types'

interface Pending {
  resolve: (lines: EngineLine[]) => void
  reject: (error: Error) => void
}

export interface WorkerEngineConfig {
  /** Shown when the worker cannot be loaded or crashes. */
  name: string
  createWorker(): Worker
  /** Legal move codes in a position (for random moves at easy levels). */
  legalMoves(position: string): string[]
  level(id: number): { depth: number; maxMs?: number; humanize?: Humanize }
}

/**
 * A game engine whose search runs in a Web Worker answering
 * `{id, position, depth, multiPV, maxMs?}` with `{id, lines}` or `{id, error}`.
 * A search cannot be interrupted inside the worker, so cancelling throws the worker away;
 * a new one is created on the next request.
 */
export class WorkerEngine implements GameEngine {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private readonly config: WorkerEngineConfig

  constructor(config: WorkerEngineConfig) {
    this.config = config
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      const worker = this.config.createWorker()
      worker.onmessage = (event: MessageEvent<{ id: number; lines?: EngineLine[]; error?: string }>) => {
        const { id, lines, error } = event.data
        const request = this.pending.get(id)
        if (!request) return
        this.pending.delete(id)
        if (error || !lines) request.reject(new Error(error ?? `${this.config.name} motoru yanıt vermedi.`))
        else request.resolve(lines)
      }
      worker.onerror = (event) => {
        event.preventDefault()
        this.failAll(new Error(`${this.config.name} motoru yüklenemedi. Sayfayı yenilemeyi dene.`))
      }
      this.worker = worker
    }
    return this.worker
  }

  private failAll(error: Error) {
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
    this.worker?.terminate()
    this.worker = null
  }

  async start(): Promise<void> {
    this.ensureWorker()
  }

  async newGame(): Promise<void> {}

  analyze(position: string, options: { depth?: number; multiPV?: number; maxMs?: number }): Promise<EngineLine[]> {
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ id, position, depth: options.depth ?? 8, multiPV: options.multiPV ?? 1, maxMs: options.maxMs })
    })
  }

  async chooseMove(position: string, levelId: number): Promise<string | null> {
    const level = this.config.level(levelId)
    const legal = this.config.legalMoves(position)
    if (legal.length === 0) return null
    if (legal.length === 1) return legal[0]
    if (level.humanize) {
      const lines = await this.analyze(position, { depth: level.depth, multiPV: level.humanize.multiPV, maxMs: level.maxMs })
      return pickHumanMove(lines, legal, level.humanize) ?? lines[0]?.pv[0] ?? legal[0]
    }
    const lines = await this.analyze(position, { depth: level.depth, multiPV: 1, maxMs: level.maxMs })
    return lines[0]?.pv[0] ?? legal[0]
  }

  cancelAll(): void {
    if (this.pending.size > 0) this.failAll(new EngineCancelledError())
  }
}
