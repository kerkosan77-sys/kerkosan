import { describe, expect, it } from 'vitest'
import { chromeLink, installPlatform, isAndroidChrome } from './install'

describe('Android browser', () => {
  it('tells Chrome itself from apps and browsers that cannot install the app', () => {
    expect(isAndroidChrome('Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36')).toBe(true)
    // The Google app opens links in its own web view.
    expect(
      isAndroidChrome(
        'Mozilla/5.0 (Linux; Android 14; SM-A546B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 GSA/15.46.37.29.arm64',
      ),
    ).toBe(false)
    expect(
      isAndroidChrome(
        'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe(false)
    expect(isAndroidChrome('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36')).toBe(false)
  })

  it('opens the start page in Chrome', () => {
    expect(chromeLink('https://kerkosan77-sys.github.io/kerkosan/#/satranc')).toBe(
      'intent://kerkosan77-sys.github.io/kerkosan/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fkerkosan77-sys.github.io%2Fkerkosan%2F;end',
    )
  })
})

describe('install steps', () => {
  it('shows the steps for the device in hand', () => {
    expect(installPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe('ios')
    // An iPad asking for the desktop site looks like a Mac, but it has a touch screen.
    expect(installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5)).toBe('ios')
    expect(installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 0)).toBe('desktop')
    expect(installPlatform('Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36')).toBe('android')
    expect(installPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('desktop')
  })
})
