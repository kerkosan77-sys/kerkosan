// Starts the app with one double-click (see "Uygulamayı Başlat.cmd"): installs the libraries the first
// time, rebuilds the app when the code has changed, serves it on http://localhost:4173 and opens it in
// its own window. Options: --no-open (do not open a window).
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4173
const URL = `http://localhost:${PORT}/`
const open = !process.argv.includes('--no-open')
const VITE = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const say = (text) => console.log(`\n  ${text}`)

async function isRunning() {
  try {
    const response = await fetch(URL, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

/** Newest modification time of the files under `path` (0 if it does not exist). */
function newest(path) {
  if (!existsSync(path)) return 0
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.mtimeMs
  return readdirSync(path).reduce((latest, name) => Math.max(latest, newest(join(path, name))), 0)
}

function needsBuild() {
  const built = join(root, 'dist', 'sw.js')
  if (!existsSync(built)) return true
  const sources = ['src', 'public', 'index.html', 'vite.config.ts', 'package.json', join('scripts', 'offline-app.ts')]
  return Math.max(...sources.map((source) => newest(join(root, source)))) > statSync(built).mtimeMs
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' })
    child.on('exit', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

/** Opens the app in an Edge app window (no address bar) when Edge is there, otherwise in the default browser. */
function openApp() {
  if (process.platform === 'win32') {
    const edge = [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ].find((path) => existsSync(path))
    const child = edge
      ? spawn(edge, [`--app=${URL}`], { detached: true, stdio: 'ignore' })
      : spawn('cmd', ['/c', 'start', '', URL], { detached: true, stdio: 'ignore' })
    child.unref()
  } else {
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [URL], { detached: true, stdio: 'ignore' }).unref()
  }
}

async function main() {
  if (await isRunning()) {
    say('Uygulama zaten çalışıyor.')
    if (open) openApp()
    return
  }

  if (!existsSync(VITE)) {
    say('İlk açılış: gerekli kütüphaneler kuruluyor (bir kez, birkaç dakika sürebilir)…')
    const npm = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    if (!existsSync(npm) || (await run([npm, 'install'])) !== 0 || !existsSync(VITE)) {
      say('Kütüphaneler kurulamadı. İnternet bağlantını kontrol et ve tekrar dene.')
      process.exit(1)
    }
  }

  if (needsBuild()) {
    say('Uygulama hazırlanıyor…')
    if ((await run([VITE, 'build', '--logLevel', 'warn'])) !== 0) {
      say('Uygulama hazırlanamadı. Yukarıdaki hata mesajına bak.')
      process.exit(1)
    }
  }

  const server = spawn(process.execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' })
  server.on('exit', (code) => {
    say(code === 0 ? 'Uygulama kapatıldı.' : 'Uygulama sunucusu durdu.')
    process.exit(code ?? 0)
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill())

  for (let i = 0; i < 60 && !(await isRunning()); i++) await new Promise((r) => setTimeout(r, 250))
  if (!(await isRunning())) {
    say('Uygulama başlatılamadı (4173 numaralı port kullanımda olabilir).')
    server.kill()
    process.exit(1)
  }
  say(`Akıl Oyunları Koçu çalışıyor: ${URL}`)
  say('Bu pencere açık kaldığı sürece uygulama güncel kalır. Kapatmak için bu pencereyi kapat.')
  say('(Uygulamayı kurduysan, bu pencere kapalıyken de masaüstündeki simgeden açılır.)')
  if (open) openApp()
}

main()
