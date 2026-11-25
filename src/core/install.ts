/**
 * Installing the app from inside the page: Chromium browsers (Edge, Chrome) fire
 * `beforeinstallprompt` when the page can be installed. It fires once, early, so it is caught here at
 * start-up and kept until the user presses the install button.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Call once at start-up. */
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/** True when running as the installed app (its own window), not in a browser tab. */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  // iPhone and iPad tell it with navigator.standalone instead.
  return (window.matchMedia?.('(display-mode: standalone)').matches ?? false) || (navigator as { standalone?: boolean }).standalone === true
}

export type InstallPlatform = 'ios' | 'android' | 'desktop'

/** Which install steps to show: iPhone/iPad (Safari), Android (Chrome) or a computer. */
export function installPlatform(userAgent: string, touchPoints = 0): InstallPlatform {
  // iPads ask for the desktop site and say "Macintosh", but they have a touch screen.
  if (/iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'desktop'
}

/** Resolves once the app's files are kept on this device, so it opens without internet. */
export function offlineReady(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return Promise.resolve(false)
  return navigator.serviceWorker.ready.then(() => true).catch(() => false)
}

/** True when the browser offered an install button for this page. */
export function canPromptInstall(): boolean {
  return deferred !== null
}

/** Shows the browser's install dialog; resolves with whether the user installed. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  deferred = null
  notify()
  await event.prompt()
  return (await event.userChoice).outcome === 'accepted'
}

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
