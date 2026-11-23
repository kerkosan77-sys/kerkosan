import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { takeSignInResult } from './core/cloud'
import { restoreFullscreen } from './core/fullscreen'
import { listenForInstall } from './core/install'
import { listenForClicks } from './core/sound'
import './styles.css'

// Back from Google's sign-in page: take the token out of the address before the pages read it.
takeSignInResult()
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
