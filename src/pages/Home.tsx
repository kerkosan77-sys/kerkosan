import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type TouchEvent } from 'react'
import FullscreenButton from '../components/FullscreenButton'
import SoundButton from '../components/SoundButton'
import { analyseMissing } from '../core/analysis/background'
import {
  cameBackFromGoogle,
  cameBackQuietly,
  cloudConfigured,
  connectAndSync,
  disconnect,
  finishSignIn,
  needsTap,
  signInQuietlyIfNeeded,
  syncQuietly,
  useCloudState,
  type SyncResult,
} from '../core/cloud'
import { canPromptInstall, isInstalledApp, onInstallChange, promptInstall } from '../core/install'
import { duePuzzles } from '../core/puzzles/leitner'
import { OUTCOME_LABELS, type RecordOutcome } from '../core/records'
import { playerSummary, type PlayerSummary } from '../core/stats/player'
import { MOVE_POINTS, RESULT_POINTS, signed } from '../core/stats/points'
import { pointsRank, rangeText, rankLadder } from '../core/stats/rank'
import { CLASSIFICATION_INFO, type Classification } from '../core/classify'
import { setGameTheme } from '../core/theme'
import { navigate } from '../router'
import { PHASE_LABELS, type GameModule, type GamePhase } from '../core/types'
import { backupFileName, restoredText } from '../db/backup'
import {
  exportBackup,
  importBackup,
  listGames,
  loadLessonProgress,
  listPuzzles,
  loadAppSettings,
  readBackup,
  updateAppSettings,
} from '../db/db'
import { GAMES, UPCOMING, gameById } from '../games/registry'

interface Progress {
  gameId: string
  summary: PlayerSummary
  due: number
  lessonsDone: number
}

