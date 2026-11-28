// Stockfish for the training games: the same engine files as the app, run by Node instead of a browser.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { mergeInfo, parseBestMove, parseInfo, type InfoLine } from '../../src/games/chess/engine/uci'
import type { SearchOptions, SearchResult } from '../../src/games/chess/engine/stockfish'

/** Node only runs the engine as a CommonJS file with its .wasm beside it under the same name. */
function engineFile(root: string, cacheDir: string): string {
  const js = join(cacheDir, 'stockfish.cjs')
  if (!existsSync(js)) {
    mkdirSync(cacheDir, { recursive: true })
    copyFileSync(join(root, 'public/stockfish/stockfish-19-lite-single.js'), js)
    copyFileSync(join(root, 'public/stockfish/stockfish-19-lite-single.wasm'), join(cacheDir, 'stockfish.wasm'))
  }
  return js
}

export class NodeStockfish {
  private process: ChildProcessWithoutNullStreams
  private listener: ((line: string) => void) | null = null

  constructor(root: string, cacheDir: string) {
    this.process = spawn(process.execPath, [engineFile(root, cacheDir)], { stdio: ['pipe', 'pipe', 'pipe'] })
    createInterface({ input: this.process.stdout }).on('line', (line) => this.listener?.(line))
    this.process.stdin.write('uci\nsetoption name Threads value 1\nsetoption name Hash value 16\n')
  }

  private until(command: string, done: (line: string) => boolean, onLine?: (line: string) => void): Promise<void> {
    return new Promise((resolve) => {
      this.listener = (line) => {
        onLine?.(line)
        if (done(line)) {
          this.listener = null
          resolve()
        }
      }
      this.process.stdin.write(`${command}\n`)
    })
  }

  newGame(): Promise<void> {
    return this.until('ucinewgame\nisready', (line) => line === 'readyok')
  }

  async search(fen: string, options: SearchOptions = {}): Promise<SearchResult> {
    await this.until(`setoption name MultiPV value ${options.multiPV ?? 1}\nisready`, (line) => line === 'readyok')
    const lines = new Map<number, InfoLine>()
    let bestMove: string | null = null
    await this.until(
      `position fen ${fen}\ngo depth ${options.depth ?? 12}`,
      (line) => {
        const best = parseBestMove(line)
        if (best) bestMove = best.move
        return Boolean(best)
      },
      (line) => {
        const info = parseInfo(line)
        if (info) mergeInfo(lines, info)
      },
    )
    return { bestMove, lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) }
  }

  close() {
    this.process.stdin.write('quit\n')
    this.process.kill()
  }
}
