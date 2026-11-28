import type { BotStyle } from '../../core/humanize'
import type { Level } from '../../core/types'
import { TRAINED_BOTS } from './bots.trained'

export interface DamaLevel extends Level, BotStyle {
  /** Thinking time limit; the deepest finished search is used. */
  maxMs?: number
}

// Depths are in half-moves (captures are always followed to the end).
// Temperatures are in centi-men: 200 means a move two men worse is still picked fairly often.
const NAMES: { name: string; description: string }[] = [
  { name: 'Çok kolay', description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.' },
  { name: 'Kolay', description: 'Taş almayı sever ama taşlarını sık sık açıkta bırakır.' },
  { name: 'Kolay+', description: 'Bir hamle sonrasını görür, tuzakları pek fark etmez.' },
  { name: 'Orta', description: 'Basit tuzakları görür, bazen dikkatsizdir.' },
  { name: 'Orta+', description: 'Taş verip zorunlu almaya sokma tuzaklarını çoğunlukla görür.' },
  { name: 'Zor', description: 'Dikkatli oynar, dama yapmak için plan kurar.' },
  { name: 'Çok zor', description: 'Birkaç hamle sonraki tuzakları hesaplar.' },
  { name: 'Usta', description: 'Tam güç. Hata bekleme.' },
]

/** The eight trained bots (scripts/train-bots), weakest first. */
export const LEVELS: DamaLevel[] = NAMES.map((names, i) => ({ id: i + 1, ...names, ...TRAINED_BOTS[i] }))

export function getLevel(id: number): DamaLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}
