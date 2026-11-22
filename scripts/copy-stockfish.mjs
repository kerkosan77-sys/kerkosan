// Copies the single-threaded "lite" Stockfish build into public/ so Vite serves it as a static file.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'node_modules', 'stockfish', 'bin')
const target = join(root, 'public', 'stockfish')
const files = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']

mkdirSync(target, { recursive: true })
for (const file of files) {
  const from = join(source, file)
  if (!existsSync(from)) {
    console.error(`Stockfish dosyası bulunamadı: ${from}\n"npm install" komutunu tekrar çalıştırmayı dene.`)
    process.exit(1)
  }
  copyFileSync(from, join(target, file))
}
console.log('Stockfish motoru public/stockfish/ klasörüne kopyalandı.')
