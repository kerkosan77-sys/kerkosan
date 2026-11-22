import { useEffect, useState } from 'react'

/**
 * Full screen through the browser's Fullscreen API. The choice is remembered: if the app was left
 * in full screen, it goes back to full screen at the first tap or key press after it opens again
 * (browsers only allow entering full screen right after a user action).
 */

const KEY = 'akil-oyunlari-tam-ekran'

const supported = () => typeof document !== 'undefined' && document.fullscreenEnabled === true
export const isFullscreen = () => typeof document !== 'undefined' && document.fullscreenElement !== null

function remember(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // storage may be blocked; full screen still works for this visit
  }
}

function wanted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    // refused by the browser (for example without a user action): nothing to do
  }
}

/** Call once at start-up. */
export function restoreFullscreen(): void {
  if (!supported()) return
  document.addEventListener('fullscreenchange', () => remember(isFullscreen()))
  if (!wanted()) return
  const enter = () => {
    window.removeEventListener('pointerdown', enter, true)
    window.removeEventListener('keydown', enter, true)
    if (!isFullscreen()) void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined)
  }
  window.addEventListener('pointerdown', enter, true)
  window.addEventListener('keydown', enter, true)
}

/** Whether the page is in full screen now, kept up to date; null when the browser cannot do it. */
export function useFullscreen(): boolean | null {
  const [on, setOn] = useState(isFullscreen())
  useEffect(() => {
    const update = () => setOn(isFullscreen())
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  return supported() ? on : null
}
