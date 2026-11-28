import type { BotStyle } from '../../core/humanize'
import type { Level } from '../../core/types'
import { TRAINED_BOTS } from './bots.trained'

export interface MangalaLevel extends Level, BotStyle {}

// Temperatures are in centi-stones: 300 means a move 3 stones worse is still picked fairly often.
const NAMES: { name: string; description: string }[] = [
  { name: 'Çok kolay', description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.' },
  { name: 'Kolay', description: 'Bariz yakalamaları bazen görür, bazen kaçırır.' },
  { name: 'Kolay+', description: 'Tekrar oynama fırsatlarını sever ama dikkatsizdir.' },
  { name: 'Orta', description: 'Bir iki hamle ilerisini düşünür.' },
  { name: 'Orta+', description: 'Yakalama tuzaklarını çoğunlukla görür.' },
  { name: 'Zor', description: 'Dikkatli ve planlı oynar.' },
  { name: 'Çok zor', description: 'Oyun sonlarını iyi hesaplar.' },
  { name: 'Usta', description: 'Tam güç. Hata bekleme.' },
]

/** The eight trained bots (scripts/train-bots), weakest first. */
export const LEVELS: MangalaLevel[] = NAMES.map((names, i) => ({ id: i + 1, ...names, ...TRAINED_BOTS[i] }))

export function getLevel(id: number): MangalaLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}
