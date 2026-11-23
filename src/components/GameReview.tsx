import { useEffect, useState } from 'react'
import EvalBar from './EvalBar'
import MoveList, { type MoveItem } from './MoveList'
import TopBar from './TopBar'
import { analysable } from '../core/analysable'
import { analysisVersion } from '../core/analysis/analyzeGame'
import { queueAnalysis, watchAnalysis } from '../core/analysis/background'
import { sortedErrorTypes } from '../core/analysis/summary'
import type { GameAnalysis, MoveAnalysis } from '../core/analysis/types'
import { CLASSIFICATIONS, CLASSIFICATION_INFO, isErrorClass } from '../core/classify'
import { gamePoints, signed } from '../core/stats/points'
import { OUTCOME_LABELS, dotColor, modeSummary, outcomeFor } from '../core/records'
import type { BoardMark, GameModule } from '../core/types'
import { getGame } from '../db/db'
import type { GameRecord } from '../db/types'

/** The user's own inaccuracies, mistakes and blunders: shown from the position before, with arrows. */
const isFlagged = (move: MoveAnalysis | null): move is MoveAnalysis =>
  !!move && move.isUserMove && !!move.bestMove && isErrorClass(move.classification)
const isError = (move: MoveAnalysis) =>
  move.isUserMove && (move.classification === 'mistake' || move.classification === 'blunder')

const percent = (value: number | undefined) => `%${Math.round(value ?? 0)}`

interface GameReviewProps {
  game: GameModule
  gameId: string
  initialPly?: number
}

