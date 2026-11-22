import type { EngineRole } from '../../core/types'
import { EngineCancelledError } from '../../core/engine'
import type { EngineLine, GameEngine } from '../../core/types'
import { PLAYOUTS_PER_DEPTH } from './levels'

interface Reply {
  id: number
  lines?: EngineLine[]
  ownership?: number[]
  move?: string
  error?: string
}

interface Pending {
  resolve: (reply: Reply) => void
  reject: (error: Error) => void
}

/**
 * Runs the Go search in a Web Worker so the page stays responsive.
 * A search cannot be interrupted inside the worker, so cancelling throws the worker away;
 * a new one is created on the next request.
 */
class GoEngine implements GameEngine {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1

  private ensureWorker(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<Reply>) => {
        const request = this.pending.get(event.data.id)
        if (!request) return
        this.pending.delete(event.data.id)
        if (event.data.error) request.reject(new Error(event.data.error))
        else request.resolve(event.data)
      }
      worker.onerror = (event) => {
        event.preventDefault()
        this.failAll(new Error('Go motoru yüklenemedi. Sayfayı yenilemeyi dene.'))
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

  private request(message: Record<string, unknown>): Promise<Reply> {
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage({ ...message, id })
    })
  }

  async start(): Promise<void> {
    this.ensureWorker()
  }

  async newGame(): Promise<void> {}

  /** `depth` is the search size: depth x 1000 random games. */
  async analyze(position: string, options: { depth?: number; multiPV?: number }): Promise<EngineLine[]> {
    const reply = await this.request({
      type: 'analyze',
      position,
      playouts: (options.depth ?? 10) * PLAYOUTS_PER_DEPTH,
      multiPV: options.multiPV ?? 1,
    })
    return reply.lines ?? []
  }

  async chooseMove(position: string, levelId: number): Promise<string | null> {
    const reply = await this.request({ type: 'choose', position, level: levelId })
    return reply.move ?? null
  }

  cancelAll(): void {
    if (this.pending.size > 0) this.failAll(new EngineCancelledError())
  }
}

const engines = new Map<EngineRole, GoEngine>()

export function goEngine(role: EngineRole): GameEngine {
  let engine = engines.get(role)
  if (!engine) {
    engine = new GoEngine()
    engines.set(role, engine)
  }
  return engine
}
