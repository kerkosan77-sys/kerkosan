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
 * on a black page).
 *
 * Automatic saving: the token (valid for about an hour) is kept on the device, and when the app
 * opens without a valid one it stops at Google's page for a moment without asking anything
 * (prompt=none) and comes back with a new one. After every game, puzzle and lesson the data is then
 * saved to Drive by itself.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email'
const FILE_NAME = 'akil-oyunlari-yedek.json'
const STATE_KEY = 'akil-oyunlari-bulut'
/** The access token and when it runs out. */
const TOKEN_KEY = 'akil-oyunlari-bulut-anahtar'
/** The sign-in in progress: a random check value, the page to come back to, and whether it asks nothing. */
const SIGN_IN_KEY = 'akil-oyunlari-giris'
/** This visit's quiet sign-in: when it was tried and whether Google wanted the user to choose. */
const QUIET_KEY = 'akil-oyunlari-sessiz-giris'
/** A quiet sign-in is tried again after this long (the token lasts an hour). */
const QUIET_RETRY_MS = 50 * 60_000
/** Several saves in a row (a run of puzzles) are sent to Drive together after this pause. */
const SAVE_DELAY_MS = 1500

export interface CloudState {
  email: string | null
  lastSync: number | null
}

type Token = { value: string; expiresAt: number }

let token: Token | null = null
let tokenLoaded = false
/** What came back from Google's page when the app opened, until it is used. */
let signInResult: { ok: true; quiet: boolean } | { ok: false; error: string } | null = null
const listeners = new Set<() => void>()

export const cloudConfigured = () => GOOGLE_CLIENT_ID !== ''

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown): boolean {
  try {
    if (value === null) storage?.removeItem(key)
    else storage?.setItem(key, JSON.stringify(value))
    return Boolean(storage)
  } catch {
    return false
  }
}

const session = (): Storage | undefined => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)

export function cloudState(): CloudState {
  const saved = readJson<CloudState>(localStorage, STATE_KEY)
  return { email: saved?.email ?? null, lastSync: saved?.lastSync ?? null }
}

