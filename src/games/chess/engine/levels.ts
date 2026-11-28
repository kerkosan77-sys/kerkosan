import { Chess } from 'chess.js'
import { botMove, pickHumanMove, type BotStyle, type Humanize } from '../../../core/humanize'
import type { Level as BaseLevel } from '../../../core/types'
import { CHESS_BOTS } from './bots.trained'
import type { SearchOptions, SearchResult } from './stockfish'

// Even Stockfish's weakest built-in setting is far stronger than a beginner,
// so the levels use the shared human-like move picker on top of Stockfish's candidate moves.
export { pickHumanMove, type Humanize }

export interface Level extends BaseLevel, BotStyle {}

const NAMES: { name: string; description: string }[] = [
  { name: 'Çok kolay', description: 'Sık sık taş bırakır. Isınmak için.' },
  { name: 'Kolay', description: 'Bazen bariz hatalar yapar.' },
  { name: 'Kolay+', description: 'Arada bir hata yapar.' },
  { name: 'Orta', description: 'Bedava taşı nadiren kaçırır.' },
  { name: 'Orta+', description: 'Basit taktikleri görür.' },
  { name: 'Zor', description: 'Kulüp oyuncusu gibi oynar.' },
  { name: 'Çok zor', description: 'Ciddi bir rakip.' },
  { name: 'Usta', description: 'Tam güç. Kazanmak çok zor.' },
]

/** The eight trained bots (scripts/train-bots), weakest first. */
export const LEVELS: Level[] = NAMES.map((names, i) => ({ id: i + 1, ...names, ...CHESS_BOTS[i] }))

export function getLevel(id: number): Level {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}

/** Asks the engine for a move at the given level. Returns a UCI move like "e2e4". */
export function chooseEngineMove(
  engine: { search(fen: string, options: SearchOptions): Promise<SearchResult> },
  fen: string,
  level: BotStyle,
  random: () => number = Math.random,
): Promise<string | null> {
  const legalMoves = new Chess(fen).moves({ verbose: true }).map((move) => move.lan)
  return botMove(level, legalMoves, async (depth, multiPV) => (await engine.search(fen, { depth, multiPV })).lines, random)
}
