import { useEffect, useState } from 'react'
import { GOOGLE_CLIENT_ID } from '../config'
import { exportBackup, importBackup, readBackup } from '../db/db'

/**
 * Sync through the user's own Google Drive: the whole backup is kept as one file in the app's
 * hidden Drive folder (appDataFolder, which only this app can see). Syncing first adds what is in
 * Drive to this device (nothing is deleted), then writes this device's data back, so every device
 * ends up with everything. Sign-in uses Google Identity Services; the access token lives only in
 * memory, so after the app is reopened one tap on "Eşitle" signs in again (usually without a question).
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email'
const FILE_NAME = 'akil-oyunlari-yedek.json'
const STATE_KEY = 'akil-oyunlari-bulut'

export interface CloudState {
  email: string | null
  lastSync: number | null
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void
}

interface GoogleOAuth {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: () => void
  }): TokenClient
  revoke(token: string, done?: () => void): void
}

const oauth = (): GoogleOAuth | undefined =>
  (window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth } } }).google?.accounts?.oauth2

let token: { value: string; expiresAt: number } | null = null
let scriptPromise: Promise<void> | null = null
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

/** Loads Google's sign-in script ahead of time, so the sign-in window can open straight from a tap. */
export function prepareCloud(): Promise<void> {
  if (!cloudConfigured()) return Promise.resolve()
  if (oauth()) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Google\'a bağlanılamadı. İnternet bağlantını kontrol et.'))
      }
      document.head.append(script)
    })
  }
  return scriptPromise
}

const hasToken = () => token !== null && token.expiresAt > Date.now() + 60_000

/**
 * Gets an access token. Call it straight from a tap: the first time a Google window asks which
 * account to use and whether the app may keep its data in Drive.
 */
function requestToken(): Promise<string> {
  if (hasToken()) return Promise.resolve(token!.value)
  const google = oauth()
  if (!google) return Promise.reject(new Error('Google girişi hazırlanıyor, birkaç saniye sonra tekrar dene.'))
  return new Promise((resolve, reject) => {
    const client = google.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error('Google girişi tamamlanmadı.'))
          return
        }
        token = { value: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 }
        resolve(response.access_token)
      },
      error_callback: () => reject(new Error('Google penceresi kapatıldı ya da açılamadı.')),
    })
    client.requestAccessToken({ prompt: cloudState().email ? '' : 'consent' })
  })
}

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

/** From a tap: signs in if needed (remembering the account's address) and syncs. */
export async function connectAndSync(): Promise<SyncResult> {
  await requestToken()
  if (!cloudState().email) {
    const response = await google('https://www.googleapis.com/oauth2/v3/userinfo')
    const { email } = (await response.json()) as { email?: string }
    saveState({ email: email ?? 'Google hesabı', lastSync: null })
  }
  return sync()
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

/** Forgets the account on this device (the data in Drive stays). */
export function disconnect(): void {
  const google = oauth()
  if (token && google) google.revoke(token.value)
  token = null
  saveState({ email: null, lastSync: null })
}