function saveState(state: CloudState) {
  writeJson(localStorage, STATE_KEY, state)
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

function currentToken(): Token | null {
  if (!tokenLoaded) {
    tokenLoaded = true
    const saved = readJson<Token>(localStorage, TOKEN_KEY)
    if (!token && saved && typeof saved.value === 'string' && typeof saved.expiresAt === 'number') token = saved
  }
  return token
}

function setToken(value: Token | null) {
  token = value
  tokenLoaded = true
  writeJson(localStorage, TOKEN_KEY, value)
}

const hasToken = () => {
  const current = currentToken()
  return current !== null && current.expiresAt > Date.now() + 60_000
}

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
function goToGoogle(quiet: boolean): void {
  const state = randomState()
  writeJson(localStorage, SIGN_IN_KEY, { state, route: window.location.hash, quiet })
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
  // Asks nothing: comes straight back, with a token or with "the user has to choose".
  if (quiet) params.set('prompt', 'none')
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
  const saved = readJson<{ state?: string; route?: string; quiet?: boolean }>(localStorage, SIGN_IN_KEY)
  writeJson(localStorage, SIGN_IN_KEY, null)
  const route = saved?.route && !saved.route.includes('access_token') ? saved.route : '#/'
  window.history.replaceState(null, '', window.location.pathname + window.location.search + route)

  const accessToken = answer.get('access_token')
  const quiet = saved?.quiet === true
  let error: string | null = null
  if (!saved?.state || answer.get('state') !== saved.state) {
    error = 'Google girişi tamamlanamadı. Tekrar "Google ile bağlan"a bas.'
  } else if (!accessToken) {
    error = answer.get('error') === 'access_denied' ? 'Google girişine izin verilmedi.' : 'Google girişi tamamlanamadı. Tekrar dene.'
  } else if (!(answer.get('scope') ?? '').includes('drive.appdata')) {
    // Google lets the user untick the Drive permission; without it nothing can be saved.
    error = 'Google penceresinde Drive iznini işaretlemedin. Tekrar "Google ile bağlan"a bas ve Drive kutusunu işaretle.'
  }
  if (error) {
    // A quiet try that Google could not answer by itself: the user taps "Eşitle" once; no window opens now.
    if (quiet) writeJson(session(), QUIET_KEY, { at: Date.now(), failed: true })
    signInResult = quiet ? null : { ok: false, error }
    return
  }
  setToken({ value: accessToken!, expiresAt: Date.now() + Number(answer.get('expires_in') ?? 3600) * 1000 })
  writeJson(session(), QUIET_KEY, null)
  signInResult = { ok: true, quiet }
}

/** Just back from a sign-in the user started (the sync window should open and finish it). */
export const cameBackFromGoogle = () => signInResult !== null && !(signInResult.ok && signInResult.quiet)

/** Just back from a quiet sign-in (the sync runs in the background). */
export const cameBackQuietly = () => signInResult !== null && signInResult.ok && signInResult.quiet

/** True when the quiet sign-in could not renew the connection: one tap on "Eşitle" is needed. */
export function needsTap(): boolean {
  return Boolean(cloudConfigured() && cloudState().email && !hasToken() && readJson<{ failed?: boolean }>(session(), QUIET_KEY)?.failed)
}

/**
 * When the app opens (on the home screen): if this device is connected but has no valid token, it
 * goes to Google's page for a moment without asking anything and comes back with a new one. Tried
 * once per visit (again after the token's hour); returns true while it is leaving for Google.
 */
export function signInQuietlyIfNeeded(): boolean {
  if (!cloudConfigured() || !cloudState().email || hasToken()) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  const tried = readJson<{ at: number; failed?: boolean }>(session(), QUIET_KEY)
  if (tried?.failed || (tried && Date.now() - tried.at < QUIET_RETRY_MS)) return false
  // Without this note the app could keep going to Google and back, so nothing happens without it.
  if (!writeJson(session(), QUIET_KEY, { at: Date.now() })) return false
  goToGoogle(true)
  return true
}

async function google(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${currentToken()?.value ?? ''}`, ...init.headers } })
  if (response.status === 401) {
    setToken(null)
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

async function syncNow(): Promise<SyncResult> {
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

/** One sync at a time: a save asked for during a sync runs right after it. */
let queue: Promise<unknown> = Promise.resolve()
function sync(): Promise<SyncResult> {
  const run = queue.then(syncNow, syncNow)
  queue = run.catch(() => undefined)
  return run
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
 * From the "Eşitle" button: syncs when there is a valid token; otherwise goes to Google's page
 * (the app opens again afterwards and `finishSignIn` does the sync) and returns null.
 */
export async function connectAndSync(): Promise<SyncResult | null> {
  if (!hasToken()) {
    goToGoogle(false)
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

/** Syncs in the background when there is a valid token (null when it could not). */
export async function syncQuietly(): Promise<SyncResult | null> {
  if (!cloudConfigured() || !hasToken() || !cloudState().email) return null
  try {
    return await sync()
  } catch {
    return null
  }
}

let pendingSave: { timer: ReturnType<typeof setTimeout>; done: Promise<boolean>; resolve: (saved: boolean) => void } | null = null

/**
 * After a game, a puzzle or a lesson: saves to Drive a moment later, by itself. Several saves in a
 * row go together. Resolves true once saved; false when this device is not connected or has no
 * valid token right now (then the next app opening saves everything).
 */
export function autoSave(): Promise<boolean> {
  if (!cloudConfigured() || !cloudState().email) return Promise.resolve(false)
  if (!pendingSave) {
    let resolve: (saved: boolean) => void = () => undefined
    const done = new Promise<boolean>((r) => (resolve = r))
    pendingSave = { timer: setTimeout(() => undefined, 0), done, resolve }
  }
  const current = pendingSave
  clearTimeout(current.timer)
  current.timer = setTimeout(() => {
    pendingSave = null
    void syncQuietly().then((result) => current.resolve(result !== null))
  }, SAVE_DELAY_MS)
  return current.done
}

/** Forgets the account on this device (the data in Drive stays, and other devices stay connected). */
export function disconnect(): void {
  setToken(null)
  writeJson(session(), QUIET_KEY, null)
  saveState({ email: null, lastSync: null })
}
