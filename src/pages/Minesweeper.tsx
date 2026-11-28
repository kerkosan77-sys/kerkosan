import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import TopBar from '../components/TopBar'
import { sounds } from '../core/sound'
import { loadMineStats, saveMineStats } from '../db/db'
import type { MineLevelStats, MineStats } from '../db/types'
import { MINE_LEVELS, flagsPlaced, levelById, newBoard, reveal, timeText, toggleFlag, type MineBoard } from '../games/minesweeper/logic'
import { findHint, reviewLoss, type LossReview, type MineHint } from '../games/minesweeper/solver'

/** Holding a square this long puts a flag on it (or opens it in flag mode). */
const LONG_PRESS_MS = 380

const EMPTY_STATS: MineLevelStats = { played: 0, won: 0, best: null, streak: 0 }

/** The big board lies on its side on wide screens (16 rows, 30 columns) and stands upright on phones. */
function boardFor(levelId: number): MineBoard {
  const level = levelById(levelId)
  const wide = typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  const [rows, cols] = wide && level.rows > level.cols ? [level.cols, level.rows] : [level.rows, level.cols]
  return newBoard(rows, cols, level.mines)
}

const RULES = [
  'Amaç: mayın olmayan bütün kareleri açmak.',
  'Bir kareye dokununca açılır. Açılan sayı, çevresindeki 8 karede kaç mayın olduğunu söyler.',
  'Mayın olduğunu düşündüğün kareye bayrak koy: kareyi basılı tut (bilgisayarda sağ tık) ya da 🚩 düğmesini açıp dokun.',
  'Bir sayının çevresinde sayı kadar bayrak varsa, o sayıya dokununca kalan kareler birden açılır.',
  'İlk açtığın kare hep güvenlidir, çevresi de.',
  'Takılınca 💡 İpucu: koç hangi karenin kesin güvenli ya da kesin mayın olduğunu ve nedenini söyler.',
]

