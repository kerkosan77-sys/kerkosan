import { useEffect } from 'react'
import { setGameTheme } from './core/theme'
import { useRoute } from './router'
import { MINESWEEPER, gameBySlug } from './games/registry'
import Home from './pages/Home'
import Play from './pages/Play'
import Analysis from './pages/Analysis'
import Puzzles from './pages/Puzzles'
import Lessons from './pages/Lessons'
import Minesweeper from './pages/Minesweeper'

/** Addresses from the chess-only version ("#/oyna", "#/analiz/<id>") now live under "#/satranc/...". */
const LEGACY_PAGES = ['oyna', 'analiz', 'bulmaca']

export default function App() {
  const segments = useRoute()
  const legacy = segments[0] !== undefined && LEGACY_PAGES.includes(segments[0])

  useEffect(() => {
    if (legacy) window.location.replace(`#/satranc/${segments.map(encodeURIComponent).join('/')}`)
  }, [legacy, segments])

  const [slug, page, param, extra] = legacy ? ['satranc', ...segments] : segments
  const game = gameBySlug(slug)
  // Each game's pages use its colour (the home screen sets it for the selected game).
  const solo = slug === MINESWEEPER.slug
  useEffect(() => {
    if (game) setGameTheme(game.id)
    else if (solo) setGameTheme(MINESWEEPER.id)
  }, [game, solo])
  if (solo) return <Minesweeper />
  if (!game) return <Home />

  switch (page) {
    case 'oyna':
      return <Play key={game.id} game={game} />
    case 'analiz': {
      const ply = extra !== undefined && /^\d+$/.test(extra) ? Number(extra) : undefined
      return <Analysis key={`${game.id}/${param ?? ''}/${extra ?? ''}`} game={game} gameId={param} initialPly={ply} />
    }
    case 'bulmaca':
      return <Puzzles key={game.id} game={game} />
    case 'dersler':
      return <Lessons key={`${game.id}/${param ?? ''}`} game={game} lessonId={param} />
    default:
      return <Home />
  }
}
