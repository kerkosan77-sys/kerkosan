import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

/** All files under `dir`, as URL paths relative to it ("assets/index-abc.js"). */
function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full, root) : [relative(root, full).split(sep).join('/')]
  })
}

/** The service worker: keeps every file of the app so it opens without the server or internet. */
function serviceWorker(version: string, files: string[]): string {
  return `// Made by scripts/offline-app.ts during the build. Do not edit.
const CACHE = 'akil-oyunlari-${version}'
const FILES = ${JSON.stringify(['./', ...files])}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('akil-oyunlari-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    // The newest page while the app's server runs (that is how updates arrive), the kept one otherwise.
    event.respondWith(
      fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match('index.html', { ignoreVary: true }))),
    )
    return
  }
  event.respondWith(
    // ignoreVary: the server answers with "Vary: Origin", and the page's own requests carry an Origin header.
    caches.open(CACHE).then((cache) => cache.match(request, { ignoreVary: true }).then((kept) => kept || fetch(request))),
  )
})
`
}

/**
 * Build step that turns the site into an installable app that also works offline: after the build
 * it writes dist/sw.js listing every built file. Its name changes with the files' contents, so the
 * browser notices a new version.
 */
export function offlineApp(): Plugin {
  let outDir = ''
  return {
    name: 'offline-app',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = listFiles(outDir)
        .filter((file) => file !== 'sw.js' && !file.endsWith('.map'))
        .sort()
      // The worker's own code counts too, so a change to it alone also reaches installed apps.
      const hash = createHash('sha256').update(serviceWorker('', files))
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))
      writeFileSync(join(outDir, 'sw.js'), serviceWorker(hash.digest('hex').slice(0, 12), files))
    },
  }
}
