import { useEffect, useState } from 'react'

/**
 * Small sounds made on the spot with the Web Audio API (no sound files): a wooden "tock" for a
 * move, a double one for a capture, a soft tick for buttons and short tones for right and wrong.
 * They can be switched off; the choice is remembered.
 */

const KEY = 'akil-oyunlari-ses'
let context: AudioContext | null = null
const listeners = new Set<() => void>()

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // storage blocked: the setting lasts for this visit only
  }
  listeners.forEach((listener) => listener())
}

export function useSoundOn(): boolean {
  const [on, setOn] = useState(isSoundOn())
  useEffect(() => {
    const update = () => setOn(isSoundOn())
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])
  return on
}

function audio(): AudioContext | null {
  if (!isSoundOn() || typeof window === 'undefined') return null
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return null
    context = new Context()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

/** A short knock: a falling sine for the body and a little filtered noise for the click. */
function knock(c: AudioContext, freq: number, decay: number, gain: number, noise: number, delay = 0) {
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.03)
  const body = c.createGain()
  body.gain.setValueAtTime(0.0001, t)
  body.gain.exponentialRampToValueAtTime(gain, t + 0.004)
  body.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  osc.connect(body).connect(c.destination)
  osc.start(t)
  osc.stop(t + decay + 0.02)

  if (noise <= 0) return
  const length = Math.floor(c.sampleRate * 0.02)
  const buffer = c.createBuffer(1, length, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  const source = c.createBufferSource()
  source.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2400
  const level = c.createGain()
  level.gain.value = noise
  source.connect(filter).connect(level).connect(c.destination)
  source.start(t)
}

/** A soft tone (for right and wrong). */
function tone(c: AudioContext, freq: number, start: number, length: number, gain: number) {
  const t = c.currentTime + start
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const level = c.createGain()
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(gain, t + 0.015)
  level.gain.exponentialRampToValueAtTime(0.0001, t + length)
  osc.connect(level).connect(c.destination)
  osc.start(t)
  osc.stop(t + length + 0.02)
}

export const sounds = {
  move() {
    const c = audio()
    if (c) knock(c, 210, 0.09, 0.32, 0.22)
  },
  capture() {
    const c = audio()
    if (!c) return
    knock(c, 190, 0.1, 0.38, 0.3)
    knock(c, 150, 0.1, 0.28, 0.2, 0.075)
  },
  click() {
    const c = audio()
    if (c) knock(c, 1100, 0.025, 0.035, 0.03)
  },
  good() {
    const c = audio()
    if (!c) return
    tone(c, 660, 0, 0.16, 0.09)
    tone(c, 880, 0.11, 0.22, 0.09)
  },
  bad() {
    const c = audio()
    if (!c) return
    tone(c, 330, 0, 0.18, 0.08)
    tone(c, 247, 0.13, 0.25, 0.08)
  },
}

/** Whether a move label means something was taken ("♘xe5", "c3×c5", "4. kuyu (+6 taş)", "D4 (+2 taş)"). */
export const isCaptureLabel = (label: string) => /[x×]/.test(label) || /\+\d+ taş/.test(label)

/** Plays the move sound for a move label. */
export function moveSound(label: string | undefined): void {
  if (label !== undefined && isCaptureLabel(label)) sounds.capture()
  else sounds.move()
}

/** Call once at start-up: a soft tick for every button and button-like link. */
export function listenForClicks(): void {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Element | null
      const control = target?.closest('button, a.btn, a.big-button, a.lesson-card, a.back-link, .player-recent a')
      if (!control || control.matches(':disabled, .m-pit')) return
      sounds.click()
    },
    true,
  )
}
