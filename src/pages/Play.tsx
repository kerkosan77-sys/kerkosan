import { useEffect, useRef, useState } from 'react'
import EvalBar from '../components/EvalBar'
import MoveList from '../components/MoveList'
import Toggle from '../components/Toggle'
import TopBar from '../components/TopBar'
import { useLiveCoach, type LiveCoach } from '../components/useLiveCoach'
import { holdAnalysis, queueAnalysis, watchAnalysis, type AnalysisJob } from '../core/analysis/background'
import { autoSave } from '../core/cloud'
import { CLASSIFICATION_INFO, isErrorClass } from '../core/classify'
import { moveSound, sounds } from '../core/sound'
import { cachedProgress, loadProgress } from '../core/stats/homeCache'
import { pointsTotal, signed } from '../core/stats/points'
import { pointsRank, type PointsRank } from '../core/stats/rank'
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
    text: 'Koç her hamleden önce kısa bir not verir, hamleleri analiz eder ve kimin önde olduğunu gösterir. Bir şey kaptıracak bir hamlede seni uyarır; hamleni geri alabilirsin.',
  },
  {
    value: 'play',
    icon: '♟',
    title: 'Oynama modu',
    text: 'Yardım yok, gerçek bir oyun gibi. Oyun yine kaydedilir ve analiz edilebilir.',
  },
]

