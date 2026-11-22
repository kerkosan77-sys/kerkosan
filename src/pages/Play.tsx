import { useEffect, useMemo, useRef, useState } from 'react'
import EvalBar from '../components/EvalBar'
import MoveList from '../components/MoveList'
import Toggle from '../components/Toggle'
import TopBar from '../components/TopBar'
import { useLiveCoach, type LiveCoach } from '../components/useLiveCoach'
import { queueAnalysis, watchAnalysis, type AnalysisJob } from '../core/analysis/background'
import { syncQuietly } from '../core/cloud'
import { CLASSIFICATION_INFO, isErrorClass } from '../core/classify'
import { moveSound, sounds } from '../core/sound'
import { playerSummary } from '../core/stats/player'
import { signed } from '../core/stats/points'
import { EngineCancelledError } from '../core/engine'
import { MODE_LABELS, dotColor, newId, resignation } from '../core/records'
import type { CoachWarning, GameEnd, GameModule, Level, MoveRecord, Side } from '../core/types'
import {
  clearSavedPlay,
  listGames,
  loadGameSettings,
  loadSavedPlay,
  saveGame,
  saveGameSettings,
  saveSavedPlay,
} from '../db/db'
import type { CoachStats, GameRecord, GameSettings, PlayMode, SavedPlay } from '../db/types'
import { navigate } from '../router'

const MIN_THINK_MS = 450

const MODE_OPTIONS: { value: PlayMode; icon: string; title: string; text: string }[] = [
  {
    value: 'learn',
    icon: '🎓',
    title: 'Öğrenme modu',
    text: 'Koç her hamleden önce kısa bir not verir, hamleleri analiz eder ve kimin önde olduğunu gösterir. Bir şey kaptıracak bir hamlede seni uyarır.',
  },
  {
    value: 'play',
    icon: '♟',
    title: 'Oynama modu',
    text: 'Yardım yok, gerçek bir oyun gibi. Oyun yine kaydedilir ve analiz edilebilir.',
  },
]

type Phase = 'loading' | 'setup' | 'playing'

/** A move held back by the coach until the user confirms or takes it back. */
interface PendingMove {
  move: string
  position: string
  warning: CoachWarning
}

function levelOf(game: GameModule, id: number): Level {
  return game.levels.find((level) => level.id === id) ?? game.levels[0]
}

