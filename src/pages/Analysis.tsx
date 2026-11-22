import GameList from '../components/GameList'
import GameReview from '../components/GameReview'
import TopBar from '../components/TopBar'
import type { GameModule } from '../core/types'

interface AnalysisProps {
  game: GameModule
  gameId?: string
  initialPly?: number
}

export default function Analysis({ game, gameId, initialPly }: AnalysisProps) {
  if (gameId) return <GameReview game={game} gameId={gameId} initialPly={initialPly} />
  const ImportPanel = game.ImportPanel
  return (
    <div className="page">
      <TopBar title={`${game.name} · Analiz`} />
      <div className="narrow">
        {ImportPanel && <ImportPanel />}
        <GameList game={game} />
      </div>
    </div>
  )
}
