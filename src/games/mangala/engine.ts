import type { EngineRole } from '../../core/types'
import { EngineCancelledError } from '../../core/engine'
import { botMove } from '../../core/humanize'
import type { EngineLine, GameEngine } from '../../core/types'
import { getLevel } from './levels'
import { decode, legalMoves } from './rules'

interface Pending {
  resolve: (lines: EngineLine[]) => void
  reject: (error: Error) => void
}

/**
 * Runs the Mangala search in a Web Worker so the page stays responsive.
 * A search cannot be interrupted inside the worker, so cancelling simply
 * throws the worker away; a new one is created on the next request.
 */
class MangalaEngine implements GameEngine {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1

  private ensureWorker(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<{ id: number; lines?: EngineLine[]; error?: string }>) => {
        const { id, lines, error } = event.data
        const request = this.pending.get(id)
        if (!request) return
        this.pending.delete(id)
        if (error || !lines) request.reject(new Error(error ?? 'Mangala motoru yanıt vermedi.'))
        else request.resolve(lines)
      }
      worker.onerror = (event) => {
        event.preventDefault()
        this.failAll(new Error('Mangala motoru yüklenemedi. Sayfayı yenilemeyi dene.'))
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

  analyze(position: string, options: { depth?: number; multiPV?: number }): Promise<EngineLine[]> {
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ id, position, depth: options.depth ?? 12, multiPV: options.multiPV ?? 1 })
    })
  }

  chooseMove(position: string, levelId: number): Promise<string | null> {
    return botMove(getLevel(levelId), legalMoves(decode(position)).map(String), (depth, multiPV) =>
      this.analyze(position, { depth, multiPV }),
    )
  }

  cancelAll(): void {
    if (this.pending.size > 0) this.failAll(new EngineCancelledError())
  }
}

const engines = new Map<EngineRole, MangalaEngine>()

export function mangalaEngine(role: EngineRole): GameEngine {
  let engine = engines.get(role)
  if (!engine) {
    engine = new MangalaEngine()
    engines.set(role, engine)
  }
  return engine
}
