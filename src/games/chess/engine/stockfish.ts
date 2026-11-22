import type { EngineRole } from '../../../core/types'
import { EngineCancelledError } from '../../../core/engine'
import { mergeInfo, parseBestMove, parseInfo, type InfoLine } from './uci'

export { EngineCancelledError }

export interface SearchOptions {
  depth?: number
  movetime?: number
  multiPV?: number
  /** Stockfish "Skill Level" 0-20. */
  skill?: number
}

export interface SearchResult {
  bestMove: string | null
  /** Final info line per multipv slot, sorted best first. */
  lines: InfoLine[]
}

type Listener = (line: string) => void

/**
 * Thin promise-based wrapper around a Stockfish Web Worker.
 * All commands go through a queue so searches never overlap.
 */
export class Engine {
  private worker: Worker | null = null
  private starting: Promise<void> | null = null
  private listeners = new Set<Listener>()
  private chain: Promise<unknown> = Promise.resolve()
  private generation = 0
  private searching = false

  constructor(private readonly url: string) {}

  /** Loads the engine (once). Safe to call repeatedly. */
  start(): Promise<void> {
    if (!this.starting) {
      this.starting = this.boot().catch((error) => {
        this.starting = null
        this.worker?.terminate()
        this.worker = null
        throw error
      })
    }
    return this.starting
  }

  private async boot(): Promise<void> {
    const worker = new Worker(this.url)
    this.worker = worker
    const failed = new Promise<never>((_, reject) => {
      worker.onerror = (event) => {
        event.preventDefault()
        reject(new Error('Satranç motoru yüklenemedi. Sayfayı yenilemeyi dene.'))
      }
    })
    worker.onmessage = (event: MessageEvent) => {
      const text = typeof event.data === 'string' ? event.data : String(event.data)
      for (const line of text.split('\n')) {
        if (!line) continue
        for (const listener of [...this.listeners]) listener(line)
      }
    }
    await Promise.race([this.command('uci', (l) => l === 'uciok', 30000), failed])
    await Promise.race([this.command('isready', (l) => l === 'readyok', 30000), failed])
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd)
  }

  /** Sends a command and resolves with the first output line that matches. */
  private command(cmd: string, match: (line: string) => boolean, timeoutMs = 15000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener)
        reject(new Error('Satranç motoru yanıt vermedi.'))
      }, timeoutMs)
      const listener: Listener = (line) => {
        if (match(line)) {
          clearTimeout(timer)
          this.listeners.delete(listener)
          resolve(line)
        }
      }
      this.listeners.add(listener)
      this.send(cmd)
    })
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job)
    this.chain = run.catch(() => undefined)
    return run
  }

  /** Tells the engine a new game starts (clears its hash). */
  newGame(): Promise<void> {
    return this.enqueue(async () => {
      await this.start()
      this.send('ucinewgame')
      await this.command('isready', (l) => l === 'readyok')
    })
  }

  search(fen: string, options: SearchOptions = {}): Promise<SearchResult> {
    const generation = this.generation
    return this.enqueue(async () => {
      if (generation !== this.generation) throw new EngineCancelledError()
      await this.start()
      this.send(`setoption name Skill Level value ${options.skill ?? 20}`)
      this.send(`setoption name MultiPV value ${options.multiPV ?? 1}`)
      await this.command('isready', (l) => l === 'readyok')
      if (generation !== this.generation) throw new EngineCancelledError()

      return new Promise<SearchResult>((resolve) => {
        const lines = new Map<number, InfoLine>()
        const listener: Listener = (line) => {
          const info = parseInfo(line)
          if (info) {
            mergeInfo(lines, info)
            return
          }
          const best = parseBestMove(line)
          if (best) {
            this.listeners.delete(listener)
            this.searching = false
            resolve({
              bestMove: best.move,
              lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
            })
          }
        }
        this.listeners.add(listener)
        this.searching = true
        this.send(`position fen ${fen}`)
        this.send(options.movetime ? `go movetime ${options.movetime}` : `go depth ${options.depth ?? 12}`)
      })
    })
  }

  /** Cancels queued searches and stops the running one (it resolves early). */
  cancelAll() {
    this.generation++
    if (this.searching) this.send('stop')
  }

  terminate() {
    this.cancelAll()
    this.worker?.terminate()
    this.worker = null
    this.starting = null
    this.listeners.clear()
  }
}

const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`
const engines = new Map<string, Engine>()

/** Shared engine instances: "play" for games, "analysis" for game review and puzzles. */
export function getEngine(name: EngineRole = 'play'): Engine {
  let engine = engines.get(name)
  if (!engine) {
    engine = new Engine(ENGINE_URL)
    engines.set(name, engine)
  }
  return engine
}
