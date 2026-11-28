import type { BotStyle } from '../../core/humanize'
import type { Level } from '../../core/types'
import { TRAINED_BOTS } from './bots.trained'

export interface ReversiLevel extends Level, BotStyle {
  /** Thinking time limit; the deepest finished search is used. */
  maxMs?: number
}

// Depths are in moves (near the end the search always runs to the last move).
// Temperatures are in evaluation points (a corner is worth about 100).
const NAMES: { name: string; description: string }[] = [
  { name: 'Çok kolay', description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.' },
  { name: 'Kolay', description: 'En çok taşı çeviren hamleyi sever, köşeleri pek düşünmez.' },
  { name: 'Kolay+', description: 'Köşeleri sever ama köşe yanlarına dikkat etmez.' },
  { name: 'Orta', description: 'Köşeleri korur, bazen dikkatsizdir.' },
  { name: 'Orta+', description: 'Rakibin seçeneklerini azaltmaya çalışır.' },
  { name: 'Zor', description: 'Dikkatli oynar, oyun sonunu tam hesaplar.' },
  { name: 'Çok zor', description: 'Daha derin düşünür ve oyun sonunu tam hesaplar.' },
  { name: 'Usta', description: 'Tam güç. Hata bekleme.' },
]

/** The eight trained bots (scripts/train-bots), weakest first. */
export const LEVELS: ReversiLevel[] = NAMES.map((names, i) => ({ id: i + 1, ...names, ...TRAINED_BOTS[i] }))

export function getLevel(id: number): ReversiLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}
