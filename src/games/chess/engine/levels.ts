import { Chess } from 'chess.js'
import { pickHumanMove, type Humanize } from '../../../core/humanize'
import type { Engine } from './stockfish'

// Even Stockfish's weakest built-in setting is far stronger than a beginner,
// so the easy levels use the shared human-like move picker.
export { pickHumanMove, type Humanize }

export interface Level {
  id: number
  name: string
  description: string
  depth: number
  skill: number
  humanize?: Humanize
}

export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'Çok kolay',
    description: 'Sık sık taş bırakır. Isınmak için.',
    depth: 2,
    skill: 0,
    humanize: { multiPV: 8, temperature: 250, randomMoveChance: 0.22 },
  },
  {
    id: 2,
    name: 'Kolay',
    description: 'Bazen bariz hatalar yapar.',
    depth: 3,
    skill: 0,
    humanize: { multiPV: 6, temperature: 160, randomMoveChance: 0.1 },
  },
  {
    id: 3,
    name: 'Kolay+',
    description: 'Arada bir hata yapar. 700 civarı için iyi bir rakip.',
    depth: 4,
    skill: 1,
    humanize: { multiPV: 5, temperature: 100, randomMoveChance: 0.05 },
  },
  {
    id: 4,
    name: 'Orta',
    description: 'Bedava taşı nadiren kaçırır.',
    depth: 5,
    skill: 3,
    humanize: { multiPV: 4, temperature: 60, randomMoveChance: 0.02 },
  },
  {
    id: 5,
    name: 'Orta+',
    description: 'Basit taktikleri görür.',
    depth: 6,
    skill: 5,
    humanize: { multiPV: 3, temperature: 30, randomMoveChance: 0 },
  },
  { id: 6, name: 'Zor', description: 'Kulüp oyuncusu gibi oynar.', depth: 8, skill: 10 },
  { id: 7, name: 'Çok zor', description: 'Ciddi bir rakip.', depth: 10, skill: 15 },
  { id: 8, name: 'Usta', description: 'Tam güç. Kazanmak çok zor.', depth: 14, skill: 20 },
]

export function getLevel(id: number): Level {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}

/** Asks the engine for a move at the given level. Returns a UCI move like "e2e4". */
export async function chooseEngineMove(engine: Engine, fen: string, level: Level): Promise<string | null> {
  const legalMoves = new Chess(fen).moves({ verbose: true }).map((move) => move.lan)
  if (legalMoves.length === 0) return null

  if (level.humanize) {
    const result = await engine.search(fen, { depth: level.depth, multiPV: level.humanize.multiPV, skill: 20 })
    return pickHumanMove(result.lines, legalMoves, level.humanize) ?? result.bestMove ?? legalMoves[0]
  }
  const result = await engine.search(fen, { depth: level.depth, skill: level.skill })
  return result.bestMove ?? legalMoves[0]
}
