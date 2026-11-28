import type { Humanize } from '../../core/humanize'
import type { Level } from '../../core/types'
import { TRAINED_BOTS } from './bots.trained'

export interface GoLevel extends Level {
  /** Random games the engine plays out before choosing a move. */
  playouts: number
  /** Easy levels pick among the top moves with controlled randomness. */
  humanize?: Humanize
}

// Temperatures are in centi-points: 500 means a move 5 points worse is still picked fairly often.
const NAMES: { name: string; description: string }[] = [
  { name: 'Çok kolay', description: 'Çoğu zaman rastgele oynar. Kuralları öğrenmek için.' },
  { name: 'Kolay', description: 'Taş yakalamayı sever ama kendi taşlarını sık sık unutur.' },
  { name: 'Kolay+', description: 'Basit yakalamaları görür, alan saymayı pek bilmez.' },
  { name: 'Orta', description: 'Gruplarını korumaya çalışır, bazen dikkatsizdir.' },
  { name: 'Orta+', description: 'Alan için oynar, zayıf gruplara saldırır.' },
  { name: 'Zor', description: 'Dikkatli ve planlı oynar.' },
  { name: 'Çok zor', description: 'Hayat-ölüm durumlarını iyi okur.' },
  { name: 'Usta', description: 'Tam güç. Hata bekleme.' },
]

/** The eight trained bots (scripts/train-bots), weakest first. */
export const LEVELS: GoLevel[] = NAMES.map((names, i) => ({ id: i + 1, ...names, ...TRAINED_BOTS[i] }))

export function getLevel(id: number): GoLevel {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[2]
}

/** Random games per unit of the shared "depth" setting used by analysis and puzzles. */
export const PLAYOUTS_PER_DEPTH = 1000
