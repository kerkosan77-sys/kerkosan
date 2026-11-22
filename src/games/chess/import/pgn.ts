import { Chess } from 'chess.js'
import type { Side } from '../../../core/types'

export interface ParsedPgn {
  pgn: string
  white: string
  black: string
  result: string
  moveCount: number
}

export class PgnError extends Error {}

/** Validates pasted PGN text (only the first game is used if several are pasted). */
export function parsePgn(text: string): ParsedPgn {
  const trimmed = text.trim()
  if (!trimmed) throw new PgnError('Önce bir PGN yapıştır.')
  // Several games pasted together: keep the first one.
  const first = trimmed.split(/\n\s*\n(?=\[Event\s)/)[0]

  const chess = new Chess()
  try {
    chess.loadPgn(first)
  } catch {
    throw new PgnError(
      'Bu metin geçerli bir PGN gibi görünmüyor. Oyunu Chess.com\'da açıp "Paylaş → PGN" ile kopyalamayı dene.',
    )
  }
  const moveCount = chess.history().length
  if (moveCount === 0) throw new PgnError('Bu PGN\'de hiç hamle yok.')

  const headers = chess.getHeaders()
  return {
    pgn: first,
    white: cleanName(headers.White) || 'Beyaz',
    black: cleanName(headers.Black) || 'Siyah',
    result: headers.Result || '*',
    moveCount,
  }
}

function cleanName(name: string | undefined): string {
  if (!name || name === '?') return ''
  return name.trim()
}

/** Matches the PGN player names against names known to belong to the user. */
export function guessUserColor(white: string, black: string, knownNames: string[]): Side | null {
  const names = knownNames.map((n) => n.trim().toLocaleLowerCase('tr-TR')).filter(Boolean)
  const isUser = (name: string) => names.includes(name.trim().toLocaleLowerCase('tr-TR'))
  const whiteIsUser = isUser(white)
  const blackIsUser = isUser(black)
  if (whiteIsUser && !blackIsUser) return 'w'
  if (blackIsUser && !whiteIsUser) return 'b'
  return null
}
