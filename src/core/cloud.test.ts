import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function fakeStorage(saved: Record<string, string> = {}) {
  const store = new Map(Object.entries(saved))
  return {
    store,
    api: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  }
}

/** A tiny browser: the address, the history, localStorage and sessionStorage, enough for the sign-in code. */
function fakeBrowser(hash: string, saved: Record<string, string> = {}, sessionSaved: Record<string, string> = {}) {
  const local = fakeStorage(saved)
  const session = fakeStorage(sessionSaved)
  const location = {
    origin: 'https://example.github.io',
    pathname: '/kerkosan/index.html',
    search: '',
    hash,
    assign: vi.fn(),
  }
  const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
    location.hash = url.slice(url.indexOf('#'))
  })
  vi.stubGlobal('window', { location, history: { replaceState } })
  vi.stubGlobal('localStorage', local.api)
  vi.stubGlobal('sessionStorage', session.api)
  vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) })
  return { location, replaceState, store: local.store, session: session.store }
}

const SIGN_IN = { 'akil-oyunlari-giris': JSON.stringify({ state: 'abc', route: '#/satranc' }) }
const QUIET_SIGN_IN = { 'akil-oyunlari-giris': JSON.stringify({ state: 'abc', route: '#/', quiet: true }) }
const CONNECTED = { 'akil-oyunlari-bulut': JSON.stringify({ email: 'oyuncu@example.com', lastSync: 1 }) }
const DRIVE = encodeURIComponent('email openid https://www.googleapis.com/auth/drive.appdata')

async function loadCloud() {
  vi.resetModules()
  return import('./cloud')
}

describe('Google sign-in by going to Google and back', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing on a normal start', async () => {
    const { replaceState } = fakeBrowser('#/satranc/oyna')
    const cloud = await loadCloud()
    cloud.takeSignInResult()
    expect(replaceState).not.toHaveBeenCalled()
    expect(cloud.cameBackFromGoogle()).toBe(false)
  })

  it('takes the token, cleans the address and goes back to the page', async () => {
    const { location, store } = fakeBrowser(`#access_token=tok&token_type=Bearer&expires_in=3599&scope=${DRIVE}&state=abc`, SIGN_IN)
    const cloud = await loadCloud()
    cloud.takeSignInResult()
    expect(location.hash).toBe('#/satranc')
    expect(store.has('akil-oyunlari-giris')).toBe(false)
    expect(cloud.cameBackFromGoogle()).toBe(true)
    expect(cloud.cameBackQuietly()).toBe(false)
  })

  it('refuses an answer whose check value does not match', async () => {
    const { location } = fakeBrowser(`#access_token=tok&expires_in=3599&scope=${DRIVE}&state=other`, SIGN_IN)
    const cloud = await loadCloud()
    cloud.takeSignInResult()
    expect(location.hash).toBe('#/satranc')
    await expect(cloud.finishSignIn()).rejects.toThrow('tamamlanamadı')
  })

  it('explains when the Drive permission was unticked', async () => {
    fakeBrowser(`#access_token=tok&expires_in=3599&scope=email%20openid&state=abc`, SIGN_IN)
    const cloud = await loadCloud()
    cloud.takeSignInResult()
    await expect(cloud.finishSignIn()).rejects.toThrow('Drive')
  })

  it('says so when the user said no on Google’s page', async () => {
    fakeBrowser('#error=access_denied&state=abc', SIGN_IN)
    const cloud = await loadCloud()
    cloud.takeSignInResult()
    await expect(cloud.finishSignIn()).rejects.toThrow('izin verilmedi')
  })

  it('goes to Google with the app address as the way back', async () => {
    const { location, store } = fakeBrowser('#/')
    const cloud = await loadCloud()
    expect(cloud.returnAddress()).toBe('https://example.github.io/kerkosan/')
    expect(await cloud.connectAndSync()).toBeNull()
    const url = new URL(location.assign.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.github.io/kerkosan/')
    expect(url.searchParams.get('response_type')).toBe('token')
    expect(url.searchParams.get('prompt')).toBeNull()
    expect(JSON.parse(store.get('akil-oyunlari-giris')!).state).toBe(url.searchParams.get('state'))
  })
})

describe('automatic saving', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('renews the connection quietly once when the app opens without a token', async () => {
    const { location } = fakeBrowser('#/', CONNECTED)
    const cloud = await loadCloud()
    expect(cloud.signInQuietlyIfNeeded()).toBe(true)
    const url = new URL(location.assign.mock.calls[0][0] as string)
    expect(url.searchParams.get('prompt')).toBe('none')
    expect(url.searchParams.get('login_hint')).toBe('oyuncu@example.com')
    // Not again in the same visit, so the app cannot keep going to Google and back.
    expect(cloud.signInQuietlyIfNeeded()).toBe(false)
    expect(location.assign).toHaveBeenCalledTimes(1)
  })

  it('does not go to Google for a device that was never connected', async () => {
    const { location } = fakeBrowser('#/')
    const cloud = await loadCloud()
    expect(cloud.signInQuietlyIfNeeded()).toBe(false)
    expect(location.assign).not.toHaveBeenCalled()
    expect(await cloud.autoSave()).toBe(false)
  })

  it('keeps the token after the app is closed and opened again', async () => {
    const browser = fakeBrowser(`#access_token=tok&expires_in=3599&scope=${DRIVE}&state=abc`, { ...CONNECTED, ...QUIET_SIGN_IN })
    let cloud = await loadCloud()
    cloud.takeSignInResult()
    expect(cloud.cameBackQuietly()).toBe(true)
    expect(cloud.cameBackFromGoogle()).toBe(false)
    expect(JSON.parse(browser.store.get('akil-oyunlari-bulut-anahtar')!).value).toBe('tok')
    // A fresh start of the app: the saved token is still valid, so there is no trip to Google.
    browser.location.hash = '#/'
    cloud = await loadCloud()
    expect(cloud.signInQuietlyIfNeeded()).toBe(false)
    expect(browser.location.assign).not.toHaveBeenCalled()
  })

  it('asks for one tap when Google could not renew the connection by itself', async () => {
    fakeBrowser('#error=interaction_required&state=abc', { ...CONNECTED, ...QUIET_SIGN_IN }, { 'akil-oyunlari-sessiz-giris': JSON.stringify({ at: 1 }) })
    const cloud = await loadCloud()
    cloud.takeSignInResult()
    // No error window opens by itself; the sync button shows that one tap is needed.
    expect(cloud.cameBackFromGoogle()).toBe(false)
    expect(cloud.cameBackQuietly()).toBe(false)
    expect(cloud.needsTap()).toBe(true)
    expect(cloud.signInQuietlyIfNeeded()).toBe(false)
  })
})
