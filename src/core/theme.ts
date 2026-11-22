import type { GameId } from './types'

/** Colours the whole app in the game's own colour (see :root[data-game] in styles.css). */
export function setGameTheme(game: GameId): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.game = game
}
