import { useEffect, useState } from 'react'
import { GOOGLE_CLIENT_ID } from '../config'
import { exportBackup, importBackup, readBackup } from '../db/db'

/**
 * Sync through the user's own Google Drive: the whole backup is kept as one file in the app's
 * hidden Drive folder (appDataFolder, which only this app can see). Syncing first adds what is in
 * Drive to this device (nothing is deleted), then writes this device's data back, so every device
 * ends up with everything.
 *
 * Sign-in goes to Google's page and Google sends the user back to the app with an access token in
 * the address (#access_token=…). This works everywhere, unlike a sign-in popup, which phones,
 * installed apps and links opened inside other apps cannot hand back to the app (the user is left
 * on a black page). The token lives only in memory, so after the app is reopened one tap on
 * "Eşitle" signs in again (usually without a question).
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email'
const FILE_NAME = 'akil-oyunlari-yedek.json'
const STATE_KEY = 'akil-oyunlari-bulut'
/** The sign-in in progress: a random check value and the page to come back to. */
const SIGN_IN_KEY = 'akil-oyunlari-giris'

export interface CloudState {
  email: string | null
  lastSync: number | null
}

let token: { value: string; expiresAt: number } | null = null
/** What came back from Google's page when the app opened, until the sync window shows it. */
let signInResult: { ok: true } | { ok: false; error: string } | null = null
const listeners = new Set<() => void>()

export const cloudConfigured = () => GOOGLE_CLIENT_ID !== ''

export function cloudState(): CloudState {
  try {
    const saved = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as CloudState | null
    return { email: saved?.email ?? null, lastSync: saved?.lastSync ?? null }
  } catch {
    return { email: null, lastSync: null }
  }
}

function saveState(state: CloudState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // storage blocked: the account is forgotten after this visit
  }
  listeners.forEach((listener) => listener())
}

export function useCloudState(): CloudState {
  const [state, setState] = useState(cloudState())
  useEffect(() => {
    const update = () => setState(cloudState())
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])
  return state
}

const hasToken = () => token !== null && token.expiresAt > Date.now() + 60_000

/** The address Google sends the user back to (it must be listed in the Google Cloud client). */
export function returnAddress(): string {
  return window.location.origin + window.location.pathname.replace(/index\.html$/, '')
}

function randomState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Leaves for Google's sign-in page; Google sends the user back here with a token. */
function goToGoogle(): void {
  const state = randomState()
  try {
    localStorage.setItem(SIGN_IN_KEY, JSON.stringify({ state, route: window.location.hash }))
  } catch {
    // without storage the answer cannot be checked; Google is still opened and the check fails safely
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: returnAddress(),
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    state,
  })
  const email = cloudState().email
  if (email) params.set('login_hint', email)
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

/**
 * Called once when the app opens, before anything is drawn: picks up the token Google put in the
 * address, removes it from the address bar and puts the app back on the page it was on.
 */
export function takeSignInResult(): void {
  const hash = window.location.hash
  if (!/^#(.*&)?(access_token|error)=/.test(hash)) return
  const answer = new URLSearchParams(hash.slice(1))
  let saved: { state?: string; route?: string } | null = null
  try {
    saved = JSON.parse(localStorage.getItem(SIGN_IN_KEY) ?? 'null')
    localStorage.removeItem(SIGN_IN_KEY)
  } catch {
    saved = null
  }
  const route = saved?.route && !saved.route.includes('access_token') ? saved.route : '#/'
  window.history.replaceState(null, '', window.location.pathname + window.location.search + route)

  const accessToken = answer.get('access_token')
  if (!saved?.state || answer.get('state') !== saved.state) {
    signInResult = { ok: false, error: 'Google girişi tamamlanamadı. Tekrar "Google ile bağlan"a bas.' }
  } else if (!accessToken) {
    signInResult = {
      ok: false,
      error: answer.get('error') === 'access_denied' ? 'Google girişine izin verilmedi.' : 'Google girişi tamamlanamadı. Tekrar dene.',
    }
  } else if (!(answer.get('scope') ?? '').includes('drive.appdata')) {
    // Google lets the user untick the Drive permission; without it nothing can be saved.
    signInResult = {
      ok: false,
      error: 'Google penceresinde Drive iznini işaretlemedin. Tekrar "Google ile bağlan"a bas ve Drive kutusunu işaretle.',
    }
  } else {
    token = { value: accessToken, expiresAt: Date.now() + Number(answer.get('expires_in') ?? 3600) * 1000 }
    signInResult = { ok: true }
  }
}

/** True once when the app has just come back from Google's page (the sync window should open). */
export const cameBackFromGoogle = () => signInResult !== null

async function google(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token?.value ?? ''}`, ...init.headers } })
  if (response.status === 401) {
    token = null
    throw new Error('Google oturumunun süresi doldu. Tekrar "Eşitle"ye bas.')
  }
  if (!response.ok) throw new Error('Google Drive ile bağlantıda bir sorun oldu. Biraz sonra tekrar dene.')
  return response
}

async function findFile(): Promise<string | null> {
  const query = encodeURIComponent(`name='${FILE_NAME}'`)
  const response = await google(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id)`)
  const { files } = (await response.json()) as { files?: { id: string }[] }
  return files?.[0]?.id ?? null
}

async function writeFile(id: string | null, text: string): Promise<void> {
  if (id) {
    await google(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    })
    return
  }
  const boundary = `akil${Date.now()}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`
  await google('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
}

export interface SyncResult {
  games: number
  puzzles: number
}

async function sync(): Promise<SyncResult> {
  const id = await findFile()
  let added: SyncResult = { games: 0, puzzles: 0 }
  if (id) {
    const response = await google(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
    added = await importBackup(readBackup(await response.text()))
  }
  await writeFile(id, JSON.stringify(await exportBackup()))
  saveState({ ...cloudState(), lastSync: Date.now() })
  return added
}

async function rememberAccountAndSync(): Promise<SyncResult> {
  if (!cloudState().email) {
    const response = await google('https://www.googleapis.com/oauth2/v3/userinfo')
    const { email } = (await response.json()) as { email?: string }
    saveState({ email: email ?? 'Google hesabı', lastSync: null })
  }
  return sync()
}

/**
 * From the "Eşitle" button: syncs when signed in during this visit; otherwise goes to Google's page
 * (the app opens again afterwards and `finishSignIn` does the sync) and returns null.
 */
export async function connectAndSync(): Promise<SyncResult | null> {
  if (!hasToken()) {
    goToGoogle()
    return null
  }
  return rememberAccountAndSync()
}

/** After coming back from Google's page: syncs, or says why the sign-in did not work. Null if there was no sign-in. */
export async function finishSignIn(): Promise<SyncResult | null> {
  const result = signInResult
  signInResult = null
  if (!result) return null
  if (!result.ok) throw new Error(result.error)
  return rememberAccountAndSync()
}

/** Syncs in the background when a sign-in from this visit is still valid (for example after a game). */
export async function syncQuietly(): Promise<SyncResult | null> {
  if (!cloudConfigured() || !hasToken() || !cloudState().email) return null
  try {
    return await sync()
  } catch {
    return null
  }
}

/** Forgets the account on this device (the data in Drive stays, and other devices stay connected). */
export function disconnect(): void {
  token = null
  saveState({ email: null, lastSync: null })
}