export default function GameReview({ game: module, gameId, initialPly }: GameReviewProps) {
  const Board = module.Board
  const [record, setRecord] = useState<GameRecord | null | undefined>(undefined)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ply, setPly] = useState(initialPly ?? -1)
  const [showAfter, setShowAfter] = useState(false)

  useEffect(() => {
    let alive = true
    let unwatch: (() => void) | null = null

    ;(async () => {
      const found = await getGame(gameId)
      if (!alive) return
      if (!found || found.gameType !== module.id) {
        setRecord(null)
        return
      }
      setRecord(found)
      if (found.analysis?.version === analysisVersion(module)) return
      // Boards the engine cannot judge: nothing to wait for.
      if (!analysable(module, found.record)) return

      // The analysis runs in the background and saves itself (and its puzzles) even if this page is left.
      setProgress({ done: 0, total: 0 })
      unwatch = watchAnalysis(gameId, (job) => {
        if (!alive) return
        if (job.status === 'error') {
          setProgress(null)
          setError(job.error ?? 'Analiz sırasında bir sorun oluştu.')
        } else if (job.status !== 'done') {
          setProgress({ done: job.done, total: job.total })
        }
      })
      const updated = await queueAnalysis(module, gameId)
      if (!alive || !updated) return
      setRecord(updated)
      setProgress(null)
    })()

    return () => {
      alive = false
      unwatch?.()
    }
  }, [gameId, module])

  const analysis = record?.analysis?.version === analysisVersion(module) ? record.analysis : null
  const moveCount = analysis?.moves.length ?? 0

  function go(target: number) {
    setPly(Math.max(-1, Math.min(moveCount - 1, target)))
    setShowAfter(false)
  }

  function nextError() {
    if (!analysis) return
    const moves = analysis.moves
    const next = moves.find((m) => m.ply > ply && isError(m)) ?? moves.find(isError)
    if (next) go(next.ply)
  }

  useEffect(() => {
    if (!analysis) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'ArrowLeft') go(ply - 1)
      else if (event.key === 'ArrowRight') go(ply + 1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const topBar = <TopBar title={`${module.name} · Analiz`} backTo={`${module.slug}/analiz`} backLabel="Oyunlar" />

  if (record === undefined) {
    return (
      <div className="page">
        {topBar}
        <p className="muted center">Yükleniyor…</p>
      </div>
    )
  }

  if (record === null) {
    return (
      <div className="page">
        {topBar}
        <section className="card">
          <h2>Oyun bulunamadı</h2>
          <p className="muted">Bu oyun kayıtlı değil. Oyunlar listesine dönüp başka bir oyun seçebilirsin.</p>
        </section>
      </div>
    )
  }

  if (!analysis && !analysable(module, record.record)) {
    const points = gamePoints(record).total
    return (
      <div className="page">
        {topBar}
        <section className="card analysis-progress">
          <h2>
            {record.names.w} – {record.names.b}
          </h2>
          <p>{module.noAnalysisNote ?? 'Bu oyunun hamleleri analiz edilmiyor.'}</p>
          <p className="muted small">
            Sonuç: {OUTCOME_LABELS[outcomeFor(record.result, record.userSide)]} · {signed(points)} puan
          </p>
          <a className="btn" href={`#/${module.slug}/analiz`}>
            Oyunlara dön
          </a>
        </section>
      </div>
    )
  }

  if (!analysis) {
    const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <div className="page">
        {topBar}
        <section className="card analysis-progress">
          <h2>
            {record.names.w} – {record.names.b}
          </h2>
          {error ? (
            <p className="error-box">{error}</p>
          ) : (
            <>
              <p>Oyun analiz ediliyor…</p>
              <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <p className="muted small">
                {progress && progress.total > 0 ? `${progress.done} / ${progress.total} pozisyon` : 'Sırada bekliyor…'} · Sayfadan
                çıksan da analiz arka planda sürer; bulmacalar kendiliğinden kaydedilir.
              </p>
            </>
          )}
          <a className="btn" href={`#/${module.slug}/analiz`}>
            Oyunlara dön
          </a>
        </section>
      </div>
    )
  }

  const moves = analysis.moves
  const current = ply >= 0 && ply < moves.length ? moves[ply] : null
  const flagged = isFlagged(current)
  const showBefore = flagged && !showAfter

  let position = moves[0].before
  let lastMove: string | null = null
  let marks: BoardMark[] = []
  if (current) {
    if (showBefore) {
      position = current.before
      lastMove = ply > 0 ? moves[ply - 1].code : null
      marks = [
        { kind: 'played', move: current.code },
        { kind: 'best', move: current.bestMove },
      ]
    } else {
      position = current.after
      lastMove = current.code
      // After the opponent's error: the user's best reply.
      if (!current.isUserMove && isErrorClass(current.classification) && current.replyMove) {
        marks = [{ kind: 'best', move: current.replyMove }]
      }
    }
  }

  const items: MoveItem[] = moves.map((move) => {
    const info = move.classification ? CLASSIFICATION_INFO[move.classification] : null
    return {
      label: move.label,
      side: dotColor(module, move.side),
      badge: info ? { text: info.symbol, className: `badge-${info.className}`, title: info.label } : undefined,
    }
  })

  // The bar shows the user's chances in the position on the board.
  const barWin = current ? ((showBefore ? current.winBefore : current.winAfter) ?? null) : (moves[0].winBefore ?? null)

  const outcome = outcomeFor(record.result, record.userSide)
  const opponentSide = record.userSide === 'w' ? 'b' : 'w'
  const hasErrors = moves.some(isError)

  return (
    <div className="page">
      {topBar}
      <div className={module.wideBoard ? 'game-layout wide' : 'game-layout'}>
        <div className="board-column">
          <div className="player-tag">
            <span className="player-dot" data-color={dotColor(module, opponentSide)} />
            {record.names[opponentSide]}
          </div>
          <div className="board-with-bar">
            <EvalBar win={barWin} userColor={dotColor(module, record.userSide)} />
            <Board
              id="review-board"
              position={position}
              perspective={record.userSide}
              interactive={false}
              lastMove={lastMove}
              marks={marks}
            />
          </div>
          <div className="player-tag">
            <span className="player-dot" data-color={dotColor(module, record.userSide)} />
            {record.names[record.userSide] === 'Sen' ? 'Sen' : `${record.names[record.userSide]} (sen)`} ·{' '}
            {OUTCOME_LABELS[outcome]}
          </div>
          <div className="nav-row">
            <button type="button" className="btn icon" onClick={() => go(-1)} disabled={ply < 0} aria-label="Başa dön">
              ⏮
            </button>
            <button type="button" className="btn icon" onClick={() => go(ply - 1)} disabled={ply < 0} aria-label="Önceki hamle">
              ◀
            </button>
            <button type="button" className="btn icon" onClick={() => go(ply + 1)} disabled={ply >= moveCount - 1} aria-label="Sonraki hamle">
              ▶
            </button>
            <button type="button" className="btn icon" onClick={() => go(moveCount - 1)} disabled={ply >= moveCount - 1} aria-label="Sona git">
              ⏭
            </button>
            <button type="button" className="btn primary" onClick={nextError} disabled={!hasErrors}>
              Sonraki hata
            </button>
          </div>
        </div>

        <aside className="side-panel">
          <MoveCard module={module} move={current} showBefore={showBefore} onToggle={() => setShowAfter((value) => !value)} />
          <SummaryCard module={module} analysis={analysis} modeLine={modeSummary(record)} record={record} />
          <MoveList layout={module.moveListLayout} moves={items} current={ply} onSelect={go} />
        </aside>
      </div>
    </div>
  )
}

