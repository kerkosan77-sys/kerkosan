import type { Humanize } from '../../core/humanize'
import type { Level } from '../../core/types'

export interface GoLevel extends Level {
  /** Random games the engine plays out before choosing a move. */
  playouts: number
  /** Easy levels pick among the top moves with controlled randomness. */
  humanize?: Humanize
}

// Temperatures are in centi-points: 500 means a move 5 points worse is still picked fairly often.
export const LEVELS: GoLevel[] = [
  {
    id: 1,
    name: 'Çok kolay',
    description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.',
    playouts: 150,
    humanize: { multiPV: 10, temperature: 800, randomMoveChance: 0.3 },
  },
  {
    id: 2,
    name: 'Kolay',
    description: 'Taş yakalamayı sever ama kendi taşlarını sık sık unutur.',
    playouts: 400,
    humanize: { multiPV: 8, temperature: 500, randomMoveChance: 0.12 },
  },
  {
    id: 3,
    name: 'Kolay+',
    description: 'Basit yakalamaları görür, alan saymayı pek bilmez.',
    playouts: 1000,
    humanize: { multiPV: 8, temperature: 300, randomMoveChance: 0.05 },
  },
  {
    id: 4,
    name: 'Orta',
    description: 'Gruplarını korumaya çalışır, bazen dikkatsizdir.',
    playouts: 2000,
    humanize: { multiPV: 6, temperature: 150, randomMoveChance: 0.02 },
  },
  {
    id: 5,
    name: 'Orta+',
    description: 'Alan için oynar, zayıf gruplara saldırır.',
    playouts: 4000,
    humanize: { multiPV: 6, temperature: 60, randomMoveChance: 0 },
  },
  { id: 6, name: 'Zor', description: 'Dikkatli ve planlı oynar.', playouts: 8000 },
  { id: 7, name: 'Çok zor', description: 'Hayat-ölüm durumlarını iyi okur.', playouts: 16000 },
  { id: 8, name: 'Usta', description: 'Tam güç. Hata bekleme.', playouts: 30000 },
]

export function getLevel(id: number): GoLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}

/** Random games per unit of the shared "depth" setting used by analysis and puzzles. */
export const PLAYOUTS_PER_DEPTH = 1000
