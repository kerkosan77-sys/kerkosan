import { useEffect, useState } from 'react'
import { MODE_LABELS, OUTCOME_LABELS, dotColor, formatDate, opponentName, outcomeFor } from '../core/records'
import type { GameModule } from '../core/types'
import { listGames } from '../db/db'
import type { GameRecord, GameSource } from '../db/types'

const SOURCE_LABELS: Record<GameSource, string> = {
  play: 'Uygulamada',
  pgn: 'PGN',
  chesscom: 'Chess.com',
  sgf: 'SGF',
}

export default function GameList({ game }: { game: GameModule }) {
  const [games, setGames] = useState<GameRecord[] | null>(null)

  useEffect(() => {
    listGames(game.id).then(setGames)
  }, [game.id])

  if (!games) return null

  return (
    <section className="card">
      <h2>Oyunların</h2>
      {games.length === 0 ? (
        <p className="muted">
          Henüz {game.name.toLocaleLowerCase('tr-TR')} oyunu yok.{' '}
          {game.ImportPanel ? 'Yukarıdan bir oyun ekle ya da' : 'Önce'} <a href={`#/${game.slug}/oyna`}>Oyna</a> bölümünde bir oyun
          oyna.
        </p>
      ) : (
        <ul className="game-list">
          {games.map((record) => {
            const outcome = outcomeFor(record.result, record.userSide)
            const counts = record.analysis?.summary.counts
            return (
              <li key={record.id}>
                <a href={`#/${game.slug}/analiz/${record.id}`} className="game-row">
                  <div className="game-row-main">
                    <strong>
                      <span className="player-dot" data-color={dotColor(game, record.userSide)} /> vs {opponentName(record)}
                    </strong>
                    <small className="muted">
                      {formatDate(record.playedAt ?? record.createdAt)} · {SOURCE_LABELS[record.source]}
                      {record.mode && <> · {MODE_LABELS[record.mode]}</>}
                    </small>
                  </div>
                  <div className="game-row-side">
                    <span className={`outcome ${outcome}`}>{OUTCOME_LABELS[outcome]}</span>
                    <small className="muted">
                      {counts ? `${counts.blunder} büyük hata · ${counts.mistake} hata` : 'Analiz edilmedi'}
                    </small>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
