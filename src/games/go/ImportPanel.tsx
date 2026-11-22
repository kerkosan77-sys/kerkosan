import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { Side } from '../../core/types'
import { navigate } from '../../router'
import { guessUserSide, importSgfGame, readSgfForImport, type SgfImport } from './importSgf'

/** Adds a 9x9 game played elsewhere (an SGF file or its text) for analysis. */
export default function ImportPanel() {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [askColor, setAskColor] = useState<SgfImport | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(data: SgfImport, side: Side) {
    setSaving(true)
    try {
      const id = await importSgfGame(data, side)
      navigate(`go/analiz/${id}`)
    } catch {
      setSaving(false)
      setError('Oyun kaydedilemedi. Tekrar dene.')
    }
  }

  function read(source: string) {
    setError(null)
    setAskColor(null)
    try {
      const data = readSgfForImport(source)
      const side = guessUserSide(data.names, ['Sen'])
      if (side) void save(data, side)
      else setAskColor(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SGF okunamadı.')
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    read(text)
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 1_000_000) {
      setError('Bu dosya bir Go oyunu için çok büyük.')
      return
    }
    file.text().then(
      (content) => {
        setText(content)
        read(content)
      },
      () => setError('Dosya okunamadı.'),
    )
  }

  return (
    <section className="card">
      <h2>Oyun ekle</h2>
      <form className="import-form" onSubmit={submit}>
        <p className="muted small">
          Başka bir yerde (örneğin OGS'de) oynadığın 9×9 bir oyunu analiz edebilirsin: oyunun SGF dosyasını seç ya da metnini
          buraya yapıştır.
        </p>
        <label className="btn file-btn">
          SGF dosyası seç
          <input type="file" accept=".sgf,application/x-go-sgf,text/plain" onChange={pickFile} disabled={saving} />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'(;GM[1]FF[4]SZ[9]KM[7.5]PB[...]PW[...]\n;B[ee];W[gc];B[cg] ...)'}
          rows={6}
          spellCheck={false}
          aria-label="SGF metni"
        />
        {error && <p className="error-box">{error}</p>}
        {askColor ? (
          <div className="color-question">
            <p>Bu oyunda hangi renkle oynadın?</p>
            <div className="button-row">
              <button type="button" className="btn" disabled={saving} onClick={() => void save(askColor, 'w')}>
                <span className="player-dot" data-color="b" /> Siyah · {askColor.names.w}
              </button>
              <button type="button" className="btn" disabled={saving} onClick={() => void save(askColor, 'b')}>
                <span className="player-dot" data-color="w" /> Beyaz · {askColor.names.b}
              </button>
            </div>
          </div>
        ) : (
          <button type="submit" className="btn primary big" disabled={saving || !text.trim()}>
            Analiz et
          </button>
        )}
      </form>
    </section>
  )
}
