import type { Humanize } from '../../core/humanize'
import type { Level } from '../../core/types'

export interface ReversiLevel extends Level {
  /** Search depth in moves (near the end the search always runs to the last move). */
  depth: number
  /** Thinking time limit; the deepest finished search is used. */
  maxMs?: number
  /** Easy levels pick among several moves with controlled randomness. */
  humanize?: Humanize
}

// Temperatures are in evaluation points (a corner is worth about 100).
export const LEVELS: ReversiLevel[] = [
  {
    id: 1,
    name: 'Çok kolay',
    description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.',
    depth: 1,
    humanize: { multiPV: 8, temperature: 150, randomMoveChance: 0.3 },
  },
  {
    id: 2,
    name: 'Kolay',
    description: 'En çok taşı çeviren hamleyi sever, köşeleri pek düşünmez.',
    depth: 2,
    humanize: { multiPV: 8, temperature: 100, randomMoveChance: 0.15 },
  },
  {
    id: 3,
    name: 'Kolay+',
    description: 'Köşeleri sever ama köşe yanlarına dikkat etmez.',
    depth: 3,
    humanize: { multiPV: 8, temperature: 60, randomMoveChance: 0.06 },
  },
  {
    id: 4,
    name: 'Orta',
    description: 'Köşeleri korur, bazen dikkatsizdir.',
    depth: 4,
    humanize: { multiPV: 6, temperature: 35, randomMoveChance: 0.02 },
  },
  {
    id: 5,
    name: 'Orta+',
    description: 'Rakibin seçeneklerini azaltmaya çalışır.',
    depth: 5,
    humanize: { multiPV: 6, temperature: 18, randomMoveChance: 0 },
  },
  { id: 6, name: 'Zor', description: 'Dikkatli oynar, son 10 hamleyi tam hesaplar.', depth: 7 },
  { id: 7, name: 'Çok zor', description: 'Daha derin düşünür ve son 10 hamleyi tam hesaplar.', depth: 8 },
  { id: 8, name: 'Usta', description: 'Tam güç, son 14 hamleyi tam hesaplar. Hata bekleme.', depth: 12, maxMs: 3000 },
]

export function getLevel(id: number): ReversiLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}
