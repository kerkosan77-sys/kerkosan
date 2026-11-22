import type { EngineRole } from '../../../core/types'
import type { GameEngine } from '../../../core/types'
import { chooseEngineMove, getLevel } from './levels'
import { getEngine } from './stockfish'

const adapters = new Map<EngineRole, GameEngine>()

/** Stockfish behind the shared engine interface. */
export function chessEngine(role: EngineRole): GameEngine {
  let adapter = adapters.get(role)
  if (!adapter) {
    const engine = getEngine(role)
    adapter = {
      start: () => engine.start(),
      newGame: () => engine.newGame(),
      analyze: async (position, options) =>
        (await engine.search(position, options)).lines.map((line) => ({ score: line.score, pv: line.pv })),
      chooseMove: (position, levelId) => chooseEngineMove(engine, position, getLevel(levelId)),
      cancelAll: () => engine.cancelAll(),
    }
    adapters.set(role, adapter)
  }
  return adapter
}