export default function Minesweeper() {
  const [stats, setStats] = useState<MineStats | null>(null)
  const [levelId, setLevelId] = useState(2)
  const [board, setBoard] = useState<MineBoard>(() => boardFor(2))
  const [flagMode, setFlagMode] = useState(false)
  const [hint, setHint] = useState<MineHint | null>(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [loss, setLoss] = useState<LossReview | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [newBest, setNewBest] = useState(false)

  // The latest values for the long-press timer, which fires after the render that started it.
  const latest = useRef({ board, flagMode })
  latest.current = { board, flagMode }
  /** The long-press timer of the square being held. */
  const press = useRef(0)
  const swallowClick = useRef(false)
  const lastPointer = useRef('mouse')

  useEffect(() => {
    let alive = true
    loadMineStats()
      .then((loaded) => {
        if (!alive) return
        setStats(loaded)
        const level = levelById(loaded.level)
        setLevelId(level.id)
        setBoard(boardFor(level.id))
      })
      .catch(() => setStats({ level: 2, levels: {} }))
    return () => {
      alive = false
    }
  }, [])

  // The clock runs from the first square opened until the game ends.
  const playing = board.status === 'playing'
  useEffect(() => {
    if (!playing || startedAt === null) return
    const tick = () => setSeconds((Date.now() - startedAt) / 1000)
    tick()
    const timer = window.setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [playing, startedAt])

  useEffect(() => () => clearTimeout(press.current), [])

  function startGame(id = levelId) {
    setLevelId(id)
    setBoard(boardFor(id))
    setHint(null)
    setHintsUsed(0)
    setLoss(null)
    setStartedAt(null)
    setSeconds(0)
    setNewBest(false)
    if (stats && stats.level !== id) {
      const next = { ...stats, level: id }
      setStats(next)
      void saveMineStats(next).catch(() => undefined)
    }
  }

  function finish(next: MineBoard, before: MineBoard, tapped: number) {
    const won = next.status === 'won'
    const time = startedAt === null ? 0 : Math.round((Date.now() - startedAt) / 100) / 10
    setSeconds(time)
    if (won) sounds.good()
    else {
      sounds.bad()
      setLoss(reviewLoss(before, tapped, before.open[tapped] === 1))
    }
    if (!stats) return
    const key = String(levelId)
    const old = stats.levels[key] ?? EMPTY_STATS
    // Times with hints are not records: the coach did part of the work.
    const best = won && hintsUsed === 0 && (old.best === null || time < old.best)
    setNewBest(best)
    const entry: MineLevelStats = {
      played: old.played + 1,
      won: old.won + (won ? 1 : 0),
      best: best ? time : old.best,
      streak: won ? old.streak + 1 : 0,
    }
    const updated = { ...stats, level: levelId, levels: { ...stats.levels, [key]: entry } }
    setStats(updated)
    void saveMineStats(updated).catch(() => undefined)
  }

  /** A tap opens (or flags, in flag mode); `flag` comes from a long press or a right click. */
  function act(index: number, flag: boolean) {
    const { board: current, flagMode: flagging } = latest.current
    if (current.status === 'won' || current.status === 'lost') return
    const wantsFlag = current.open[index] ? false : flag !== flagging
    const next = wantsFlag ? toggleFlag(current, index) : reveal(current, index)
    if (next === current) return
    if (current.status === 'ready' && next.status !== 'ready') setStartedAt(Date.now())
    latest.current = { board: next, flagMode: flagging }
    setBoard(next)
    setHint(null)
    if (next.status === 'won' || next.status === 'lost') finish(next, current, index)
  }

  const cellOf = (event: { target: EventTarget }): number | null => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-i]')
    return cell ? Number(cell.dataset.i) : null
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    lastPointer.current = event.pointerType
    swallowClick.current = false
    clearTimeout(press.current)
    if (event.button !== 0) return
    const index = cellOf(event)
    if (index === null) return
    press.current = window.setTimeout(() => {
      swallowClick.current = true
      navigator.vibrate?.(25)
      act(index, true)
    }, LONG_PRESS_MS)
  }

  function endPress() {
    clearTimeout(press.current)
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (swallowClick.current) {
      swallowClick.current = false
      return
    }
    const index = cellOf(event)
    if (index !== null) act(index, false)
  }

  function onContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    // Phones fire this on a long press too, which the timer already handled.
    if (lastPointer.current !== 'mouse') return
    endPress()
    const index = cellOf(event)
    if (index !== null) act(index, true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'f' && event.key !== 'F') return
    const index = cellOf(event)
    if (index === null) return
    event.preventDefault()
    act(index, true)
  }

  function askHint() {
    const found = findHint(board)
    setHint(found)
    if (found && found.action !== 'start') setHintsUsed((n) => n + 1)
  }

  const over = board.status === 'won' || board.status === 'lost'
  const minesLeft = board.mines - flagsPlaced(board)
  const level = levelById(levelId)
  const levelStats = stats?.levels[String(levelId)] ?? EMPTY_STATS

  // What each square shows from the hint or the loss review.
  const marks = new Map<number, string>()
  const tags = new Map<number, string>()
  if (hint) {
    for (const n of hint.known) marks.set(n, 'mark-known')
    for (const n of hint.shared) marks.set(n, 'mark-shared')
    hint.clues.forEach((n, i) => {
      marks.set(n, 'mark-clue')
      if (hint.clues.length > 1) tags.set(n, 'AB'[i] ?? '')
    })
    const kind = { flag: 'mark-mine', unflag: 'mark-wrong', guess: 'mark-guess', open: 'mark-safe', start: '' }[hint.action]
    for (const n of hint.targets) marks.set(n, kind)
  }
  if (loss) {
    for (const n of loss.safe) marks.set(n, 'mark-safe')
    for (const n of loss.clues) marks.set(n, 'mark-clue')
  }

  const cells = []
  for (let i = 0; i < board.rows * board.cols; i++) {
    const open = board.open[i] === 1
    const flag = board.flag[i] === 1
    const mine = board.mine[i] === 1
    let className = open ? 'mine-cell open' : 'mine-cell'
    let content = ''
    let label: string
    if (open) {
      const count = board.count[i]
      if (count > 0) {
        content = String(count)
        className += ` n${count}`
      }
      label = count > 0 ? `${count}` : 'boş'
    } else if (board.status === 'lost' && mine) {
      content = flag ? '🚩' : '💣'
      if (i === board.exploded) className += ' exploded'
      label = 'mayın'
    } else if (board.status === 'lost' && flag) {
      content = '❌'
      label = 'yanlış bayrak'
    } else if (flag) {
      content = '🚩'
      label = 'bayrak'
    } else {
      label = 'kapalı'
    }
    const mark = marks.get(i)
    if (mark) className += ` ${mark}`
    cells.push(
      <button key={i} type="button" className={className} data-i={i} data-tag={tags.get(i)} aria-label={label} tabIndex={over ? -1 : 0}>
        {content}
      </button>,
    )
  }

  let status: string
  if (board.status === 'ready') status = 'İlk kareyi aç: ilk açtığın kare hep güvenlidir.'
  else if (flagMode) status = 'Bayrak modu açık: dokunduğun kareye bayrak konur.'
  else status = 'Kareye dokun: açılır. Basılı tut: bayrak.'

  return (
    <div className="page mine-page">
      <TopBar title="Mayın Tarlası" />

      <div className="mine-levels" role="radiogroup" aria-label="Zorluk">
        {MINE_LEVELS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === levelId}
            className={option.id === levelId ? 'selected' : ''}
            onClick={() => startGame(option.id)}
          >
            <strong>{option.name}</strong>
            <small>
              {option.cols}×{option.rows} · {option.mines} mayın
            </small>
          </button>
        ))}
      </div>

      <div className="mine-layout">
        <div className="mine-board-column">
          <div className="mine-toolbar">
            <span className="mine-counter" title="Kalan mayın (mayın sayısı eksi bayraklar)">
              💣 {minesLeft}
            </span>
            <span className="mine-counter" title="Süre">
              ⏱ {timeText(seconds)}
            </span>
            <button
              type="button"
              className={`btn mine-flag-btn${flagMode ? ' primary' : ''}`}
              aria-pressed={flagMode}
              onClick={() => setFlagMode((on) => !on)}
              disabled={over}
            >
              🚩 {flagMode ? 'Bayrak: açık' : 'Bayrak'}
            </button>
            <button type="button" className="btn primary mine-hint-btn" onClick={askHint} disabled={over}>
              💡 İpucu
            </button>
          </div>
          {/* Above the board, so it is seen without scrolling on the tall board of a phone. */}
          {over ? (
            <section className={`end-panel mine-end ${board.status === 'won' ? 'win' : 'loss'}`} role="status">
              <h2>{board.status === 'won' ? '🎉 Kazandın!' : '💥 Mayına bastın'}</h2>
              {board.status === 'won' ? (
                <p>
                  {level.name} tahtayı {timeText(seconds)} içinde temizledin.
                  {newBest && ' Bu düzeyde en iyi süren!'}
                  {hintsUsed > 0 && ` ${hintsUsed} ipucu kullandın; ipuçlu oyunlar en iyi süreye sayılmaz.`}
                </p>
              ) : (
                loss && <p>{loss.text}</p>
              )}
              <div className="button-row">
                <button type="button" className="btn primary" onClick={() => startGame()}>
                  Yeni oyun
                </button>
                <a className="btn" href="#/">
                  Ana ekran
                </a>
              </div>
            </section>
          ) : (
            hint && (
              <p className="mine-hint" role="status">
                {hint.text}
              </p>
            )
          )}
          <div
            className={`mine-grid${over ? ' over' : ''}`}
            style={{ ['--cols' as string]: board.cols, ['--rows' as string]: board.rows }}
            onPointerDown={onPointerDown}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onPointerLeave={endPress}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onKeyDown={onKeyDown}
          >
            {cells}
          </div>
        </div>

        <aside className="side-panel">
          {!over && (
            <>
              <div className="status-box">{status}</div>
              <div className="button-row">
                <button type="button" className="btn" onClick={() => startGame()}>
                  ↻ Yeni oyun
                </button>
              </div>
            </>
          )}

          <section className="mine-stats">
            <h2>{level.name} · senin sonuçların</h2>
            <div className="player-levels">
              <div className="level-box">
                <span>Kazandığın</span>
                <strong>
                  {levelStats.won} / {levelStats.played}
                </strong>
                <small>{levelStats.streak > 1 ? `Üst üste ${levelStats.streak} galibiyet` : 'oyun'}</small>
              </div>
              <div className="level-box">
                <span>En iyi süren</span>
                <strong>{levelStats.best === null ? '—' : timeText(levelStats.best)}</strong>
                <small>ipucusuz</small>
              </div>
            </div>
          </section>

          <details className="mine-rules" open={levelStats.played === 0 || undefined}>
            <summary>Nasıl oynanır?</summary>
            <ul>
              {RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
        </aside>
      </div>
    </div>
  )
}
