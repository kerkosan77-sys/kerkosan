import { useEffect, useRef, useState } from 'react'
import TopBar from '../components/TopBar'
import { LEVEL_TITLES, levelOf, stepPosition, type Lesson } from '../core/lessons'
import type { BoardMark, GameModule } from '../core/types'
import { moveSound, sounds } from '../core/sound'
import { autoSave } from '../core/cloud'
import { loadLessonProgress, markLessonDone } from '../db/db'
import { navigate } from '../router'

/** "#/<oyun>/dersler" lists the lessons, "#/<oyun>/dersler/<id>" plays one. */
export default function Lessons({ game, lessonId }: { game: GameModule; lessonId?: string }) {
  const lessons = game.lessons ?? []
  const [done, setDone] = useState<string[] | null>(null)

  useEffect(() => {
    let alive = true
    loadLessonProgress(game.id).then((list) => alive && setDone(list))
    return () => {
      alive = false
    }
  }, [game])

  const lesson = lessonId ? lessons.find((l) => l.id === lessonId) : undefined
  if (lesson) {
    const index = lessons.indexOf(lesson)
    return (
      <LessonPlayer
        key={lesson.id}
        game={game}
        lesson={lesson}
        number={index + 1}
        next={lessons[index + 1] ?? null}
        onComplete={async () => {
          setDone(await markLessonDone(game.id, lesson.id))
          void autoSave()
        }}
      />
    )
  }

  return (
    <div className="page">
      <TopBar title={`${game.name} · Dersler`} />
      <LessonList game={game} lessons={lessons} done={done ?? []} />
    </div>
  )
}

function LessonList({ game, lessons, done }: { game: GameModule; lessons: Lesson[]; done: string[] }) {
  if (lessons.length === 0) return <p className="muted center">Bu oyun için henüz ders yok.</p>
  const finished = lessons.filter((l) => done.includes(l.id)).length
  const next = lessons.find((l) => !done.includes(l.id))
  const levels = [...new Set(lessons.map(levelOf))].sort((x, y) => x - y)
  return (
    <div className="lesson-list">
      <section className="card lesson-progress">
        <h2>{game.name} dersleri</h2>
        <p className="muted">
          Her ders birkaç dakika sürer: kısa açıklamalar ve tahtada küçük alıştırmalar. Sırayla gitmen önerilir.
        </p>
        <div className="progress-bar" role="progressbar" aria-valuenow={finished} aria-valuemin={0} aria-valuemax={lessons.length}>
          <div style={{ width: `${(finished / lessons.length) * 100}%` }} />
        </div>
        <p className="small">
          {finished === lessons.length ? 'Bütün dersleri bitirdin! Şimdi öğrendiklerini oyunda dene.' : `${finished} / ${lessons.length} ders tamamlandı`}
        </p>
      </section>

      {levels.map((level) => {
        const group = lessons.filter((l) => levelOf(l) === level)
        const earlierDone = lessons.filter((l) => levelOf(l) < level).every((l) => done.includes(l.id))
        return (
          <section key={level} className="lesson-level">
            <h3>{LEVEL_TITLES[level] ?? `Seviye ${level}`}</h3>
            {!earlierDone && <p className="muted small">Önce bir önceki seviyeyi bitirmen önerilir, ama istersen buradan da başlayabilirsin.</p>}
            {group.map((lesson) => {
              const i = lessons.indexOf(lesson)
              const isDone = done.includes(lesson.id)
              const isNext = lesson === next
              return (
                <a
                  key={lesson.id}
                  href={`#/${game.slug}/dersler/${lesson.id}`}
                  className={`lesson-card${isNext ? ' next' : ''}${isDone ? ' done' : ''}`}
                >
                  <span className="lesson-number" aria-hidden="true">
                    {isDone ? '✓' : i + 1}
                  </span>
                  <span className="lesson-icon" aria-hidden="true">
                    {lesson.icon}
                  </span>
                  <span className="lesson-text">
                    <strong>{lesson.title}</strong>
                    <small>{lesson.summary}</small>
                  </span>
                  {isNext && <span className="lesson-chip">Sıradaki</span>}
                  {isDone && <span className="lesson-chip done">Bitti</span>}
                </a>
              )
            })}
          </section>
        )
      })}

      <div className="button-row">
        <a className="btn" href={`#/${game.slug}/oyna`}>
          Oyna
        </a>
        <a className="btn" href="#/">
          Ana ekran
        </a>
      </div>
    </div>
  )
}

type Status = 'read' | 'try' | 'wrong' | 'solved' | 'shown'

