import type { Side as Color } from '../../../core/types'

export interface ChessComGame {
  url: string
  pgn: string
  endTime: number
  timeClass: string
  white: string
  black: string
  userColor: Color
  /** Result code from the user's side: "win", "checkmated", "agreed", ... */
  userResult: string
}

export type ChessComErrorKind = 'invalid' | 'not_found' | 'network' | 'rate_limit' | 'empty' | 'other'

export class ChessComError extends Error {
  constructor(
    message: string,
    readonly kind: ChessComErrorKind,
  ) {
    super(message)
    this.name = 'ChessComError'
  }
}

const API = 'https://api.chess.com/pub/player'
const MAX_ARCHIVE_MONTHS = 3

const DRAW_RESULTS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])

export function chessComOutcome(userResult: string): 'win' | 'loss' | 'draw' {
  if (userResult === 'win') return 'win'
  if (DRAW_RESULTS.has(userResult)) return 'draw'
  return 'loss'
}

export const TIME_CLASS_LABELS: Record<string, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Hızlı',
  daily: 'Günlük',
}

interface RawPlayer {
  username?: string
  result?: string
}

interface RawGame {
  url?: string
  pgn?: string
  end_time?: number
  time_class?: string
  rules?: string
  white?: RawPlayer
  black?: RawPlayer
}

async function getJson(url: string, fetchImpl: typeof fetch, username: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new ChessComError(
      'Chess.com\'a bağlanılamadı. Bunun sebebi internet bağlantın ya da tarayıcının güvenlik kısıtlaması (CORS) olabilir. ' +
        'Endişelenme: oyunu Chess.com\'dan PGN olarak kopyalayıp "PGN yapıştır" sekmesine yapıştırabilirsin.',
      'network',
    )
  }
  if (response.status === 404) {
    throw new ChessComError(`"${username}" adında bir Chess.com kullanıcısı bulunamadı. Kullanıcı adını kontrol et.`, 'not_found')
  }
  if (response.status === 429) {
    throw new ChessComError('Chess.com şu an çok fazla istek alıyor. Biraz bekleyip tekrar dene.', 'rate_limit')
  }
  if (!response.ok) {
    throw new ChessComError(
      `Chess.com beklenmedik bir yanıt verdi (kod ${response.status}). Bir süre sonra tekrar dene ya da PGN yapıştırma yöntemini kullan.`,
      'other',
    )
  }
  return response.json()
}

/** Most recent standard-chess games of a Chess.com user, newest first. */
export async function fetchRecentGames(
  rawUsername: string,
  limit = 30,
  fetchImpl: typeof fetch = fetch,
): Promise<ChessComGame[]> {
  const username = rawUsername.trim().toLowerCase()
  if (!/^[a-z0-9_-]{2,30}$/.test(username)) {
    throw new ChessComError('Geçerli bir Chess.com kullanıcı adı yaz (sadece harf, rakam, "-" ve "_").', 'invalid')
  }

  const archivesJson = (await getJson(`${API}/${encodeURIComponent(username)}/games/archives`, fetchImpl, username)) as {
    archives?: string[]
  }
  const archives = (archivesJson.archives ?? []).slice().reverse().slice(0, MAX_ARCHIVE_MONTHS)
  if (archives.length === 0) throw new ChessComError('Bu hesapta henüz oyun yok.', 'empty')

  const games: ChessComGame[] = []
  for (const archiveUrl of archives) {
    const monthJson = (await getJson(archiveUrl, fetchImpl, username)) as { games?: RawGame[] }
    for (const raw of monthJson.games ?? []) {
      const game = toGame(raw, username)
      if (game) games.push(game)
    }
    if (games.length >= limit) break
  }
  if (games.length === 0) throw new ChessComError('Son aylarda standart satranç oyunu bulunamadı.', 'empty')
  return games.sort((a, b) => b.endTime - a.endTime).slice(0, limit)
}

function toGame(raw: RawGame, username: string): ChessComGame | null {
  if (!raw.pgn || !raw.url || (raw.rules && raw.rules !== 'chess')) return null
  const white = raw.white?.username ?? 'Beyaz'
  const black = raw.black?.username ?? 'Siyah'
  const userColor: Color | null =
    white.toLowerCase() === username ? 'w' : black.toLowerCase() === username ? 'b' : null
  if (!userColor) return null
  return {
    url: raw.url,
    pgn: raw.pgn,
    endTime: raw.end_time ?? 0,
    timeClass: raw.time_class ?? '',
    white,
    black,
    userColor,
    userResult: (userColor === 'w' ? raw.white?.result : raw.black?.result) ?? '',
  }
}
