import type { EngineRole } from '../../core/types'
import type { GameEngine } from '../../core/types'
import { WorkerEngine } from '../../core/workerEngine'
import { getLevel } from './levels'
import { decode, legalMoves, moveCode } from './rules'

const engines = new Map<EngineRole, GameEngine>()

/** Dama engine running in a Web Worker (one per role, so analysis never waits for the game). */
export function damaEngine(role: EngineRole): GameEngine {
  let engine = engines.get(role)
  if (!engine) {
    engine = new WorkerEngine({
      name: 'Dama',
      createWorker: () => new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' }),
      legalMoves: (position) => legalMoves(decode(position)).map(moveCode),
      level: getLevel,
    })
    engines.set(role, engine)
  }
  return engine
}
