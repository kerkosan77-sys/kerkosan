import { useEffect, useRef, useState } from 'react'
import TopBar from '../components/TopBar'
import { EngineCancelledError } from '../core/engine'
import { checkAnswer, engineEvaluator } from '../core/puzzles/checkAnswer'
import { explainSolution, winChangeText } from '../core/puzzles/explainSolution'
import { moveSound, sounds } from '../core/sound'
import { BOX_INTERVAL_DAYS, boxCounts, duePuzzles, nextDueAt, relativeDay, schedule } from '../core/puzzles/leitner'
import { formatDate, opponentName } from '../core/records'
import { PHASE_LABELS, type BoardMark, type GameModule, type GamePhase } from '../core/types'
import { autoSave } from '../core/cloud'
import { addAttempt, getGame, listPuzzles, savePuzzle } from '../db/db'
import type { AttemptResult, GameRecord, PuzzleRecord } from '../db/types'

type Phase = 'loading' | 'empty' | 'menu' | 'solving' | 'finished'
type Section = GamePhase | 'all'

const SECTIONS: { id: GamePhase; icon: string; text: string }[] = [
  { id: 'opening', icon: '🌱', text: 'İlk hamleler: taşlarını oyuna sokarken yaptığın hatalar.' },
  { id: 'middlegame', icon: '⚔️', text: 'Oyunun en karışık yeri: taktikler ve saldırılar.' },
  { id: 'endgame', icon: '🏁', text: 'Az taş kaldığında: oyunu bitirmeyi öğren.' },
]

export default function Puzzles({ game }: { game: GameModule }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [all, setAll] = useState<PuzzleRecord[]>([])
  const [queue, setQueue] = useState<PuzzleRecord[]>([])
  const [section, setSection] = useState<Section>('all')
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<AttemptResult[]>([])

  useEffect(() => {
    const engine = game.engine('coach')
    engine.start().catch(() => undefined)
    listPuzzles(game.id).then((puzzles) => {
      setAll(puzzles)
      setPhase(puzzles.length === 0 ? 'empty' : 'menu')
    })
    return () => engine.cancelAll()
  }, [game])

  /** Puzzles saved before phases existed get theirs from the position. */
  const phaseOf = (puzzle: PuzzleRecord): GamePhase => puzzle.phase ?? game.phaseOf?.(puzzle.position, puzzle.ply) ?? 'middlegame'

  function begin(which: Section) {
    const pool = which === 'all' ? all : all.filter((p) => phaseOf(p) === which)
    const due = duePuzzles(pool, Date.now())
    // Nothing due today: practise the section anyway, the ones due soonest first.
    const list = due.length > 0 ? due : [...pool].sort((a, b) => a.dueAt - b.dueAt)
    if (list.length === 0) return
    setSection(which)
    setQueue(list)
    setIndex(0)
    setResults([])
    setPhase('solving')
  }

  function handleReviewed(updated: PuzzleRecord, result: AttemptResult) {
    setResults((list) => [...list, result])
    setAll((list) => list.map((p) => (p.id === updated.id ? updated : p)))
  }

  function next() {
    if (index + 1 >= queue.length) setPhase('finished')
    else setIndex(index + 1)
  }

  let content
  if (phase === 'loading') {
    content = <p className="muted center">Yükleniyor…</p>
  } else if (phase === 'empty') {
    content = <EmptyBank game={game} />
  } else if (phase === 'menu') {
    content = <SectionMenu puzzles={all} phaseOf={phaseOf} onStart={begin} />
  } else if (phase === 'finished') {
    content = <FinishedScreen game={game} puzzles={all} results={results} onBack={() => setPhase('menu')} />
  } else {
    const puzzle = queue[index]
    content = (
      <>
        <div className="puzzle-section-bar">
          <button type="button" className="btn subtle small-btn" onClick={() => setPhase('menu')}>
            ← Bölümler
          </button>
          <span className="muted small">{section === 'all' ? 'Bugünkü tekrar' : PHASE_LABELS[section]}</span>
        </div>
        <PuzzleSolver
          key={puzzle.id}
          game={game}
          puzzle={puzzle}
          number={index + 1}
          total={queue.length}
          isLast={index + 1 >= queue.length}
          onReviewed={handleReviewed}
          onNext={next}
        />
      </>
    )
  }

  return (
    <div className="page">
      <TopBar title={`${game.name} · Bulmaca`} />
      {content}
    </div>
  )
}

