import { describe, expect, it } from 'vitest'
import { ChessComError, chessComOutcome, fetchRecentGames } from './chesscom'

const ARCHIVES = 'https://api.chess.com/pub/player/kullanici/games/archives'
const OCT = 'https://api.chess.com/pub/player/kullanici/games/2026/10'
const NOV = 'https://api.chess.com/pub/player/kullanici/games/2026/11'

function game(url: string, endTime: number, white: string, black: string, extra: Record<string, unknown> = {}) {
  return {
    url,
    pgn: '1. e4 e5 *',
    end_time: endTime,
    time_class: 'rapid',
    rules: 'chess',
    white: { username: white, result: 'win' },
    black: { username: black, result: 'resigned' },
    ...extra,
  }
}

function mockFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (!(url in routes)) return new Response('not found', { status: 404 })
    const body = routes[url]
    if (body instanceof Response) return body
    return new Response(JSON.stringify(body), { status: 200 })
  }) as typeof fetch
}

describe('fetchRecentGames', () => {
  it('collects games newest first, from the newest months, and finds the user color', async () => {
    const fetchImpl = mockFetch({
      [ARCHIVES]: { archives: [OCT, NOV] },
      [NOV]: { games: [game('g2', 200, 'Kullanici', 'x'), game('g3', 300, 'y', 'kullanici')] },
      [OCT]: { games: [game('g1', 100, 'kullanici', 'z')] },
    })
    const games = await fetchRecentGames('  Kullanici ', 10, fetchImpl)
    expect(games.map((g) => g.url)).toEqual(['g3', 'g2', 'g1'])
    expect(games[0]).toMatchObject({ userColor: 'b', userResult: 'resigned', timeClass: 'rapid' })
    expect(games[1]).toMatchObject({ userColor: 'w', userResult: 'win' })
  })

  it('skips chess variants and games without PGN', async () => {
    const fetchImpl = mockFetch({
      [ARCHIVES]: { archives: [NOV] },
      [NOV]: {
        games: [
          game('ok', 1, 'kullanici', 'x'),
          game('variant', 2, 'kullanici', 'x', { rules: 'chess960' }),
          game('nopgn', 3, 'kullanici', 'x', { pgn: undefined }),
        ],
      },
    })
    const games = await fetchRecentGames('kullanici', 10, fetchImpl)
    expect(games.map((g) => g.url)).toEqual(['ok'])
  })

  it('stops after the limit', async () => {
    const fetchImpl = mockFetch({
      [ARCHIVES]: { archives: [OCT, NOV] },
      [NOV]: { games: [game('a', 1, 'kullanici', 'x'), game('b', 2, 'kullanici', 'x')] },
    })
    const games = await fetchRecentGames('kullanici', 1, fetchImpl)
    expect(games).toHaveLength(1)
  })

  it('reports an unknown user', async () => {
    await expect(fetchRecentGames('kimsebulamaz', 10, mockFetch({}))).rejects.toMatchObject({ kind: 'not_found' })
  })

  it('reports network / CORS failures with a hint to paste the PGN', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    const error = await fetchRecentGames('kullanici', 10, failing).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ChessComError)
    expect((error as ChessComError).kind).toBe('network')
    expect((error as ChessComError).message).toContain('PGN yapıştır')
  })

  it('reports rate limiting', async () => {
    const fetchImpl = mockFetch({ [ARCHIVES]: new Response('', { status: 429 }) })
    await expect(fetchRecentGames('kullanici', 10, fetchImpl)).rejects.toMatchObject({ kind: 'rate_limit' })
  })

  it('rejects invalid usernames without calling the network', async () => {
    let called = false
    const fetchImpl = (async () => {
      called = true
      return new Response('{}')
    }) as typeof fetch
    await expect(fetchRecentGames('bad name!', 10, fetchImpl)).rejects.toMatchObject({ kind: 'invalid' })
    expect(called).toBe(false)
  })

  it('reports an account without games', async () => {
    const fetchImpl = mockFetch({ [ARCHIVES]: { archives: [] } })
    await expect(fetchRecentGames('kullanici', 10, fetchImpl)).rejects.toMatchObject({ kind: 'empty' })
  })
})

describe('chessComOutcome', () => {
  it('maps Chess.com result codes', () => {
    expect(chessComOutcome('win')).toBe('win')
    expect(chessComOutcome('repetition')).toBe('draw')
    expect(chessComOutcome('timeout')).toBe('loss')
    expect(chessComOutcome('checkmated')).toBe('loss')
  })
})