type Phase = 'loading' | 'setup' | 'playing'

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
  /** Learning mode: the warning about the user's last move (the move is played anyway; it can be taken back). */
  const [lastWarning, setLastWarning] = useState<CoachWarning | null>(null)
  /** Bumped whenever the warning shown would no longer fit (new move, take-back, new game). */
  const warningToken = useRef(0)
  /** The state before each move of this game, newest last: "Geri al" goes back through them. */
  const undoStack = useRef<unknown[]>([])
  const [gameKey, setGameKey] = useState(0)
  /** Go, learning mode: the likely territory is shown on the board. */
  const [showTerritory, setShowTerritory] = useState(false)
  /** The bot level the player summary suggests (marked in the level list). */
  const [suggested, setSuggested] = useState<number | null>(null)
  const [endJob, setEndJob] = useState<AnalysisJob | null>(null)
  /** The points total and level after the finished game, and the level before it. */
  const [endRank, setEndRank] = useState<EndRank | null>(null)
  /** The finished game (with its analysis) was saved to Google Drive. */
  const [cloudSaved, setCloudSaved] = useState(false)

  // While a game is on, earlier games' analyses wait (the computer and the coach need the engines).
  useEffect(() => {
    if (phase === 'playing' && !end) return holdAnalysis()
  }, [phase, end])

  // The finished game is analysed in the background; its puzzles are saved by themselves.
  useEffect(() => {
    setEndJob(null)
    setEndRank(null)
    setCloudSaved(false)
    if (!savedGameId) return
    let alive = true
    const stop = watchAnalysis(savedGameId, (job) => {
      setEndJob(job)
      if (job.status === 'error') void autoSave()
      if (job.status !== 'done' && job.status !== 'unsupported') return
      // The finished game and its analysis go to Google Drive by themselves.
      void autoSave().then((saved) => alive && setCloudSaved(saved))
      listGames(game.id)
        .then((games) => {
          if (!alive) return
          const { total, perGame } = pointsTotal(games)
          const before = pointsRank(total - (perGame.get(savedGameId) ?? 0), game.id, game.levels)
          setEndRank({ total, rank: pointsRank(total, game.id, game.levels), previousLevel: before.level })
        })
        .catch(() => undefined)
    })
    return () => {
      alive = false
      stop()
    }
  }, [savedGameId, game])

  // Learning mode: the coach's own engine looks at every position as the game goes.
  const liveState = stateRef.current
  // Boards the engine cannot judge (Go 13×13 and 19×19): no move analysis and no advantage bar.
  const judged = !game.canAnalyse || game.canAnalyse(game.position(liveState))
  const coachOn = phase === 'playing' && gameMode === 'learn' && !!settings?.liveAnalysis && engineState === 'ready' && judged
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
    // The bot to suggest comes from the stored player summary (reading every game again would be slow).
    const known = cachedProgress(game.id)
    if (known) setSuggested(known.summary.recommended)
    else
      loadProgress(game)
        .then((progress) => alive && setSuggested(progress.summary.recommended))
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
      state = record ? game.stateFromRecord(record) : game.newState({ boardSize: settings?.boardSize })
    } catch {
      state = game.newState({ boardSize: settings?.boardSize })
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
    clearWarning()
    undoStack.current = []
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
    clearWarning()
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
    undoStack.current.push(stateRef.current)
    stateRef.current = next
    const played = game.history(next)
    const last = played[played.length - 1]
    moveSound(game.id, last?.label, last && game.stonesPlaced?.(last.before, last.code))
    setVersion((v) => v + 1)
    const ending = game.end(next, userSideRef.current)
    if (ending) void finish(ending)
    else persist()
    return true
  }

  function clearWarning() {
    warningToken.current++
    setLastWarning(null)
  }

  /** Learning mode: the coach's warning for a move that gives something away (null when it is safe or the warning is off). */
  function warningFor(move: string, before: unknown = stateRef.current): CoachWarning | null {
    if (modeRef.current !== 'learn' || !settings?.dangerWarning) return null
    return game.coachWarning(before, move)
  }

  function handleUserMove(move: string): boolean {
    if (phase !== 'playing' || end || thinking) return false
    const state = stateRef.current
    if (game.turn(state) !== userSideRef.current) return false
    // The move is played right away; a risky one gets a short warning and can be taken back.
    if (!applyMove(move)) return false
    clearWarning()
    // The check is worked out just after the move is drawn, so the board never waits for it.
    const token = warningToken.current
    window.setTimeout(() => {
      if (token !== warningToken.current) return
      const warning = warningFor(move, state)
      if (!warning || token !== warningToken.current) return
      statsRef.current.warnings++
      setLastWarning(warning)
    }, 30)
    return true
  }

  /** Takes back the user's last move (and the computer's reply), even while the computer is thinking. */
  function takeBack() {
    if (phase !== 'playing' || end) return
    const stack = undoStack.current
    let target: unknown = null
    while (stack.length > 0) {
      const earlier = stack.pop()!
      if (game.turn(earlier) === userSideRef.current) {
        target = earlier
        break
      }
    }
    if (target === null) return
    engine.cancelAll()
    stateRef.current = target
    statsRef.current.takebacks++
    clearWarning()
    setThinking(false)
    setConfirmPass(false)
    setShowTerritory(false)
    setVersion((v) => v + 1)
    persist()
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
                  </span>
                </label>
              ))}
            </div>
          </section>

          {game.boardSizes && <BoardSizeChoice game={game} value={settings.boardSize} onChange={(boardSize) => updateSettings({ boardSize })} />}

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
  const canMove = !end && !thinking && engineState === 'ready'
  const canTakeBack = gameMode === 'learn' && !end && undoStack.current.some((earlier) => game.turn(earlier) === userSide)
  const userToMove = !end && !thinking && game.turn(state) === userSide
  // Games counted at the end (Go): after a counted finish the user may correct dead stones.
  const scoringOpen = Boolean(end?.marks && game.scoring)
  const passOption = game.pass
  const territory = showTerritory && game.territory && gameMode === 'learn' && !end ? game.territory(state) : null
  // Go: passing too early is the one warning shown before the move, inside the pass confirmation.
  const passWarning = confirmPass && game.pass ? warningFor(game.pass.move) : null

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
              position={position}
              perspective={userSide}
              interactive={canMove && game.turn(state) === userSide}
              onMove={handleUserMove}
              lastMove={lastMove}
              marks={end?.marks ?? passWarning?.marks ?? territory?.marks}
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
              {endJob && <EndAnalysisStatus job={endJob} rank={endRank} cloudSaved={cloudSaved} />}
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
          ) : (
            <>
              <div className={`status-box${errorText ? ' error' : ''}`}>{status}</div>
              {lastWarning && (
                <p className="warning-note" role="status">
                  ⚠️ {lastWarning.text}
                </p>
              )}
              {gameMode === 'learn' && (
                <div className="button-row takeback-row">
                  <button type="button" className={`btn${lastWarning ? ' primary' : ''}`} onClick={takeBack} disabled={!canTakeBack}>
                    ↶ Geri al
                  </button>
                </div>
              )}
              {passOption &&
                userToMove &&
                engineState === 'ready' &&
                (confirmPass ? (
                  <div className="confirm-row">
                    {passWarning && <p className="warning-note">⚠️ {passWarning.text}</p>}
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
                  coach={settings.liveAnalysis && judged ? coach : null}
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
        label={game.warningLabel.title}
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
  // The note depends only on the position, and some games search a little to write it: it is worked
  // out only when it is shown (the user's turn) and just after the board is drawn, so a move never waits for it.
  const [note, setNote] = useState<{ position: string; text: string | null } | null>(null)
  useEffect(() => {
    if (!showTip || note?.position === position) return
    let timer = 0
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setNote({ position, text: game.coachTip?.(state) ?? game.coachQuestions(state)[0] ?? null }))
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
    // state goes with the position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, position, showTip])
  const baseTip = note?.position === position ? note.text : null

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

interface EndRank {
  total: number
  rank: PointsRank
  previousLevel: number
}

/** "Toplam 340 puan · Kolay+ düzeyi (Orta'ya 160 puan kaldı)", with a cheer when the game moved the player up a level. */
function rankText({ total, rank, previousLevel }: EndRank): string {
  const where = `Toplam ${total.toLocaleString('tr-TR')} puan · ${rank.level}. düzey ${rank.name}`
  const left = rank.next ? ` (${rank.next.name} düzeyine ${rank.toNext.toLocaleString('tr-TR')} puan kaldı).` : ' (en üst düzey).'
  if (rank.level > previousLevel) return `🎉 Tebrikler, ${rank.name} düzeyine çıktın! ${where}${left}`
  if (rank.level < previousLevel) return `${where}${left} Bir düzey indin: acele etme, tekrar çıkarsın.`
  return `${where}${left}`
}

/** Progress of the background analysis of the game that just ended, how many puzzles it saved, and the points level. */
function EndAnalysisStatus({ job, rank, cloudSaved }: { job: AnalysisJob; rank: EndRank | null; cloudSaved: boolean }) {
  if (job.status === 'error') return <p className="end-analysis error">Analiz yapılamadı: {job.error}</p>
  if (job.status === 'unsupported') {
    return (
      <div className="end-analysis done">
        <p>
          ✓ Oyun kaydedildi.{job.points !== undefined && ` Sonucundan ${signed(job.points)} puan.`} Bu tahta boyutunda hamle analizi
          yapılmıyor.
        </p>
        {rank && <p className={`end-rank${rank.rank.level > rank.previousLevel ? ' level-up' : ''}`}>{rankText(rank)}</p>}
        {cloudSaved && <p className="end-cloud">☁️ Google Drive'a kaydedildi.</p>}
      </div>
    )
  }
  if (job.status === 'done') {
    const n = job.newPuzzles ?? 0
    return (
      <div className="end-analysis done">
        <p>
          ✓ Analiz hazır.{job.points !== undefined && ` Bu oyundan ${signed(job.points)} puan.`}{' '}
          {n > 0 ? `Hatalarından ${n} yeni bulmaca kaydedildi.` : 'Bu oyundan yeni bulmaca çıkmadı: büyük bir hata yapmadın.'}
        </p>
        {rank && <p className={`end-rank${rank.rank.level > rank.previousLevel ? ' level-up' : ''}`}>{rankText(rank)}</p>}
        {cloudSaved && <p className="end-cloud">☁️ Google Drive'a kaydedildi.</p>}
      </div>
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

/** Board sizes (Go): small for learning, the full board for real games. */
function BoardSizeChoice({ game, value, onChange }: { game: GameModule; value?: number; onChange: (size: number) => void }) {
  const sizes = game.boardSizes ?? []
  const current = sizes.find((s) => s.value === value) ?? sizes[0]
  return (
    <section className="card">
      <h2>Tahta boyutu</h2>
      <div className="segmented" role="radiogroup" aria-label="Tahta boyutu">
        {sizes.map((size) => (
          <button
            key={size.value}
            type="button"
            role="radio"
            aria-checked={current?.value === size.value}
            className={current?.value === size.value ? 'selected' : ''}
            onClick={() => onChange(size.value)}
          >
            {size.label}
          </button>
        ))}
      </div>
      {current && <p className="muted small board-size-note">{current.note}</p>}
    </section>
  )
}