export default function Home() {
  const [selected, setSelected] = useState<GameModule | null>(null)
  /** Every game's summary, loaded up front so switching games is instant. */
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  // Just back from Google's sign-in page: the sync window opens and finishes the sync.
  const [panel, setPanel] = useState<'data' | 'install' | 'cloud' | 'ranks' | null>(() => (cameBackFromGoogle() ? 'cloud' : null))
  /** Bumped after a backup is loaded so the progress card is read again. */
  const [dataVersion, setDataVersion] = useState(0)

  useEffect(() => {
    loadAppSettings().then((settings) => setSelected(gameById(settings.lastGame) ?? GAMES[0]))
    // Games never analysed (for example finished while the app was closed) get analysed now, so their puzzles exist.
    listGames()
      .then((games) => analyseMissing(games, (record) => gameById(record.gameType)))
      .catch(() => undefined)
    // Google sync: bring in what the other devices saved. Back from a quiet sign-in, finish it; with a
    // valid token, just sync; connected but without one, renew it at Google's page without asking anything.
    const refresh = (result: SyncResult | null) => result && (result.games > 0 || result.puzzles > 0) && setDataVersion((v) => v + 1)
    if (cameBackQuietly()) void finishSignIn().then(refresh).catch(() => undefined)
    else if (!cameBackFromGoogle() && !signInQuietlyIfNeeded()) void syncQuietly().then(refresh)
  }, [])

  useEffect(() => {
    let alive = true
    for (const game of GAMES) {
      Promise.all([listGames(game.id), listPuzzles(game.id), loadLessonProgress(game.id)])
        .then(([games, puzzles, lessons]) => {
          if (!alive) return
          const entry: Progress = {
            gameId: game.id,
            summary: playerSummary(games, game),
            due: duePuzzles(puzzles, Date.now()).length,
            lessonsDone: lessons.length,
          }
          setProgress((all) => ({ ...all, [game.id]: entry }))
        })
        .catch(() => undefined)
    }
    return () => {
      alive = false
    }
  }, [dataVersion])

  // The whole app takes the selected game's colour.
  useEffect(() => {
    if (selected) setGameTheme(selected.id)
  }, [selected])

  function choose(game: GameModule) {
    setSelected(game)
    void updateAppSettings({ lastGame: game.id })
  }

  /** The next (step 1) or previous (step -1) game, going round. */
  function step(by: 1 | -1) {
    if (!selected) return
    const index = (GAMES.indexOf(selected) + by + GAMES.length) % GAMES.length
    setSelected(GAMES[index])
    void updateAppSettings({ lastGame: GAMES[index].id })
  }

  // Keyboard: ← → switch games, Enter starts playing (when nothing else has the focus).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (panel || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'ArrowRight') step(1)
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'Enter' && selected && (target === document.body || target === null)) navigate(`${selected.slug}/oyna`)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Touch: swipe left or right across the screen to switch games.
  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || panel) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
  }

  const current = selected ? (progress[selected.id] ?? null) : null

  return (
    <div className="home-screen" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="home-top">
        <div className="home-brand">
          <span className="logo" aria-hidden="true">
            🧠
          </span>
          <div>
            <h1>Akıl Oyunları Koçu</h1>
            <p className="muted home-tagline">Puan yok, sıralama yok. Sadece her gün biraz daha iyi oynamak.</p>
          </div>
        </div>
        <div className="home-tools">
          <SoundButton />
          <FullscreenButton />
        </div>
      </header>

      <div className="game-tabs" role="tablist" aria-label="Oyun seçimi">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            role="tab"
            aria-selected={selected?.id === game.id}
            className={selected?.id === game.id ? 'selected' : ''}
            onClick={() => choose(game)}
          >
            <span className="game-tab-icon" aria-hidden="true">
              {game.icon}
            </span>
            {game.name}
          </button>
        ))}
        {UPCOMING.map((game) => (
          <button key={game.name} type="button" role="tab" aria-selected={false} disabled className="upcoming">
            <span className="game-tab-icon" aria-hidden="true">
              {game.icon}
            </span>
            {game.name}
            <small>yakında</small>
          </button>
        ))}
      </div>

      <main className="home-main">
        {selected && (
          <>
            <nav className="home-buttons">
              <HomeButton
                href={`#/${selected.slug}/oyna`}
                icon="♟"
                title="Oyna"
                text={current ? `Sana uygun bot: ${current.summary.recommended}. seviye · ${levelName(selected, current.summary.recommended)}` : 'Bilgisayara karşı, kendi seviyende oyna'}
                className="play"
              />
              {selected.lessons && selected.lessons.length > 0 && (
                <HomeButton
                  href={`#/${selected.slug}/dersler`}
                  icon="📘"
                  title="Dersler"
                  text={lessonText(selected.lessons.length, current?.lessonsDone ?? 0)}
                  className="lessons"
                />
              )}
              <HomeButton href={`#/${selected.slug}/analiz`} icon="🔍" title="Analiz" text="Her oyunu ayrıntılı incele" />
              <HomeButton
                href={`#/${selected.slug}/bulmaca`}
                icon="🧩"
                title="Bulmaca"
                text={current && current.due > 0 ? `Bugün ${current.due} bulmaca seni bekliyor` : 'Kendi hatalarından öğren'}
                badge={current?.due || undefined}
              />
            </nav>
            <PlayerCard game={selected} progress={current} onShowRanks={() => setPanel('ranks')} />
          </>
        )}
      </main>

      <footer className="home-footer">
        <button type="button" className="btn subtle footer-btn" onClick={() => setPanel('cloud')}>
          ☁️ Eşitle
          {needsTap() && <span className="cloud-alert" title="Otomatik kayıt için bir kez dokun">!</span>}
        </button>
        <button type="button" className="btn subtle footer-btn" onClick={() => setPanel('data')}>
          💾 Verilerin
        </button>
        {!isInstalledApp() && (
          <button type="button" className="btn subtle footer-btn" onClick={() => setPanel('install')}>
            <span className="label-long">⬇ Uygulamayı kur</span>
            <span className="label-short">⬇ Kur</span>
          </button>
        )}
      </footer>

      {panel && (
        <Modal title={panel === 'ranks' && selected ? `${PANEL_TITLES.ranks} · ${selected.name}` : PANEL_TITLES[panel]} onClose={() => setPanel(null)}>
          {panel === 'data' && <DataCard onRestored={() => setDataVersion((v) => v + 1)} />}
          {panel === 'install' && <InstallCard />}
          {panel === 'cloud' && <CloudCard onSynced={() => setDataVersion((v) => v + 1)} />}
          {panel === 'ranks' && selected && <RankCard game={selected} points={current?.summary.points ?? 0} />}
        </Modal>
      )}
    </div>
  )
}

