import type { GameModule } from './types'

/** Whether a saved game's moves can be analysed (see GameModule.canAnalyse). */
export function analysable(game: Partial<Pick<GameModule, 'canAnalyse' | 'position' | 'stateFromRecord'>>, record: string): boolean {
  if (!game.canAnalyse || !game.position || !game.stateFromRecord) return true
  try {
    return game.canAnalyse(game.position(game.stateFromRecord(record)))
  } catch {
    return true
  }
}
