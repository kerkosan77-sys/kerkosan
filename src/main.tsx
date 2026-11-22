import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { restoreFullscreen } from './core/fullscreen'
import { listenForInstall } from './core/install'
import { listenForClicks } from './core/sound'
import './styles.css'

listenForInstall()
restoreFullscreen()
listenForClicks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The built app keeps its files in the browser, so once installed it opens without the server.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  })
}

// In the installed app, ask the browser never to clear saved games to free up space.
if (window.matchMedia?.('(display-mode: standalone)').matches) {
  navigator.storage?.persist?.().catch(() => undefined)
}