function HomeButton({
  href,
  icon,
  title,
  text,
  className = '',
  badge,
}: {
  href: string
  icon: string
  title: string
  text: string
  className?: string
  badge?: number
}) {
  return (
    <a href={href} className={`big-button ${className}`}>
      <span className="big-button-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="big-button-text">
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      {badge !== undefined && <span className="count-badge">{badge}</span>}
    </a>
  )
}

const levelName = (game: GameModule, id: number) => game.levels.find((l) => l.id === id)?.name ?? `Seviye ${id}`

const PHASE_WHERE: Record<GamePhase, string> = {
  opening: 'oyun başında',
  middlegame: 'oyun ortasında',
  endgame: 'oyun sonunda',
}

const RESULT_SYMBOL: Record<RecordOutcome, string> = { win: '✓', loss: '✗', draw: '=', unknown: '…' }

const oneDecimal = (value: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
const shortDate = (timestamp: number) => new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

/**
 * The player's summary for the selected game: playing level and the bot to play, the part of the
 * game that goes wrong most, what to watch out for, and the latest games (details are in Analiz).
 */
function PlayerCard({ game, progress, onShowRanks }: { game: GameModule; progress: Progress | null; onShowRanks: () => void }) {
  if (!progress) return <section className="player-card" aria-busy="true" />
  const summary = progress.summary
  const tips: string[] = []
  if (summary.weakest && game.phaseTips) tips.push(game.phaseTips[summary.weakest])
  for (const [type] of summary.topErrors) {
    const tip = game.errorTypes.find((e) => e.id === type)?.tip
    if (tip && !tips.includes(tip)) tips.push(tip)
  }
  const hasPhases = summary.phases.some((p) => p.moves > 0)
  const top = Math.max(1, ...summary.phases.map((p) => p.per10))
  const rank = pointsRank(summary.points, game.id, game.levels)

  return (
    <section className="player-card">
      <div className="player-head">
        <h2>
          Oyuncu özeti<span className="player-game-name"> · {game.name}</span>
        </h2>
        <button type="button" className="points-badge" onClick={onShowRanks} title="Puan düzeylerini gör">
          ⭐ {summary.points.toLocaleString('tr-TR')} puan
          {summary.lastPoints !== null && summary.lastPoints !== 0 && (
            <small className={summary.lastPoints > 0 ? 'up' : 'down'}>{signed(summary.lastPoints)}</small>
          )}
        </button>
      </div>
      <div className="player-levels">
        <button type="button" className="level-box rank-box" onClick={onShowRanks} title="Puan düzeylerini gör">
          <span>Puan düzeyin</span>
          <strong>
            <span className="rank-number">{rank.level}. düzey · </span>
            {rank.name}
          </strong>
          <span className="rank-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(rank.progress * 100)}%` }} />
          </span>
          <small>{rank.next ? `${rank.next.name} düzeyine ${rank.toNext.toLocaleString('tr-TR')} puan kaldı` : 'En üst düzeydesin!'}</small>
        </button>
        <div className="level-box suggested">
          <span>Sana uygun bot</span>
          <strong>
            {summary.recommended}. seviye · {levelName(game, summary.recommended)}
          </strong>
          <small>{summary.reason}</small>
        </div>
      </div>

      {summary.errorRate !== null && (
        <p className="trend-line">
          📈 Son oyunlarda 10 hamlede <strong>{oneDecimal(summary.errorRate)}</strong> hata
          {summary.previousErrorRate !== null &&
            (summary.errorRate < summary.previousErrorRate - 0.05
              ? ` (önce ${oneDecimal(summary.previousErrorRate)}): gelişiyorsun!`
              : summary.errorRate > summary.previousErrorRate + 0.05
                ? ` (önce ${oneDecimal(summary.previousErrorRate)}): biraz geriledin, acele etme.`
                : ' (önceki oyunlarla aynı).')}
        </p>
      )}

      <div className="player-block phase-block">
        <h3 title="Sayılar: 10 hamlede yapılan hata ve büyük hata.">Oyunun aşamaları · 10 hamlede hata</h3>
        {hasPhases ? (
          <>
            <ul className="phase-bars">
              {summary.phases.map((p) => (
                <li key={p.phase} className={p.phase === summary.weakest ? 'weak' : ''}>
                  <span className="phase-name">{PHASE_LABELS[p.phase]}</span>
                  <span className="phase-bar">
                    <span style={{ width: `${(p.per10 / top) * 100}%` }} />
                  </span>
                  <span className="phase-value">{p.moves === 0 ? '–' : oneDecimal(p.per10)}</span>
                </li>
              ))}
            </ul>
            <p className="muted small phase-note">
              {summary.weakest ? `En çok ${PHASE_WHERE[summary.weakest]} zorlanıyorsun.` : 'Belirgin bir zayıf aşaman yok.'}
            </p>
          </>
        ) : (
          <p className="muted small">Oyunların analiz edildikçe hangi aşamada zorlandığın burada görünecek.</p>
        )}
      </div>

      {tips.length > 0 && (
        <div className="player-block player-tips-block">
          <h3>Dikkat et</h3>
          <ul className="player-tips">
            {tips.slice(0, 2).map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="player-block player-recent">
        <h3>Son oyunların</h3>
        {summary.recent.length === 0 ? (
          <p className="muted small">Henüz oyun yok. Oyna düğmesiyle başla!</p>
        ) : (
          <ul>
            {summary.recent.map((g) => (
              <li key={g.id}>
                <a href={`#/${game.slug}/analiz/${g.id}`}>
                  <span className={`result-dot ${g.outcome}`} aria-hidden="true">
                    {RESULT_SYMBOL[g.outcome]}
                  </span>
                  <span className="recent-main">
                    {OUTCOME_LABELS[g.outcome]} · {g.level !== null ? `${g.level}. seviye (${levelName(game, g.level)})` : 'dışarıdan eklenen oyun'}
                  </span>
                  <span className="recent-meta">
                    <span className={g.points > 0 ? 'up' : g.points < 0 ? 'down' : ''}>{signed(g.points)}</span> ·{' '}
                    {g.errors !== null ? `${g.errors} hata` : 'analiz bekliyor'} · {shortDate(g.createdAt)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** Backup and restore: the data lives only in this browser, so this is how it moves or survives. */
function DataCard({ onRestored }: { onRestored: () => void }) {
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const backup = await exportBackup()
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName(new Date())
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setMessage({ text: `Yedek dosyası indirildi (${backup.games.length} oyun, ${backup.puzzles.length} bulmaca). İndirilenler klasörüne bak.` })
    } catch {
      setMessage({ text: 'Yedek alınamadı. Sayfayı yenileyip tekrar dene.', error: true })
    } finally {
      setBusy(false)
    }
  }

  async function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Bu dosya bir yedek için fazla büyük.')
      const result = await importBackup(readBackup(await file.text()))
      setMessage({ text: restoredText(result) })
      onRestored()
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Yedek yüklenemedi.', error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="data-card">
      <h2>Verilerin</h2>
      <p className="muted small">
        Oyunların ve bulmacaların yalnızca bu cihazda, bu tarayıcıda ya da uygulamada saklanır. Başka bir yere taşımak ya
        da kaybolmasın diye saklamak için yedek al; yedeği yüklemek buradaki hiçbir şeyi silmez.
      </p>
      <div className="button-row">
        <button type="button" className="btn" onClick={save} disabled={busy}>
          Yedekle
        </button>
        <label className={`btn file-btn${busy ? ' disabled' : ''}`}>
          Yedeği yükle
          <input type="file" accept=".json,application/json" onChange={load} disabled={busy} />
        </label>
      </div>
      {message && (
        <p className={`small ${message.error ? 'error-text' : ''}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}

/**
 * Shown in a browser tab only: installing the app keeps games and puzzles in the app's own storage
 * and lets it open without the server or internet.
 */
function InstallCard() {
  const [, rerender] = useState(0)
  const [installed, setInstalled] = useState(isInstalledApp())
  useEffect(() => onInstallChange(() => rerender((n) => n + 1)), [])

  if (installed) return null
  if (import.meta.env.DEV) {
    return (
      <section className="install-card">
        <h2>Uygulama olarak kur</h2>
        <p className="muted small">
          Bu, geliştirme sürümü. Kurulabilir uygulama için proje klasöründe <code>npm.cmd run app</code> komutunu çalıştır ve açılan
          sayfadaki <strong>Uygulamayı kur</strong> düğmesine bas. Kurulan uygulamada oyunların ve bulmacaların kalıcı olarak saklanır.
        </p>
      </section>
    )
  }
  return (
    <section className="install-card">
      <h2>Uygulama olarak kur</h2>
      <p className="muted small">
        Şu an tarayıcıda açıksın. Uygulama olarak kurarsan masaüstünde simgesi olur, internetsiz açılır ve oyunların, bulmacaların
        kalıcı olarak saklanır.
      </p>
      {canPromptInstall() ? (
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            void promptInstall().then((accepted) => accepted && setInstalled(true))
          }}
        >
          Uygulamayı kur
        </button>
      ) : (
        <p className="small">
          Kurmak için adres çubuğundaki <strong>yükle</strong> simgesine bas. Edge'de: <strong>⋯ → Uygulamalar → Bu siteyi uygulama
          olarak yükle</strong>.
        </p>
      )}
    </section>
  )
}

function lessonText(total: number, done: number): string {
  if (done === 0) return 'Temel bilgileri adım adım öğren'
  if (done >= total) return 'Bütün dersleri bitirdin ✓'
  return `${done} / ${total} ders tamamlandı · devam et`
}

/** A small window over the home screen (data and backup, installing the app). Esc or the backdrop closes it. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn subtle modal-close" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const PANEL_TITLES = { data: 'Verilerin', install: 'Uygulama olarak kur', cloud: 'Google ile eşitleme', ranks: 'Puan düzeyleri' } as const

function syncedText(result: SyncResult): string {
  if (result.games === 0 && result.puzzles === 0) return 'Eşitlendi. Her şey güncel.'
  const parts = [result.games > 0 && `${result.games} oyun`, result.puzzles > 0 && `${result.puzzles} bulmaca`].filter(Boolean)
  return `Eşitlendi. Bu cihaza ${parts.join(' ve ')} geldi.`
}

function sinceText(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'az önce'
  if (minutes < 60) return `${minutes} dakika önce`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} saat önce`
  return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

/** Google sign-in and sync: the same games, puzzles and lessons on every device. */
function CloudCard({ onSynced }: { onSynced: () => void }) {
  const state = useCloudState()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  // Back from Google's sign-in page: finish the sync (or say why the sign-in did not work).
  useEffect(() => {
    if (!cameBackFromGoogle()) return
    setBusy(true)
    finishSignIn()
      .then((result) => {
        if (!result) return
        setMessage({ text: syncedText(result) })
        onSynced()
      })
      .catch((error: unknown) => setMessage({ text: error instanceof Error ? error.message : 'Eşitlenemedi.', error: true }))
      .finally(() => setBusy(false))
  }, [onSynced])

  if (!cloudConfigured()) {
    return (
      <section className="cloud-card">
        <p className="muted small">
          Google ile eşitleme henüz kurulmadı. Kurulum adımları README dosyasının "Google ile eşitleme" bölümünde.
        </p>
      </section>
    )
  }

  function sync() {
    setBusy(true)
    setMessage(null)
    // Not signed in during this visit: the app goes to Google's page and comes back by itself.
    connectAndSync()
      .then((result) => {
        if (!result) {
          setMessage({ text: "Google'a gidiliyor…" })
          return
        }
        setMessage({ text: syncedText(result) })
        onSynced()
        setBusy(false)
      })
      .catch((error: unknown) => {
        setMessage({ text: error instanceof Error ? error.message : 'Eşitlenemedi.', error: true })
        setBusy(false)
      })
  }

  return (
    <section className="cloud-card">
      <p className="muted small">
        Oyunların, bulmacaların ve derslerin Google Drive'ında, yalnızca bu uygulamanın görebildiği gizli bir klasörde saklanır. Aynı
        Google hesabıyla bağlandığın her cihazda aynı kayıtları görürsün. Eşitleme hiçbir şeyi silmez.
      </p>
      {state.email && (
        <p className="small">
          Bağlı hesap: <strong>{state.email}</strong>
          {state.lastSync !== null && <> · Son kayıt: {sinceText(state.lastSync)}</>}
        </p>
      )}
      {state.email && (
        <p className="small ok-text">
          ✓ Otomatik kayıt açık: her oyundan, bulmacadan ve dersten sonra kendiliğinden kaydedilir; uygulama açılınca diğer
          cihazların kayıtları gelir.
        </p>
      )}
      {needsTap() && (
        <p className="small error-text">Google bağlantısı yenilenemedi. Otomatik kaydın sürmesi için bir kez "Şimdi eşitle"ye bas.</p>
      )}
      <div className="button-row">
        <button type="button" className="btn primary" onClick={sync} disabled={busy}>
          {busy ? 'Bekle…' : state.email ? 'Şimdi eşitle' : 'Google ile bağlan'}
        </button>
        {state.email && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              disconnect()
              setMessage({ text: "Bu cihazın bağlantısı kesildi. Drive'daki kayıtların duruyor." })
            }}
          >
            Bağlantıyı kes
          </button>
        )}
      </div>
      {message && (
        <p className={`small ${message.error ? 'error-text' : 'ok-text'}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}

/** Moves that change the points, best first (moves worth 0 are left out). */
const POINT_MOVES = (Object.keys(MOVE_POINTS) as Classification[]).filter((c) => MOVE_POINTS[c] !== 0)

/** Every level of the game with its points range, where the user is, and how points are earned. */
function RankCard({ game, points }: { game: GameModule; points: number }) {
  const rank = pointsRank(points, game.id, game.levels)
  return (
    <section className="rank-card">
      <p className="small">
        <strong>{points.toLocaleString('tr-TR')} puan</strong> ile <strong>{rank.name}</strong> düzeyindesin.
        {rank.next && <> {rank.next.name} için {rank.toNext.toLocaleString('tr-TR')} puan daha topla.</>}
      </p>
      <ol className="rank-ladder">
        {rankLadder(game.id, game.levels)
          .slice()
          .reverse()
          .map((step) => (
            <li key={step.level} className={step.level === rank.level ? 'current' : step.level < rank.level ? 'passed' : ''}>
              <span className="rank-name">
                {step.level}. {step.name}
              </span>
              <span className="rank-range">{rangeText(step)}</span>
              {step.level === rank.level && <span className="rank-here">sen buradasın</span>}
            </li>
          ))}
      </ol>
      <h3>Puan nasıl kazanılır?</h3>
      <p className="muted small">
        Her hamlen analiz edilir:{' '}
        {POINT_MOVES.map((c) => `${CLASSIFICATION_INFO[c].label} ${signed(MOVE_POINTS[c])}`).join(', ')}; İyi ve Çok iyi hamleler 0. Asıl
        puan sonuçtan gelir: bilgisayarı yenmek {RESULT_POINTS.win} × bot seviyesi kadar puan getirir, berabere {RESULT_POINTS.draw} × bot
        seviyesi, kaybetmek {RESULT_POINTS.loss} × (9 − bot seviyesi) kadar götürür: güçlü bota kazanmak daha değerli, zayıf bota
        kaybetmek daha pahalı. Hamlesi çok olan oyunlarda aralıklar biraz daha geniş.
      </p>
    </section>
  )
}
