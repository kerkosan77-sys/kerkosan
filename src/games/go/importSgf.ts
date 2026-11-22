import { newId } from '../../core/records'
import type { Side } from '../../core/types'
import { saveGame } from '../../db/db'
import type { GameRecord } from '../../db/types'
import { BOARD_SIZE } from './rules'
import { replay } from './record'

export interface SgfImport {
  record: string
  /** w = black (moves first), b = white. */
  names: Record<Side, string>
  result: string
  playedAt?: number
  moveCount: number
}

/** Game result from an SGF RE value: "B+3.5", "W+R", "0", "Draw". */
export function resultFromRe(re: string | undefined): string {
  const value = (re ?? '').trim().toUpperCase()
  if (value.startsWith('B+')) return '1-0'
  if (value.startsWith('W+')) return '0-1'
  if (value === '0' || value === 'DRAW' || value === 'JIGO') return '1/2-1/2'
  return '*'
}

/** First date of an SGF DT value ("2026-11-18" or "2026-11-18,19"), as a timestamp. */
function dateFrom(dt: string | undefined): number | undefined {
  const match = dt?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? undefined : date.getTime()
}

/** Reads a pasted SGF game for analysis. Throws a Turkish message if it cannot be used. */
export function readSgfForImport(text: string): SgfImport {
  const record = text.trim()
  if (!record) throw new Error('Önce bir SGF dosyası seç ya da oyunun metnini yapıştır.')
  if (!record.includes('(') || !record.includes(';')) throw new Error('Bu bir SGF oyunu gibi görünmüyor. Metin "(;" ile başlamalı.')
  const { state, sgf } = replay(record)
  if (state.position.size !== BOARD_SIZE) {
    throw new Error(`Bu oyun ${state.position.size}×${state.position.size} tahtada oynanmış. Şimdilik sadece 9×9 oyunlar analiz edilebiliyor.`)
  }
  if (state.moves.length === 0) throw new Error('Bu oyunda hiç hamle yok.')
  const info = sgf?.info ?? {}
  return {
    record,
    names: { w: info.PB?.trim() || 'Siyah', b: info.PW?.trim() || 'Beyaz' },
    result: resultFromRe(info.RE),
    playedAt: dateFrom(info.DT),
    moveCount: state.moves.length,
  }
}

/** The user's colour if exactly one player has a known name. */
export function guessUserSide(names: Record<Side, string>, knownNames: string[]): Side | null {
  const known = knownNames.map((n) => n.trim().toLocaleLowerCase('tr-TR')).filter(Boolean)
  const isUser = (name: string) => known.includes(name.trim().toLocaleLowerCase('tr-TR'))
  if (isUser(names.w) && !isUser(names.b)) return 'w'
  if (isUser(names.b) && !isUser(names.w)) return 'b'
  return null
}

export function sgfGameRecord(data: SgfImport, userSide: Side, now = Date.now()): GameRecord {
  return {
    id: newId(),
    gameType: 'go',
    createdAt: now,
    playedAt: data.playedAt,
    source: 'sgf',
    record: data.record,
    userSide,
    names: data.names,
    result: data.result,
  }
}

/** Saves an imported game and returns its id. */
export async function importSgfGame(data: SgfImport, userSide: Side): Promise<string> {
  const game = sgfGameRecord(data, userSide)
  await saveGame(game)
  return game.id
}
