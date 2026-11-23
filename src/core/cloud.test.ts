import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A tiny browser: the address, the history and localStorage, enough for the sign-in code. */
function fakeBrowser(hash: string, saved: Record<string, string> = {}) {
  const store = new Map(Object.entries(saved))
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
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
  return { location, replaceState, store }
}

const SIGN_IN = { 'akil-oyunlari-giris': JSON.stringify({ state: 'abc', route: '#/satranc' }) }
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
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) })
    const cloud = await loadCloud()
    expect(cloud.returnAddress()).toBe('https://example.github.io/kerkosan/')
    expect(await cloud.connectAndSync()).toBeNull()
    const url = new URL(location.assign.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.github.io/kerkosan/')
    expect(url.searchParams.get('response_type')).toBe('token')
    expect(JSON.parse(store.get('akil-oyunlari-giris')!).state).toBe(url.searchParams.get('state'))
  })
})