export default function Play({ game }: { game: GameModule }) {
  const engine = game.engine('play')
  const Board = game.Board
  const [phase, setPhase] = useState<Phase>('loading')
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [saved, setSaved] = useState<SavedPlay | null>(null)

  const stateRef = useRef<unknown>(game.newState())
  const userSideRef = useRef<Side>('w')
  const levelRef = useRef(game.defaultLevel)
  const startedAtRef = useRef(Date.now())
  // The mode is fixed for a game once it starts, so its saved data stays meaningful.
  const modeRef = useRef<PlayMode>('learn')
  const statsRef = useRef<CoachStats>({ warnings: 0, takebacks: 0 })
  // The finished game as saved, so end-of-game corrections (Go dead stones) can update it.
  const savedRecordRef = useRef<GameRecord | null>(null)

  // Bumped after every move so effects and rendering see the new state in stateRef.
  const [version, setVersion] = useState(0)
  const [gameMode, setGameMode] = useState<PlayMode>('learn')
  const [userSide, setUserSide] = useState<Side>('w')
  const [levelId, setLevelId] = useState(game.defaultLevel)
  const [thinking, setThinking] = useState(false)
  const [end, setEnd] = useState<GameEnd | null>(null)
  const [savedGameId, setSavedGameId] = useState<string | null>(null)
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorText, setErrorText] = useState<string | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const [confirmPass, setConfirmPass] = useState(false)
  const [pending, setPending] = useState<PendingMove | null>(null)
  const [gameKey, setGameKey] = useState(0)
  /** Go, learning mode: the likely territory is shown on the board. */
  const [showTerritory, setShowTerritory] = useState(false)
  /** The bot level the player summary suggests (marked in the level list). */
  const [suggested, setSuggested] = useState<number | null>(null)
  const [endJob, setEndJob] = useState<AnalysisJob | null>(null)

  // The finished game is analysed in the background; its puzzles are saved by themselves.
  useEffect(() => {
    setEndJob(null)
    if (!savedGameId) return
    return watchAnalysis(savedGameId, (job) => {
      setEndJob(job)
      // Signed in to Google during this visit: the finished game goes to the other devices too.
      if (job.status === 'done') void syncQuietly()
    })
  }, [savedGameId])

  // Learning mode: the coach's own engine looks at every position as the game goes.
  const liveState = stateRef.current
  const coachOn = phase === 'playing' && gameMode === 'learn' && !!settings?.liveAnalysis && engineState === 'ready'
  const coach = useLiveCoach({
    game,
    enabled: coachOn,
    gameKey,
    history: game.history(liveState),
    position: game.position(liveState),
    turn: game.turn(liveState),
    userSide,
  })

  useEffect(() => {
    let alive = true
    Promise.all([loadGameSettings(game.id, game.defaultLevel), loadSavedPlay(game.id)]).then(([loaded, play]) => {
      if (!alive) return
      setSettings(loaded)
      setSaved(play ?? null)
      setPhase('setup')
    })
    listGames(game.id)
      .then((games) => alive && setSuggested(playerSummary(games, game).recommended))
      .catch(() => undefined)
    engine
      .start()
      .then(() => alive && setEngineState('ready'))
      .catch((error: Error) => {
        if (!alive) return
        setEngineState('error')
        setErrorText(error.message)
      })
    return () => {
      alive = false
      engine.cancelAll()
    }
  }, [game, engine])

  function updateSettings(patch: Partial<GameSettings>) {
    if (!settings) return
    const next = { ...settings, ...patch }
    setSettings(next)
    void saveGameSettings(game.id, next)
  }

  function persist() {
    void saveSavedPlay(game.id, {
      record: game.stateToRecord(stateRef.current),
      userSide: userSideRef.current,
      level: levelRef.current,
      startedAt: startedAtRef.current,
      mode: modeRef.current,
      coachStats: { ...statsRef.current },
    })
  }

  function startGame(
    side: Side,
    level: number,
    mode: PlayMode,
    record?: string,
    startedAt = Date.now(),
    stats: CoachStats = { warnings: 0, takebacks: 0 },
  ) {
    let state: unknown
    try {
      state = record ? game.stateFromRecord(record) : game.newState()
    } catch {
      state = game.newState()
    }
    engine.cancelAll()
    void engine.newGame().catch(() => undefined)

    stateRef.current = state
    userSideRef.current = side
    levelRef.current = level
    startedAtRef.current = startedAt
    modeRef.current = mode
    statsRef.current = { ...stats }

    setGameMode(mode)
    setUserSide(side)
    setLevelId(level)
    setEnd(null)
    setSavedGameId(null)
    savedRecordRef.current = null
    setConfirmResign(false)
    setConfirmPass(false)
    setPending(null)
    setThinking(false)
    setSaved(null)
    setGameKey((k) => k + 1)
    setShowTerritory(false)
    setVersion((v) => v + 1)
    setPhase('playing')
    persist()
  }

  function handleStart() {
    if (!settings) return
    const choice = settings.sideChoice
    const side: Side = choice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : choice
    startGame(side, settings.level, settings.mode)
  }

  async function finish(ending: GameEnd) {
    setEnd(ending)
    if (ending.outcome === 'win') window.setTimeout(sounds.good, 250)
    else if (ending.outcome === 'loss') window.setTimeout(sounds.bad, 250)
    setConfirmResign(false)
    setConfirmPass(false)
    setPending(null)
    engine.cancelAll()
    await clearSavedPlay(game.id)

    // Re-read the state: the user may already have corrected the count while this was saving.
    const state = stateRef.current
    if (game.history(state).length === 0) return
    const result = (game.end(state, userSideRef.current) ?? ending).result
    const side = userSideRef.current
    const bot = `${game.engineName} (${levelOf(game, levelRef.current).name})`
    const names = side === 'w' ? { w: 'Sen', b: bot } : { w: bot, b: 'Sen' }
    const record: GameRecord = {
      id: newId(),
      gameType: game.id,
      createdAt: Date.now(),
      source: 'play',
      record: game.stateToRecord(state, { names, result, date: new Date(startedAtRef.current) }),
      userSide: side,
      names,
      result,
      level: levelRef.current,
      mode: modeRef.current,
      ...(modeRef.current === 'learn' ? { coachStats: { ...statsRef.current } } : {}),
    }
    await saveGame(record)
    savedRecordRef.current = record
    setSavedGameId(record.id)
    void queueAnalysis(game, record.id)
  }

  /** Go: the user taps a group after the game to count it as dead (or alive again). */
  function toggleDead(square: string) {
    if (!game.scoring) return
    const next = game.scoring.toggle(stateRef.current, square)
    if (!next) return
    const ending = game.end(next, userSideRef.current)
    if (!ending) return
    stateRef.current = next
    setEnd(ending)
    setVersion((v) => v + 1)
    const saved = savedRecordRef.current
    if (saved) {
      const updated: GameRecord = {
        ...saved,
        record: game.stateToRecord(next, { names: saved.names, result: ending.result, date: new Date(startedAtRef.current) }),
        result: ending.result,
        analysis: undefined,
      }
      savedRecordRef.current = updated
      void saveGame(updated).then(() => queueAnalysis(game, updated.id))
    }
  }

  function applyMove(move: string): boolean {
    const next = game.play(stateRef.current, move)
    if (next === null) return false
    stateRef.current = next
    const played = game.history(next)
    moveSound(played[played.length - 1]?.label)
    setVersion((v) => v + 1)
    const ending = game.end(next, userSideRef.current)
    if (ending) void finish(ending)
    else persist()
    return true
  }

  function handleUserMove(move: string): boolean {
    if (phase !== 'playing' || end || thinking || pending) return false
    const state = stateRef.current
    if (game.turn(state) !== userSideRef.current) return false

    // Learning mode: hold back a move that gives something away when a safer move exists.
    if (modeRef.current === 'learn' && settings?.dangerWarning) {
      const warning = game.coachWarning(state, move)
      if (warning) {
        const preview = game.play(state, move)
        if (preview === null) return false
        statsRef.current.warnings++
        setPending({ move, position: game.position(preview), warning })
        return true
      }
    }
    return applyMove(move)
  }

  function takeBack() {
    statsRef.current.takebacks++
    setPending(null)
    persist()
  }

  function confirmPending() {
    if (!pending) return
    const move = pending.move
    setPending(null)
    applyMove(move)
  }

  // Computer's turn (possibly several moves in a row in games with extra turns).
  useEffect(() => {
    if (phase !== 'playing' || end || engineState !== 'ready') return
    const state = stateRef.current
    if (game.turn(state) === userSide || game.end(state, userSide)) return

    let cancelled = false
    const started = performance.now()
    setThinking(true)
    engine
      .chooseMove(game.position(state), levelId)
      .then(async (move) => {
        const wait = Math.max(MIN_THINK_MS, game.computerDelayMs) - (performance.now() - started)
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
        if (cancelled) return
        setThinking(false)
        if (move) applyMove(move)
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof EngineCancelledError) return
        setThinking(false)
        setErrorText(error instanceof Error ? error.message : 'Bilgisayar hamle bulamadı.')
      })
    return () => {
      cancelled = true
    }
    // applyMove only touches refs and state setters, so it is intentionally not a dependency.
  }, [version, phase, end, engineState, userSide, levelId, game, engine])

  const title = `${game.name} · Oyna`

  if (phase === 'loading' || !settings) {
    return (
      <div className="page">
        <TopBar title={title} />
        <p className="muted center">Yükleniyor…</p>
      </div>
    )
  }

  if (phase === 'setup') {
    let savedSummary: string | null = null
    if (saved) {
      try {
        const history = game.history(game.stateFromRecord(saved.record))
        const last = history[history.length - 1]
        savedSummary = last ? `Son hamle: ${game.moveTitle(history.length - 1, last.side, last.label)}` : 'Henüz hamle yok'
      } catch {
        savedSummary = null
      }
    }
    return (
      <div className="page">
        <TopBar title={title} />
        <div className="setup">
          {saved && savedSummary && (
            <section className="card resume-card">
              <h2>Yarım kalan bir oyunun var</h2>
              <p className="muted">
                {savedSummary} · {levelOf(game, saved.level).name} · {game.sideLabels[saved.userSide]} ·{' '}
                {MODE_LABELS[saved.mode ?? 'learn']}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    startGame(saved.userSide, saved.level, saved.mode ?? 'learn', saved.record, saved.startedAt, saved.coachStats)
                  }
                >
                  Devam et
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSaved(null)
                    void clearSavedPlay(game.id)
                  }}
                >
                  Sil
                </button>
              </div>
            </section>
          )}

          {game.rules && (
            <details className="card rules-card" open={!saved}>
              <summary>{game.rules.title}</summary>
              <ol>
                {game.rules.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </details>
          )}

          <section className="card">
            <h2>Zorluk</h2>
            <div className="level-list">
              {game.levels.map((level) => (
                <label key={level.id} className={`level-option${settings.level === level.id ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="level"
                    checked={settings.level === level.id}
                    onChange={() => updateSettings({ level: level.id })}
                  />
                  <span className="level-number">{level.id}</span>
                  <span className="level-text">
                    <strong>
                      {level.name}
                      {suggested === level.id && <span className="level-chip">Sana uygun</span>}
                    </strong>
                    <small>{level.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>{game.sideChoiceTitle}</h2>
            <div className="segmented" role="radiogroup" aria-label={game.sideChoiceTitle}>
              {game.sideChoices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={settings.sideChoice === choice.value}
                  className={settings.sideChoice === choice.value ? 'selected' : ''}
                  onClick={() => updateSettings({ sideChoice: choice.value })}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Nasıl oynamak istersin?</h2>
            <div className="mode-options" role="radiogroup" aria-label="Oyun modu">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={settings.mode === option.value}
                  className={`mode-option${settings.mode === option.value ? ' selected' : ''}`}
                  onClick={() => updateSettings({ mode: option.value })}
                >
                  <span className="mode-icon" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span className="mode-text">
                    <strong>{option.title}</strong>
                    <small>{option.text}</small>
                  </span>
                </button>
              ))}
            </div>
            {settings.mode === 'learn' && (
              <div className="mode-details">
                <p className="muted small">Öğrenme modunda açık olacaklar:</p>
                <CoachToggles game={game} settings={settings} onChange={updateSettings} />
              </div>
            )}
            <p className="muted small mode-note">İki modda da oyun kaydedilir; analizde hangi modda oynadığın görünür.</p>
          </section>

          {engineState === 'error' && <p className="error-box">{errorText}</p>}
          <button type="button" className="btn primary big" onClick={handleStart}>
            Oyunu başlat
          </button>
        </div>
      </div>
    )
  }

  const level = levelOf(game, levelId)
  const state = stateRef.current
  const position = game.position(state)
  const history = game.history(state)
  const lastMove = history.length > 0 ? history[history.length - 1].code : null
  const canMove = !end && !thinking && !pending && engineState === 'ready'
  const userToMove = !end && !thinking && game.turn(state) === userSide
  // Games counted at the end (Go): after a counted finish the user may correct dead stones.
  const scoringOpen = Boolean(end?.marks && game.scoring)
  const passOption = game.pass
  const territory = showTerritory && game.territory && gameMode === 'learn' && !end && !pending ? game.territory(state) : null

  let status: string
  if (engineState === 'loading') status = 'Bilgisayar hazırlanıyor…'
  else if (errorText) status = errorText
  else if (thinking) status = 'Bilgisayar düşünüyor…'
  else status = game.statusNote(state, userSide) ?? 'Sıra sende.'

  return (
    <div className="page">
      <TopBar title={title} />
      <div className={game.wideBoard ? 'game-layout wide' : 'game-layout'}>
        <div className="board-column">
          <div className="player-tag">
            <span className="player-dot" data-color={dotColor(game, userSide === 'w' ? 'b' : 'w')} />
            Bilgisayar · {level.name}
            {thinking && <span className="thinking">düşünüyor…</span>}
          </div>
          <div className="board-with-bar">
            {coachOn && <EvalBar win={coach.win} userColor={dotColor(game, userSide)} />}
            <Board
              id="board"
              position={pending ? pending.position : position}
              perspective={userSide}
              interactive={canMove && game.turn(state) === userSide}
              onMove={handleUserMove}
              lastMove={pending ? pending.move : lastMove}
              marks={end?.marks ?? pending?.warning.marks ?? territory?.marks}
              onMark={scoringOpen ? toggleDead : undefined}
            />
          </div>
          <div className="player-tag">
            <span className="player-dot" data-color={dotColor(game, userSide)} />
            Sen · {game.sideLabels[userSide]}
            <span className={`mode-chip ${gameMode}`}>{MODE_LABELS[gameMode]}</span>
          </div>
        </div>

        <aside className="side-panel">
          {end ? (
            <section className={`end-panel ${end.outcome}`}>
              <h2>{end.title}</h2>
              <p>{end.detail}</p>
              {scoringOpen && game.scoring && <p className="muted small">{game.scoring.help}</p>}
              {endJob && <EndAnalysisStatus job={endJob} />}
              {savedGameId && (
                <button
                  type="button"
                  className="btn primary big"
                  onClick={() => navigate(`${game.slug}/analiz/${savedGameId}`)}
                >
                  Bu oyunu analiz et
                </button>
              )}
              <div className="button-row">
                <button type="button" className="btn" onClick={() => setPhase('setup')}>
                  Yeni oyun
                </button>
                <a className="btn" href="#/">
                  Ana ekran
                </a>
              </div>
            </section>
          ) : pending ? (
            <section className="warning-card" role="alert">
              <h2>⚠️ Dikkat!</h2>
              <p>{pending.warning.text}</p>
              {pending.warning.marks.length > 0 && (
                <p className="muted small">{pending.warning.note ?? 'Kırmızı işaretler tehlikeyi gösteriyor.'}</p>
              )}
              <div className="button-row">
                <button type="button" className="btn primary" onClick={takeBack}>
                  Hamlemi geri al
                </button>
                <button type="button" className="btn" onClick={confirmPending}>
                  Yine de oyna
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className={`status-box${errorText ? ' error' : ''}`}>{status}</div>
              {passOption &&
                userToMove &&
                engineState === 'ready' &&
                (confirmPass ? (
                  <div className="confirm-row">
                    <span>{passOption.confirm(state)}</span>
                    <div className="button-row">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          setConfirmPass(false)
                          handleUserMove(passOption.move)
                        }}
                      >
                        Evet, pas geç
                      </button>
                      <button type="button" className="btn" onClick={() => setConfirmPass(false)}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="button-row pass-row">
                    <button type="button" className="btn pass-btn" onClick={() => setConfirmPass(true)}>
                      Pas geç
                    </button>
                    {game.territory && gameMode === 'learn' && (
                      <button
                        type="button"
                        className={`btn territory-btn${showTerritory ? ' primary' : ''}`}
                        aria-pressed={showTerritory}
                        onClick={() => setShowTerritory((on) => !on)}
                      >
                        {showTerritory ? 'Alanı gizle' : 'Alanı göster'}
                      </button>
                    )}
                  </div>
                ))}
              {territory && <p className="territory-text">{territory.text}</p>}
              {gameMode === 'learn' && (settings.coachMode || settings.liveAnalysis) && engineState === 'ready' && (
                <CoachPanel
                  game={game}
                  state={state}
                  position={position}
                  history={history}
                  userSide={userSide}
                  showTip={settings.coachMode && userToMove}
                  coach={settings.liveAnalysis ? coach : null}
                />
              )}
            </>
          )}

          <MoveList
            layout={game.moveListLayout}
            moves={history.map((move) => ({ label: move.label, side: dotColor(game, move.side) }))}
          />

          {!end &&
            (confirmResign ? (
              <div className="confirm-row">
                <span>Teslim olmak istediğine emin misin?</span>
                <div className="button-row">
                  <button type="button" className="btn danger" onClick={() => void finish(resignation(userSide))}>
                    Evet, teslim ol
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirmResign(false)}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn subtle"
                onClick={() => setConfirmResign(true)}
                disabled={history.length === 0}
              >
                Teslim ol
              </button>
            ))}

          {!end && gameMode === 'learn' && (
            <details className="coach-settings">
              <summary>Koç ayarları</summary>
              <CoachToggles game={game} settings={settings} onChange={updateSettings} />
            </details>
          )}
        </aside>
      </div>
    </div>
  )
}

function CoachToggles({
  game,
  settings,
  onChange,
}: {
  game: GameModule
  settings: GameSettings
  onChange: (patch: Partial<GameSettings>) => void
}) {
  return (
    <div className="toggle-list">
      <Toggle
        label="Koçun notu"
        description="Her hamleden önce neye dikkat etmen gerektiğini kısaca söyler. Oynaman gereken hamleyi söylemez."
        checked={settings.coachMode}
        onChange={(coachMode) => onChange({ coachMode })}
      />
      <Toggle
        label="Hamle analizi ve üstünlük çubuğu"
        description="Her hamleden sonra hamlenin ne kadar iyi olduğunu anlatır; tahtanın yanındaki çubuk kimin önde olduğunu gösterir."
        checked={settings.liveAnalysis}
        onChange={(liveAnalysis) => onChange({ liveAnalysis })}
      />
      <Toggle
        label={`${game.warningLabel.title} ve geri alma`}
        description={game.warningLabel.description}
        checked={settings.dangerWarning}
        onChange={(dangerWarning) => onChange({ dangerWarning })}
      />
    </div>
  )
}

/**
 * Learning mode coach: a short note before the user's move (never the move itself) and, below it,
 * the analysis of the latest moves: the user's last move and the computer's replies.
 */
function CoachPanel({
  game,
  state,
  position,
  history,
  userSide,
  showTip,
  coach,
}: {
  game: GameModule
  state: unknown
  position: string
  history: MoveRecord[]
  userSide: Side
  showTip: boolean
  coach: LiveCoach | null
}) {
  // The note depends only on the position (and some games search a little to write it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const baseTip = useMemo(() => game.coachTip?.(state) ?? game.coachQuestions(state)[0] ?? null, [game, position])

  const lastUser = history.map((m) => m.side).lastIndexOf(userSide)
  const first = lastUser >= 0 ? lastUser : 0
  const entries = coach ? history.slice(first).map((move, k) => ({ ply: first + k, move, analysis: coach.moves.get(first + k) })) : []
  const lastOpponent = [...entries].reverse().find((e) => e.move.side !== userSide)
  const punish = lastOpponent?.analysis?.classification === 'mistake' || lastOpponent?.analysis?.classification === 'blunder'
  const tip = showTip ? (punish ? 'Rakip hata yaptı! Bunu cezalandıracak hamleyi bul.' : baseTip) : null

  if (!tip && entries.length === 0) return null
  return (
    <section className="coach-card" aria-live="polite">
      {tip && (
        <p className="coach-tip">
          <span className="coach-tip-icon" aria-hidden="true">
            💡
          </span>
          {tip}
        </p>
      )}
      {entries.length > 0 && (
        <div className="coach-moves">
          <h3>Hamle analizi</h3>
          {entries.map(({ ply, move, analysis }) => {
            const info = analysis?.classification ? CLASSIFICATION_INFO[analysis.classification] : null
            const error = isErrorClass(analysis?.classification)
            return (
              <div key={ply} className={`coach-move ${info?.className ?? 'waiting'}`}>
                <div className="coach-move-head">
                  <span className="coach-move-who">{move.side === userSide ? 'Senin hamlen' : 'Rakip'}</span>
                  <strong>{move.label}</strong>
                  {info && (
                    <span className={`class-chip ${info.className}`}>
                      {info.symbol} {info.label}
                    </span>
                  )}
                </div>
                <p>{analysis ? analysis.explanation : 'Koç inceliyor…'}</p>
                {analysis && error && (
                  <p className="coach-move-win">
                    Kazanma şansın: %{Math.round(analysis.winBefore ?? 0)} → %{Math.round(analysis.winAfter ?? 0)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/** Progress of the background analysis of the game that just ended, and how many puzzles it saved. */
function EndAnalysisStatus({ job }: { job: AnalysisJob }) {
  if (job.status === 'error') return <p className="end-analysis error">Analiz yapılamadı: {job.error}</p>
  if (job.status === 'done') {
    const n = job.newPuzzles ?? 0
    return (
      <p className="end-analysis done">
        ✓ Analiz hazır.{job.points !== undefined && ` Bu oyundan ${signed(job.points)} puan.`}{' '}
        {n > 0 ? `Hatalarından ${n} yeni bulmaca kaydedildi.` : 'Bu oyundan yeni bulmaca çıkmadı: büyük bir hata yapmadın.'}
      </p>
    )
  }
  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0
  return (
    <div className="end-analysis">
      <p>Oyun analiz ediliyor, hatalarından bulmacalar hazırlanıyor… {job.total > 0 ? `%${pct}` : ''}</p>
      <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
