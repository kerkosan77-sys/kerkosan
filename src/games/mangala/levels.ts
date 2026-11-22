import type { Humanize } from '../../core/humanize'
import type { Level } from '../../core/types'

export interface MangalaLevel extends Level {
  depth: number
  /** Easy levels pick among all moves with controlled randomness. */
  humanize?: Humanize
}

// Temperatures are in centi-stones: 300 means a move 3 stones worse is still picked fairly often.
export const LEVELS: MangalaLevel[] = [
  {
    id: 1,
    name: 'Çok kolay',
    description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.',
    depth: 1,
    humanize: { multiPV: 6, temperature: 300, randomMoveChance: 0.3 },
  },
  {
    id: 2,
    name: 'Kolay',
    description: 'Bariz yakalamaları bazen görür, bazen kaçırır.',
    depth: 2,
    humanize: { multiPV: 6, temperature: 200, randomMoveChance: 0.15 },
  },
  {
    id: 3,
    name: 'Kolay+',
    description: 'Tekrar oynama fırsatlarını sever ama dikkatsizdir.',
    depth: 3,
    humanize: { multiPV: 6, temperature: 120, randomMoveChance: 0.06 },
  },
  {
    id: 4,
    name: 'Orta',
    description: 'Bir iki hamle ilerisini düşünür.',
    depth: 4,
    humanize: { multiPV: 6, temperature: 70, randomMoveChance: 0.02 },
  },
  {
    id: 5,
    name: 'Orta+',
    description: 'Yakalama tuzaklarını çoğunlukla görür.',
    depth: 6,
    humanize: { multiPV: 6, temperature: 35, randomMoveChance: 0 },
  },
  { id: 6, name: 'Zor', description: 'Dikkatli ve planlı oynar.', depth: 8 },
  { id: 7, name: 'Çok zor', description: 'Oyun sonlarını iyi hesaplar.', depth: 11 },
  { id: 8, name: 'Usta', description: 'Tam güç. Hata bekleme.', depth: 14 },
]

export function getLevel(id: number): MangalaLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}