function LessonPlayer({
  game,
  lesson,
  number,
  next,
  onComplete,
}: {
  game: GameModule
  lesson: Lesson
  number: number
  next: Lesson | null
  onComplete: () => Promise<void>
}) {
  const Board = game.Board
  const [index, setIndex] = useState(0)
  const [finished, setFinished] = useState(false)
  const step = lesson.steps[index]
  const start = stepPosition(lesson, index)
  const [position, setPosition] = useState(start)
  const [lastMove, setLastMove] = useState<string | null>(step.lastMove ?? null)
  const [status, setStatus] = useState<Status>(step.answers ? 'try' : 'read')
  const [tries, setTries] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function goTo(target: number) {
    window.clearTimeout(timer.current)
    const nextStep = lesson.steps[target]
    setIndex(target)
    setPosition(stepPosition(lesson, target))
    setLastMove(nextStep.lastMove ?? null)
    setStatus(nextStep.answers ? 'try' : 'read')
    setTries(0)
  }

  function handleMove(move: string): boolean {
    if (status !== 'try' || !step.answers) return false
    const played = game.playAt(start, move)
    if (!played) return false
    setPosition(played.position)
    setLastMove(move)
    moveSound(played.label)
    if (step.answers.includes(move)) {
      setStatus('solved')
      window.setTimeout(sounds.good, 180)
      return true
    }
    window.setTimeout(sounds.bad, 180)
    setStatus('wrong')
    setTries((n) => n + 1)
    timer.current = window.setTimeout(() => {
      setPosition(start)
      setLastMove(step.lastMove ?? null)
      setStatus('try')
    }, 1300)
    return true
  }

  function showSolution() {
    if (!step.answers) return
    window.clearTimeout(timer.current)
    const answer = step.answers[0]
    const played = game.playAt(start, answer)
    setPosition(start)
    setLastMove(step.lastMove ?? null)
    setStatus('shown')
    // Show the move as an arrow on the starting position, then play it.
    timer.current = window.setTimeout(() => {
      if (played) {
        setPosition(played.position)
        setLastMove(answer)
      }
    }, 1200)
  }

  async function finish() {
    await onComplete()
    setFinished(true)
  }

  const isLast = index === lesson.steps.length - 1
  const canContinue = !step.answers || status === 'solved' || status === 'shown'

  let marks: BoardMark[] | undefined = step.marks
  if (step.answers) {
    if (status === 'shown' && position === start) marks = [{ kind: 'best', move: step.answers[0] }]
    else if (status === 'try' && tries > 0) marks = step.hintMarks ?? step.marks
    else if (status !== 'try') marks = undefined
  }

  const title = `${game.name} · Ders ${number}`

  if (finished) {
    return (
      <div className="page">
        <TopBar title={title} backTo={`${game.slug}/dersler`} backLabel="Dersler" />
        <section className="card center-card lesson-finished">
          <div className="big-icon" aria-hidden="true">
            🎉
          </div>
          <h2>Ders tamamlandı: {lesson.title}</h2>
          <div className="lesson-recap">
            <strong>Unutma:</strong>
            <ul>
              {lesson.recap.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <div className="button-row">
            {next ? (
              <button type="button" className="btn primary" onClick={() => navigate(`${game.slug}/dersler/${next.id}`)}>
                Sıradaki ders: {next.title}
              </button>
            ) : (
              <a className="btn primary" href={`#/${game.slug}/oyna`}>
                Öğrendiklerini oyunda dene
              </a>
            )}
            <a className="btn" href={`#/${game.slug}/dersler`}>
              Derslere dön
            </a>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <TopBar title={title} backTo={`${game.slug}/dersler`} backLabel="Dersler" />
      <div className={game.wideBoard ? 'game-layout wide' : 'game-layout'}>
        <div className="board-column">
          <Board
            id="lesson-board"
            position={position}
            perspective={lesson.side ?? 'w'}
            interactive={status === 'try'}
            onMove={handleMove}
            lastMove={lastMove}
            marks={marks}
          />
        </div>

        <aside className="side-panel lesson-panel">
          <div className="lesson-head">
            <span className="lesson-icon" aria-hidden="true">
              {lesson.icon}
            </span>
            <h2>{lesson.title}</h2>
          </div>
          <div className="lesson-steps" aria-label={`Adım ${index + 1} / ${lesson.steps.length}`}>
            {lesson.steps.map((s, i) => (
              <span key={i} className={`lesson-dot${i < index ? ' past' : ''}${i === index ? ' current' : ''}${s.answers ? ' task' : ''}`} />
            ))}
          </div>

          <section className={`lesson-text-card${step.answers ? ' task' : ''}`}>
            {step.answers && <span className="lesson-task-label">Sıra sende</span>}
            <p>{step.text}</p>
          </section>

          {status === 'solved' && <p className="lesson-feedback good">✓ {step.success ?? 'Doğru!'}</p>}
          {status === 'shown' && <p className="lesson-feedback shown">Doğru hamle yeşil okla gösterildi. {step.success ?? ''}</p>}
          {status === 'wrong' && <p className="lesson-feedback bad">✗ Bu değil. {step.hint ?? 'Tekrar dene.'}</p>}
          {status === 'try' && tries > 0 && step.hint && <p className="lesson-feedback hint">İpucu: {step.hint}</p>}

          <div className="button-row lesson-buttons">
            {index > 0 && (
              <button type="button" className="btn" onClick={() => goTo(index - 1)}>
                ← Geri
              </button>
            )}
            {step.answers && status === 'try' && tries >= 2 && (
              <button type="button" className="btn" onClick={showSolution}>
                Çözümü göster
              </button>
            )}
            {isLast ? (
              <button type="button" className="btn primary" disabled={!canContinue} onClick={() => void finish()}>
                Dersi bitir
              </button>
            ) : (
              <button type="button" className="btn primary" disabled={!canContinue} onClick={() => goTo(index + 1)}>
                Devam →
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
