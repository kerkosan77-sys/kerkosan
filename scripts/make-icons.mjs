// Draws the app icons (four discs on a green board, on black) into public/icons/.
// Run once with `node scripts/make-icons.mjs`; the PNGs are kept in the project.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

const BLACK = [0, 0, 0]
const BOARD = [79, 122, 58]
const LINE = [52, 84, 38]
const LIGHT = [242, 240, 232]
const DARK = [24, 24, 24]

const DISCS = [
  { x: 0.345, y: 0.345, color: LIGHT },
  { x: 0.655, y: 0.345, color: DARK },
  { x: 0.345, y: 0.655, color: DARK },
  { x: 0.655, y: 0.655, color: LIGHT },
]

function inRoundRect(x, y, left, top, size, radius) {
  const right = left + size
  const bottom = top + size
  if (x < left || x > right || y < top || y > bottom) return false
  const cx = Math.min(Math.max(x, left + radius), right - radius)
  const cy = Math.min(Math.max(y, top + radius), bottom - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

/** Colour at a point of the unit square, or null for transparent. */
function colorAt(x, y, { maskable, scale }) {
  // Maskable icons fill the whole square; the system cuts its own shape.
  if (!maskable && !inRoundRect(x, y, 0, 0, 1, 0.2)) return null
  // Shrink the drawing toward the centre (maskable icons must keep it inside the middle 80%).
  const u = 0.5 + (x - 0.5) / scale
  const v = 0.5 + (y - 0.5) / scale
  for (const disc of DISCS) {
    const d2 = (u - disc.x) ** 2 + (v - disc.y) ** 2
    if (d2 <= 0.125 ** 2) return d2 >= 0.112 ** 2 ? BLACK : disc.color
  }
  if (!inRoundRect(u, v, 0.15, 0.15, 0.7, 0.08)) return BLACK
  if (Math.abs(u - 0.5) < 0.008 || Math.abs(v - 0.5) < 0.008) return LINE
  return BOARD
}

function render(size, options) {
  const samples = 4
  const pixels = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const c = colorAt((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size, options)
          if (!c) continue
          r += c[0]
          g += c[1]
          b += c[2]
          a++
        }
      }
      const i = (py * size + px) * 4
      if (a > 0) {
        pixels[i] = Math.round(r / a)
        pixels[i + 1] = Math.round(g / a)
        pixels[i + 2] = Math.round(b / a)
      }
      pixels[i + 3] = Math.round((255 * a) / (samples * samples))
    }
  }
  return png(size, pixels)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const discs = DISCS.map(
  (d) =>
    `<circle cx="${d.x * 100}" cy="${d.y * 100}" r="11.8" fill="rgb(${d.color.join(',')})" stroke="#000" stroke-width="1.3"/>`,
).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#000"/><rect x="15" y="15" width="70" height="70" rx="8" fill="rgb(${BOARD.join(',')})"/><path d="M50 15v70M15 50h70" stroke="rgb(${LINE.join(',')})" stroke-width="1.6"/>${discs}</svg>\n`

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon.svg'), svg)
writeFileSync(join(outDir, 'icon-192.png'), render(192, { maskable: false, scale: 1 }))
writeFileSync(join(outDir, 'icon-512.png'), render(512, { maskable: false, scale: 1 }))
writeFileSync(join(outDir, 'icon-maskable-512.png'), render(512, { maskable: true, scale: 0.8 }))
writeFileSync(join(outDir, 'apple-touch-icon.png'), render(180, { maskable: true, scale: 0.9 }))
console.log('Simgeler public/icons/ klasörüne yazıldı.')
