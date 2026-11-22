import { useEffect, useState, type FormEvent } from 'react'
import { ChessComError, TIME_CLASS_LABELS, chessComOutcome, fetchRecentGames, type ChessComGame } from '../import/chesscom'
import { importChessComGame, importPgnGame } from '../import/importGame'
import { guessUserColor, parsePgn, type ParsedPgn } from '../import/pgn'
import { OUTCOME_LABELS, formatDate } from '../../../core/records'
import type { Side as Color } from '../../../core/types'
import { loadAppSettings, updateAppSettings } from '../../../db/db'
import { navigate } from '../../../router'

type Tab = 'pgn' | 'chesscom'

export default function ImportPanel() {
  const [tab, setTab] = useState<Tab>('pgn')
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    loadAppSettings().then((settings) => setUsername(settings.chesscomUsername))
  }, [])

  return (
    <section className="card">
      <h2>Oyun ekle</h2>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'pgn'} className={tab === 'pgn' ? 'selected' : ''} onClick={() => setTab('pgn')}>
          PGN yapıştır
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chesscom'}
          className={tab === 'chesscom' ? 'selected' : ''}
          onClick={() => setTab('chesscom')}
        >
          Chess.com
        </button>
      </div>
      {tab === 'pgn' ? (
        <PgnImport knownName={username ?? ''} />
      ) : username !== null ? (
        <ChessComImport initialUsername={username} onUsePgn={() => setTab('pgn')} />
      ) : null}
    </section>
  )
}

function PgnImport({ knownName }: { knownName: string }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [askColor, setAskColor] = useState<ParsedPgn | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(parsed: ParsedPgn, color: Color) {
    setSaving(true)
    const id = await importPgnGame(parsed, color)
    navigate(`satranc/analiz/${id}`)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setAskColor(null)
    try {
      const parsed = parsePgn(text)
      const color = guessUserColor(parsed.white, parsed.black, [knownName, 'Sen'])
      if (color) void save(parsed, color)
      else setAskColor(parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PGN okunamadı.')
    }
  }

  return (
    <form className="import-form" onSubmit={submit}>
      <p className="muted small">Chess.com'da oyunu aç → Paylaş → PGN → Kopyala. Sonra buraya yapıştır.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'[Event "Live Chess"]\n[White "..."]\n[Black "..."]\n\n1. e4 e5 2. Nf3 Nc6 ...'}
        rows={7}
        spellCheck={false}
      />
      {error && <p className="error-box">{error}</p>}
      {askColor ? (
        <div className="color-question">
          <p>Bu oyunda hangi renkle oynadın?</p>
          <div className="button-row">
            <button type="button" className="btn" disabled={saving} onClick={() => void save(askColor, 'w')}>
              <span className="player-dot" data-color="w" /> Beyaz · {askColor.white}
            </button>
            <button type="button" className="btn" disabled={saving} onClick={() => void save(askColor, 'b')}>
              <span className="player-dot" data-color="b" /> Siyah · {askColor.black}
            </button>
          </div>
        </div>
      ) : (
        <button type="submit" className="btn primary big" disabled={saving}>
          Analiz et
        </button>
      )}
    </form>
  )
}

function ChessComImport({ initialUsername, onUsePgn }: { initialUsername: string; onUsePgn: () => void }) {
  const [username, setUsername] = useState(initialUsername)
  const [loading, setLoading] = useState(false)
  const [games, setGames] = useState<ChessComGame[] | null>(null)
  const [error, setError] = useState<ChessComError | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  async function load(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setGames(null)
    try {
      const list = await fetchRecentGames(username)
      setGames(list)
      await updateAppSettings({ chesscomUsername: username.trim() })
    } catch (e) {
      setError(e instanceof ChessComError ? e : new ChessComError('Beklenmedik bir hata oluştu.', 'other'))
    } finally {
      setLoading(false)
    }
  }

  async function open(game: ChessComGame) {
    setOpening(game.url)
    try {
      const id = await importChessComGame(game)
      navigate(`satranc/analiz/${id}`)
    } catch (e) {
      setOpening(null)
      setError(new ChessComError(e instanceof Error ? e.message : 'Oyun açılamadı.', 'other'))
    }
  }

  const showPgnHint = error && (error.kind === 'network' || error.kind === 'other' || error.kind === 'rate_limit')

  return (
    <div className="import-form">
      <form className="inline-form" onSubmit={load}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Chess.com kullanıcı adın"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Chess.com kullanıcı adı"
        />
        <button type="submit" className="btn primary" disabled={loading || !username.trim()}>
          {loading ? 'Getiriliyor…' : 'Oyunları getir'}
        </button>
      </form>

      {error && (
        <div className="error-box">
          <p>{error.message}</p>
          {showPgnHint && (
            <button type="button" className="btn" onClick={onUsePgn}>
              PGN yapıştırmaya geç
            </button>
          )}
        </div>
      )}

      {games && (
        <ul className="chesscom-list">
          {games.map((game) => {
            const outcome = chessComOutcome(game.userResult)
            const opponent = game.userColor === 'w' ? game.black : game.white
            return (
              <li key={game.url}>
                <div className="game-row-main">
                  <strong>
                    <span className="player-dot" data-color={game.userColor} /> vs {opponent}
                  </strong>
                  <small className="muted">
                    {game.endTime ? formatDate(game.endTime * 1000) : ''} · {TIME_CLASS_LABELS[game.timeClass] ?? game.timeClass}
                  </small>
                </div>
                <span className={`outcome ${outcome}`}>{OUTCOME_LABELS[outcome]}</span>
                <button type="button" className="btn" disabled={opening !== null} onClick={() => void open(game)}>
                  {opening === game.url ? 'Açılıyor…' : 'Analiz et'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