function MoveCard({
  module,
  move,
  showBefore,
  onToggle,
}: {
  module: GameModule
  move: MoveAnalysis | null
  showBefore: boolean
  onToggle: () => void
}) {
  if (!move) {
    return (
      <section className="move-card">
        <p className="muted">
          Oyunun başı. Hamleler arasında okla gezin: her hamlenin ne kadar iyi olduğunu ve ne işe yaradığını görürsün. Kendi
          hatalarına doğrudan gitmek için <strong>Sonraki hata</strong>'ya bas.
        </p>
      </section>
    )
  }

  const title = module.moveTitle(move.ply, move.side, move.label)
  const owner = move.isUserMove ? 'Senin hamlen' : 'Rakibin hamlesi'
  if (!move.classification) {
    return (
      <section className="move-card">
        <h3>{title}</h3>
        <p className="muted">{owner}. Bu hamle değerlendirilemedi.</p>
      </section>
    )
  }

  const info = CLASSIFICATION_INFO[move.classification]
  const error = isErrorClass(move.classification)
  const userError = error && move.isUserMove && Boolean(move.bestMove)

  return (
    <section className={`move-card ${info.className}`}>
      <div className="move-card-head">
        <h3>{title}</h3>
        <span className={`class-chip ${info.className}`}>
          {info.symbol} {info.label}
        </span>
      </div>
      <p className="move-owner small">{owner}</p>
      {move.explanation && <p className="explanation">{move.explanation}</p>}
      {error ? (
        <p className="muted small">
          Kazanma şansın: {percent(move.winBefore)} → <strong>{percent(move.winAfter)}</strong>
        </p>
      ) : (
        <p className="muted small">Kazanma şansın: {percent(move.winAfter)}</p>
      )}
      {userError && showBefore && (
        <p className="arrow-legend small">
          <span className="legend-dot played" /> senin hamlen <span className="legend-dot best" /> daha iyisi: {move.bestLabel}
        </p>
      )}
      {userError && (
        <button type="button" className="btn subtle small-btn" onClick={onToggle}>
          {showBefore ? 'Hamlenden sonraki pozisyonu göster' : 'Hamlenden önceki pozisyonu göster'}
        </button>
      )}
      {error && !move.isUserMove && move.replyMove && (
        <p className="arrow-legend small">
          <span className="legend-dot best first" /> yeşil işaret: senin en iyi cevabın
        </p>
      )}
    </section>
  )
}

function SummaryCard({
  module,
  analysis,
  modeLine,
  record,
}: {
  module: GameModule
  analysis: GameAnalysis
  modeLine: string | null
  record: GameRecord
}) {
  const points = gamePoints(record)
  const { counts, errorTypes, topErrorType, opponentCounts: opponent } = analysis.summary
  const errors = counts.mistake + counts.blunder
  const labelOf = (id: string) => module.errorTypes.find((t) => t.id === id)?.label ?? id
  const types = sortedErrorTypes(
    errorTypes,
    module.errorTypes.map((t) => t.id),
  )

  return (
    <section className="card summary-card">
      <h2>Oyun özeti</h2>
      {modeLine && <p className="mode-line muted small">{modeLine}</p>}
      <p className="game-points">
        ⭐ Bu oyunun puanı: <strong>{signed(points.total)}</strong>{" "}
        <span className="muted small">
          (hamleler {signed(points.moves)}
          {points.result !== 0 && `, sonuç ${signed(points.result)}`})
        </span>
      </p>
      <table className="class-table">
        <thead>
          <tr>
            <th scope="col">Hamleler</th>
            <th scope="col">Sen</th>
            <th scope="col">Rakip</th>
          </tr>
        </thead>
        <tbody>
          {CLASSIFICATIONS.filter((c) => c !== 'forced' || (counts.forced ?? 0) + (opponent?.forced ?? 0) > 0).map((c) => (
            <tr key={c} className={c}>
              <th scope="row">
                <span className={`badge badge-${CLASSIFICATION_INFO[c].className}`}>{CLASSIFICATION_INFO[c].symbol}</span>
                {CLASSIFICATION_INFO[c].label}
              </th>
              <td>{counts[c] ?? 0}</td>
              <td>{opponent ? (opponent[c] ?? 0) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {errors === 0 ? (
        <p>Bu oyunda hata ya da büyük hata yapmadın. Harika!</p>
      ) : (
        <>
          {topErrorType && (
            <p>
              En sık yaptığın hata türü: <strong>{labelOf(topErrorType)}</strong> ({errorTypes[topErrorType]} kez)
            </p>
          )}
          {types.length > 1 && (
            <ul className="error-type-list">
              {types.map(([type, count]) => (
                <li key={type}>
                  {labelOf(type)}: {count}
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">
            Bu oyundaki {errors} hata ve büyük hata bulmaca bankana eklendi. Bulmaca bölümünde tekrar çözebilirsin.
          </p>
        </>
      )}
    </section>
  )
}
