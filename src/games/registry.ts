import type { GameId, GameModule } from '../core/types'
import { chessModule } from './chess'
import { damaModule } from './dama'
import { goModule } from './go'
import { mangalaModule } from './mangala'
import { reversiModule } from './reversi'

/** Playable games, in the order of the home screen tabs. */
export const GAMES: GameModule[] = [
  chessModule as GameModule,
  mangalaModule as GameModule,
  goModule as GameModule,
  damaModule as GameModule,
  reversiModule as GameModule,
]

/** A game played alone, with a page of its own instead of the shared play, analysis and puzzle screens. */
export interface SoloGame {
  id: 'minesweeper'
  slug: string
  name: string
  icon: string
}

export const MINESWEEPER: SoloGame = { id: 'minesweeper', slug: 'mayin-tarlasi', name: 'Mayın Tarlası', icon: '💣' }

/** The home screen tabs: the games against the computer, then Mayın Tarlası. */
export const TABS: (GameModule | SoloGame)[] = [...GAMES, MINESWEEPER]

export const isSoloGame = (tab: GameModule | SoloGame): tab is SoloGame => tab.id === MINESWEEPER.id

/** Shown as "coming soon" tabs until their module exists. */
export const UPCOMING: { name: string; icon: string }[] = []

export function gameBySlug(slug: string | undefined): GameModule | undefined {
  return GAMES.find((game) => game.slug === slug)
}

export function gameById(id: GameId): GameModule | undefined {
  return GAMES.find((game) => game.id === id)
}
