import type { Humanize } from '../../core/humanize'
import type { Level } from '../../core/types'

export interface DamaLevel extends Level {
  /** Search depth in half-moves (captures are always followed to the end). */
  depth: number
  /** Thinking time limit; the deepest finished search is used. */
  maxMs?: number
  /** Easy levels pick among several moves with controlled randomness. */
  humanize?: Humanize
}

// Temperatures are in centi-men: 200 means a move two men worse is still picked fairly often.
export const LEVELS: DamaLevel[] = [
  {
    id: 1,
    name: 'Çok kolay',
    description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.',
    depth: 1,
    humanize: { multiPV: 8, temperature: 300, randomMoveChance: 0.3 },
  },
  {
    id: 2,
    name: 'Kolay',
    description: 'Taş almayı sever ama taşlarını sık sık açıkta bırakır.',
    depth: 2,
    humanize: { multiPV: 8, temperature: 200, randomMoveChance: 0.15 },
  },
  {
    id: 3,
    name: 'Kolay+',
    description: 'Bir hamle sonrasını görür, tuzakları pek fark etmez.',
    depth: 3,
    humanize: { multiPV: 8, temperature: 120, randomMoveChance: 0.06 },
  },
  {
    id: 4,
    name: 'Orta',
    description: 'Basit tuzakları görür, bazen dikkatsizdir.',
    depth: 4,
    humanize: { multiPV: 6, temperature: 70, randomMoveChance: 0.02 },
  },
  {
    id: 5,
    name: 'Orta+',
    description: 'Taş verip zorunlu almaya sokma tuzaklarını çoğunlukla görür.',
    depth: 6,
    humanize: { multiPV: 6, temperature: 35, randomMoveChance: 0 },
  },
  { id: 6, name: 'Zor', description: 'Dikkatli oynar, dama yapmak için plan kurar.', depth: 6 },
  { id: 7, name: 'Çok zor', description: 'Birkaç hamle sonraki tuzakları hesaplar.', depth: 7 },
  { id: 8, name: 'Usta', description: 'Tam güç. Hata bekleme.', depth: 14, maxMs: 3500 },
]

export function getLevel(id: number): DamaLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}
