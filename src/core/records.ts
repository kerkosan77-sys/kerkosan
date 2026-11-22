import type { GameEnd, Outcome, Side } from './types'
import type { CoachStats, PlayMode } from '../db/types'

export const MODE_LABELS: Record<PlayMode, string> = { learn: 'Öğrenme modu', play: 'Oynama modu' }

/** "Öğrenme modunda oynandı · Koç 3 kez uyardı, 2 kez geri aldın." (null for imported games) */
export function modeSummary(game: { mode?: PlayMode; coachStats?: CoachStats }): string | null {
  if (game.mode === 'play') return 'Oynama modunda oynandı (yardımsız).'
  if (game.mode !== 'learn') return null
  const stats = game.coachStats
  if (!stats || stats.warnings === 0) return 'Öğrenme modunda oynandı · Koç bu oyunda uyarı vermedi.'
  const takebacks = stats.takebacks === 0 ? 'hiç geri almadın' : `${stats.takebacks} kez geri aldın`
  return `Öğrenme modunda oynandı · Koç ${stats.warnings} kez uyardı, ${takebacks}.`
}

/** PGN-style result where `loser` lost. */
export const lossResult = (loser: Side): GameEnd['result'] => (loser === 'w' ? '0-1' : '1-0')

export function resignation(userSide: Side): GameEnd {
  return {
    result: lossResult(userSide),
    outcome: 'loss',
    title: 'Teslim oldun',
    detail: 'Olur böyle şeyler. Analize bakıp neyin ters gittiğini görelim.',
  }
}

export type RecordOutcome = Outcome | 'unknown'

export function outcomeFor(result: string, side: Side): RecordOutcome {
  if (result === '1/2-1/2') return 'draw'
  if (result === '1-0') return side === 'w' ? 'win' : 'loss'
  if (result === '0-1') return side === 'b' ? 'win' : 'loss'
  return 'unknown'
}

export const OUTCOME_LABELS: Record<RecordOutcome, string> = {
  win: 'Kazandın',
  loss: 'Kaybettin',
  draw: 'Berabere',
  unknown: 'Sonuç yok',
}

export function opponentName(game: { names: Record<Side, string>; userSide: Side }): string {
  return game.userSide === 'w' ? game.names.b : game.names.w
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Short unique id. (crypto.randomUUID is unavailable on plain-http LAN addresses, e.g. phone testing.) */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

/** Colour of a player's dot: the side id unless the game says otherwise (Go: the first player is black). */
export function dotColor(game: { sideColors?: Record<Side, 'w' | 'b'> }, side: Side): 'w' | 'b' {
  return game.sideColors?.[side] ?? side
}