/** The three sections (opening, middlegame, endgame) with how many puzzles each has and how many are due. */
function SectionMenu({
  puzzles,
  phaseOf,
  onStart,
}: {
  puzzles: PuzzleRecord[]
  phaseOf: (puzzle: PuzzleRecord) => GamePhase
  onStart: (section: Section) => void
}) {
  const now = Date.now()
  const allDue = duePuzzles(puzzles, now).length
  const next = nextDueAt(puzzles, now)
  return (
    <div className="puzzle-menu">
      <section className="card puzzle-today">
        {allDue > 0 ? (
          <>
            <h2>Bugün {allDue} bulmaca seni bekliyor</h2>
            <button type="button" className="btn primary big" onClick={() => onStart('all')}>
              Bugünkü tekrara başla
            </button>
          </>
        ) : (
          <>
            <h2>Bugünlük tekrarın bitti</h2>
            <p className="muted">
              {next !== null ? <>Sıradaki bulmaca {relativeDay(next, now)} hazır olacak. </> : null}
              İstersen aşağıdan bir bölüm seçip yine de çözebilirsin.
            </p>
          </>
        )}
      </section>

      <div className="section-cards">
        {SECTIONS.map(({ id, icon, text }) => {
          const pool = puzzles.filter((p) => phaseOf(p) === id)
          const due = duePuzzles(pool, now).length
          return (
            <button key={id} type="button" className="section-card" disabled={pool.length === 0} onClick={() => onStart(id)}>
              <span className="section-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="section-text">
                <strong>{PHASE_LABELS[id]}</strong>
                <small>{text}</small>
                <small className="section-count">
                  {pool.length === 0 ? 'Henüz bulmaca yok' : `${pool.length} bulmaca${due > 0 ? ` · bugün ${due} tekrar` : ''}`}
                </small>
              </span>
              {due > 0 && <span className="count-badge">{due}</span>}
            </button>
          )
        })}
      </div>

      <BoxOverview puzzles={puzzles} />
      <p className="muted small center">Bulmacalar oyunlarındaki hatalardan kendiliğinden oluşur: her oyun bittiğinde analiz arka planda yapılır ve yeni bulmacalar buraya kaydedilir.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

type Status = 'ready' | 'checking' | 'wrong' | 'solved' | 'failed'

interface SolverProps {
  game: GameModule
  puzzle: PuzzleRecord
  number: number
  total: number
  isLast: boolean
  onReviewed: (updated: PuzzleRecord, result: AttemptResult) => void
  onNext: () => void
}

function PuzzleSolver({ game, puzzle, number, total, isLast, onReviewed, onNext }: SolverProps) {
  const Board = game.Board
  const startMove = puzzle.prevMove ?? null
  const [source, setSource] = useState<GameRecord | null>(null)
  const [status, setStatus] = useState<Status>('ready')
  /** Wrong tries so far; the hint comes after the third. */
  const [wrongs, setWrongs] = useState(0)
  const [position, setPosition] = useState(puzzle.position)
  const [lastMove, setLastMove] = useState<string | null>(startMove)
  const [answerLabel, setAnswerLabel] = useState<string | null>(null)
  const [wrongMove, setWrongMove] = useState<string | null>(null)
  const [isBest, setIsBest] = useState(true)
  const [nextReview, setNextReview] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    alive.current = true
    getGame(puzzle.gameId).then((found) => alive.current && setSource(found ?? null))
    return () => {
      alive.current = false
      window.clearTimeout(timer.current)
    }
  }, [puzzle.gameId])

  async function finish(result: AttemptResult) {
    const now = Date.now()
    const next = schedule(puzzle, result === 'correct' ? 'correct' : 'wrong', now)
    const updated: PuzzleRecord = { ...puzzle, ...next, lastReviewedAt: now }
    setNextReview(next.dueAt)
    await savePuzzle(updated)
    await addAttempt({ gameType: game.id, puzzleId: puzzle.id, at: now, result })
    // Saved to Google Drive a moment later (a run of puzzles goes together).
    void autoSave()
    onReviewed(updated, result)
  }

  function resetBoard() {
    setPosition(puzzle.position)
    setLastMove(startMove)
  }

  function revealSolution(wrong: string | null) {
    window.clearTimeout(timer.current)
    setWrongMove(wrong)
    resetBoard()
    setStatus('failed')
    void finish('failed')
  }

  async function judge(move: string, wrongsSoFar: number) {
    try {
      const engine = game.engine('coach')
      const verdict = await checkAnswer(game, puzzle, move, engineEvaluator(game, engine, game.analysisDepth))
      if (!alive.current) return
      setAnswerLabel(verdict.label)
      if (verdict.correct) {
        sounds.good()
        setIsBest(verdict.isBest)
        setStatus('solved')
        await finish(wrongsSoFar === 0 ? 'correct' : 'hint')
      } else {
        // As many tries as needed; the board goes back after a moment.
        sounds.bad()
        setWrongMove(move)
        setStatus('wrong')
        timer.current = window.setTimeout(() => {
          resetBoard()
          setWrongs(wrongsSoFar + 1)
          setStatus('ready')
        }, 900)
      }
    } catch (e) {
      if (!alive.current || e instanceof EngineCancelledError) return
      setError('Hamle kontrol edilemedi. Tekrar dene.')
      resetBoard()
      setStatus('ready')
    }
  }

  function handleMove(move: string): boolean {
    if (status !== 'ready') return false
    const played = game.playAt(puzzle.position, move)
    if (!played) return false
    setError(null)
    setPosition(played.position)
    setLastMove(move)
    moveSound(game.id, played.label, game.stonesPlaced?.(puzzle.position, move))
    setStatus('checking')
    void judge(move, wrongs)
    return true
  }

  const hint = game.puzzleHint(puzzle)
  const HINT_AFTER = 3
  const showHint = wrongs >= HINT_AFTER && (status === 'ready' || status === 'checking')
  const done = status === 'solved' || status === 'failed'

  let marks: BoardMark[] = []
  if (status === 'failed') {
    marks = [{ kind: 'best', move: puzzle.bestMove }]
    if (wrongMove) marks.unshift({ kind: 'played', move: wrongMove })
  } else if (showHint) {
    marks = hint.marks
  }

  const others = puzzle.candidates.filter((c) => c.move !== puzzle.bestMove)

  return (
    <div className={game.wideBoard ? 'game-layout wide' : 'game-layout'}>
      <div className="board-column">
        <div className="puzzle-progress">
          <span>
            Bulmaca {number} / {total}
          </span>
          <span className="muted">Kutu {puzzle.box}</span>
        </div>
        <Board
          id="puzzle-board"
          position={position}
          perspective={puzzle.userSide}
          interactive={status === 'ready'}
          onMove={handleMove}
          lastMove={lastMove}
          marks={marks}
        />
      </div>

      <aside className="side-panel">
        <section className={`puzzle-card ${status}`}>
          {!done && (
            <>
              <h2>En iyi hamleyi bul</h2>
              <p>Sıra sende ({game.sideLabels[puzzle.userSide]}).</p>
              {status === 'checking' && <p className="muted">Kontrol ediliyor…</p>}
              {status === 'wrong' && answerLabel && (
                <p className="feedback wrong">
                  {answerLabel} olmadı. {wrongs + 1 >= HINT_AFTER ? 'Sana bir ipucu veriyorum.' : 'Tekrar dene.'}
                </p>
              )}
              {status === 'ready' && wrongs > 0 && wrongs < HINT_AFTER && (
                <p className="muted small">
                  {wrongs}. deneme olmadı. {HINT_AFTER - wrongs === 1 ? 'Bir yanlış daha olursa ipucu gelecek.' : 'Düşün ve tekrar dene.'}
                </p>
              )}
              {showHint && <p className="feedback hint">{hint.text}</p>}
              {error && <p className="error-box">{error}</p>}
              <button
                type="button"
                className="btn subtle"
                disabled={status === 'checking' || status === 'wrong'}
                onClick={() => revealSolution(null)}
              >
                Çözümü göster
              </button>
            </>
          )}

          {status === 'solved' && answerLabel && (
            <>
              <h2 className="feedback-title correct">Doğru! ✓</h2>
              <p>
                {isBest ? (
                  <>
                    <strong>{answerLabel}</strong> en iyi hamleydi.
                  </>
                ) : (
                  <>
                    <strong>{answerLabel}</strong> oynadın. Bu hamle de en iyisi kadar iyi. Motorun önerisi: {puzzle.bestLabel}.
                  </>
                )}
                {wrongs >= HINT_AFTER ? ' (İpucuyla çözdün.)' : wrongs > 0 ? ` (${wrongs + 1}. denemede çözdün.)` : ''}
              </p>
            </>
          )}

          {status === 'failed' && (
            <>
              <h2 className="feedback-title failed">Çözüm: {puzzle.bestLabel}</h2>
              <p className="muted">Yeşil işaret doğru hamleyi gösteriyor{wrongMove ? ', kırmızı işaret senin denemeni' : ''}.</p>
            </>
          )}

          {done && (
            <>
              <SolutionExplanation game={game} puzzle={puzzle} source={source} />
              <div className="explain-block">
                {others.length > 0 && (
                  <p className="muted small">Kabul edilen diğer hamleler: {others.map((c) => c.label).join(', ')}</p>
                )}
              </div>
              {nextReview !== null && (
                <p className="muted small">Bu bulmaca {relativeDay(nextReview, Date.now())} tekrar gelecek.</p>
              )}
              <div className="button-row">
                <button type="button" className="btn primary" onClick={onNext}>
                  {isLast ? 'Bitir' : 'Sonraki bulmaca'}
                </button>
                <a className="btn" href={`#/${game.slug}/analiz/${puzzle.gameId}/${puzzle.ply}`}>
                  Oyunda gör
                </a>
              </div>
            </>
          )}
        </section>

        {source && (
          <p className="muted small puzzle-source">
            Kaynak: vs {opponentName(source)} · {formatDate(source.playedAt ?? source.createdAt)}
          </p>
        )}
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------

function BoxOverview({ puzzles }: { puzzles: PuzzleRecord[] }) {
  const counts = boxCounts(puzzles)
  return (
    <div className="box-overview-wrap">
      <div className="box-overview">
        {counts.map((count, i) => (
          <div key={i} className="box-cell">
            <strong>{count}</strong>
            <span>Kutu {i + 1}</span>
            <small>{BOX_INTERVAL_DAYS[i]} gün</small>
          </div>
        ))}
      </div>
      <p className="muted small">Doğru çözdükçe bulmacalar üst kutulara çıkar ve daha seyrek gelir. Yanlışlar ertesi gün geri döner.</p>
    </div>
  )
}

function PlayLinks({ game }: { game: GameModule }) {
  return (
    <div className="button-row">
      <a className="btn primary" href={`#/${game.slug}/oyna`}>
        Oyun oyna
      </a>
      <a className="btn" href={`#/${game.slug}/analiz`}>
        Oyun analiz et
      </a>
    </div>
  )
}

function EmptyBank({ game }: { game: GameModule }) {
  return (
    <section className="card center-card">
      <div className="big-icon" aria-hidden="true">
        🧩
      </div>
      <h2>Bulmaca bankan henüz boş</h2>
      <p>
        Buradaki bulmacalar senin kendi {game.name.toLocaleLowerCase('tr-TR')} oyunlarındaki hatalardan oluşur. Bir oyun oyna: oyun
        bitince analiz kendiliğinden yapılır ve hata yaptığın pozisyonlar burada oyun başı, oyun ortası ve oyun sonu bölümlerinde
        bulmaca olarak belirir.
      </p>
      <PlayLinks game={game} />
    </section>
  )
}

function FinishedScreen({
  game,
  puzzles,
  results,
  onBack,
}: {
  game: GameModule
  puzzles: PuzzleRecord[]
  results: AttemptResult[]
  onBack: () => void
}) {
  const firstTry = results.filter((r) => r === 'correct').length
  const now = Date.now()
  const next = nextDueAt(puzzles, now)
  return (
    <section className="card center-card">
      <div className="big-icon" aria-hidden="true">
        🎉
      </div>
      <h2>Bugünkü tekrar bitti!</h2>
      <p>
        {results.length} bulmacadan <strong>{firstTry}</strong> tanesini ilk denemede çözdün.
        {next !== null && <> Sıradaki bulmaca {relativeDay(next, now)} hazır olacak.</>}
      </p>
      <BoxOverview puzzles={puzzles} />
      <div className="button-row">
        <button type="button" className="btn primary" onClick={onBack}>
          Bölümlere dön
        </button>
        <a className="btn" href={`#/${game.slug}/oyna`}>
          Oyun oyna
        </a>
      </div>
    </section>
  )
}

/** After a puzzle: why the game's move was bad, what the right move does, and how much it kept. */
function SolutionExplanation({ game, puzzle, source }: { game: GameModule; puzzle: PuzzleRecord; source: GameRecord | null }) {
  const facts = game.describeMove?.(puzzle.position, puzzle.bestMove)?.text ?? null
  const text = explainSolution(puzzle.explanation, facts)
  const original = source?.analysis?.moves.find((m) => m.ply === puzzle.ply)
  const change = winChangeText(original?.winBefore, original?.winAfter)
  return (
    <div className="explain-block solution-explain">
      <p className="muted small">Oyundaki hatan</p>
      <p>
        <strong>{puzzle.playedLabel}</strong>: {text.mistake}
      </p>
      <p className="muted small">Doğru hamle ne işe yarıyor?</p>
      <p>
        <strong>{puzzle.bestLabel}</strong>: {text.right}
      </p>
      {change && <p className="solution-change">{change}</p>}
    </div>
  )
}
