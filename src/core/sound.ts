import { useEffect, useState } from 'react'
import type { GameId } from './types'

/**
 * Small sounds made on the spot with the Web Audio API (no sound files). Every game has its own
 * piece sound, so each one feels like its own board: a wooden chessman set down on wood, the sharp
 * clack of a Go stone, pebbles dropping into Mangala pits, a Dama disc sliding and knocking, a
 * plastic Reversi disc snapping and flipping. Buttons get a soft tick, right and wrong short tones.
 * They can be switched off; the choice is remembered.
 */

const KEY = 'akil-oyunlari-ses'
let context: AudioContext | null = null
let master: AudioNode | null = null
/** Piece sounds go through this, a little quieter than full (the buttons and tones keep their level). */
let pieces: AudioNode | null = null
/** How loud the piece sounds are. */
const PIECE_VOLUME = 0.65
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

/** Everything goes through a gentle limiter, so the louder piece sounds never crackle. */
function outputOf(c: BaseAudioContext): AudioNode {
  const limiter = c.createDynamicsCompressor()
  limiter.threshold.value = -8
  limiter.knee.value = 6
  limiter.ratio.value = 6
  limiter.attack.value = 0.002
  limiter.release.value = 0.12
  limiter.connect(c.destination)
  return limiter
}

function audio(): { c: AudioContext; out: AudioNode; pieces: AudioNode } | null {
  if (!isSoundOn() || typeof window === 'undefined') return null
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return null
    context = new Context()
    master = outputOf(context)
    const volume = context.createGain()
    volume.gain.value = PIECE_VOLUME
    volume.connect(master)
    pieces = volume
  }
  if (context.state === 'suspended') void context.resume()
  return { c: context, out: master!, pieces: pieces! }
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(c)
  if (!buffer) {
    buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffers.set(c, buffer)
  }
  return buffer
}

function envelope(c: BaseAudioContext, out: AudioNode, t: number, gain: number, decay: number, attack = 0.003): GainNode {
  const level = c.createGain()
  level.gain.setValueAtTime(0.0001, t)
  level.gain.exponentialRampToValueAtTime(gain, t + attack)
  level.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  level.connect(out)
  return level
}

/** The body of a knock: a tone that drops a little in pitch as it fades. */
function thud(c: BaseAudioContext, out: AudioNode, t: number, freq: number, decay: number, gain: number) {
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.03)
  osc.connect(envelope(c, out, t, gain, decay))
  osc.start(t)
  osc.stop(t + decay + 0.05)
}

/** A ringing tone: the resonance of wood, stone or plastic. */
function ping(c: BaseAudioContext, out: AudioNode, t: number, freq: number, decay: number, gain: number, type: OscillatorType = 'sine') {
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(envelope(c, out, t, gain, decay, 0.002))
  osc.start(t)
  osc.stop(t + decay + 0.05)
}

/** A burst of filtered noise: the click of a contact, or a slide when it is long and dark. */
function hiss(c: BaseAudioContext, out: AudioNode, t: number, length: number, type: BiquadFilterType, freq: number, gain: number, attack = 0.002) {
  const source = c.createBufferSource()
  source.buffer = noiseBuffer(c)
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = 0.9
  source.connect(filter).connect(envelope(c, out, t, gain, length, attack))
  source.start(t, Math.random() * 0.2)
  source.stop(t + attack + length + 0.05)
}

/** A small hard click: a pebble, a stone dropped into its bowl, a disc turning over. */
function tick(c: BaseAudioContext, out: AudioNode, t: number, freq: number, gain: number, type: OscillatorType = 'sine') {
  ping(c, out, t, freq, 0.025, gain, type)
  hiss(c, out, t, 0.012, 'highpass', 2800, gain * 0.8)
}

interface PieceSounds {
  /** `placed`: how many stones the move puts down one by one (Mangala), otherwise 1. */
  move(c: BaseAudioContext, out: AudioNode, t: number, placed: number): void
  /** `count`: how many pieces were taken or turned over (at least 1). */
  capture(c: BaseAudioContext, out: AudioNode, t: number, count: number, placed: number): void
}

/** Gap between clicks: unhurried for a few stones, quicker for many, so a long move still ends soon. */
const gapFor = (n: number, slow: number, total: number, fast: number) => (n <= 8 ? slow : Math.max(fast, total / n))

/** Mangala: one pebble click for every stone dropped into a pit. Returns when the last one falls. */
function sow(c: BaseAudioContext, out: AudioNode, t: number, placed: number): number {
  const n = Math.min(48, Math.max(1, placed))
  const gap = gapFor(n, 0.085, 0.75, 0.035)
  for (let i = 0; i < n; i++) {
    const at = t + i * gap
    tick(c, out, at, 2000 + Math.random() * 700, 0.32)
    thud(c, out, at, 380, 0.05, 0.25)
  }
  return t + (n - 1) * gap
}

const PIECE_SOUNDS: Record<GameId, PieceSounds> = {
  // A weighted wooden chessman set down on a wooden board: a warm low knock.
  chess: {
    move(c, out, t) {
      thud(c, out, t, 150, 0.14, 0.8)
      ping(c, out, t, 430, 0.06, 0.16)
      hiss(c, out, t, 0.03, 'bandpass', 1500, 0.4)
    },
    capture(c, out, t) {
      // The taken piece is knocked aside, then the capturing piece lands.
      thud(c, out, t, 200, 0.07, 0.5)
      hiss(c, out, t, 0.025, 'bandpass', 1900, 0.35)
      this.move(c, out, t + 0.1, 1)
    },
  },
  // A stone snapped onto a thick wooden board: a sharp, bright clack with a ring of the board.
  go: {
    move(c, out, t) {
      hiss(c, out, t, 0.012, 'highpass', 3200, 0.9)
      ping(c, out, t, 1250, 0.04, 0.35)
      thud(c, out, t, 260, 0.2, 0.6)
      ping(c, out, t, 520, 0.12, 0.14)
    },
    capture(c, out, t, count) {
      this.move(c, out, t, 1)
      // The taken stones drop into the lid one after another.
      const drops = Math.min(4, Math.max(2, count))
      for (let i = 0; i < drops; i++) tick(c, out, t + 0.18 + i * 0.07, 1800 + Math.random() * 600, 0.28)
    },
  },
  // Pebbles dropped one by one into wooden pits: a click for every stone.
  mangala: {
    move(c, out, t, placed) {
      sow(c, out, t, placed)
    },
    capture(c, out, t, count, placed) {
      // Then every won stone is picked up and dropped into the store, one click each.
      const start = sow(c, out, t, placed) + 0.18
      const n = Math.min(48, Math.max(1, count))
      const gap = gapFor(n, 0.07, 0.6, 0.03)
      for (let i = 0; i < n; i++) tick(c, out, start + i * gap, 1600 + Math.random() * 600, 0.26)
      thud(c, out, start + (n - 1) * gap + 0.05, 200, 0.16, 0.5)
    },
  },
  // A flat wooden disc slides a little and knocks down.
  dama: {
    move(c, out, t) {
      hiss(c, out, t, 0.06, 'lowpass', 900, 0.3, 0.03)
      thud(c, out, t + 0.06, 230, 0.11, 0.75)
      hiss(c, out, t + 0.06, 0.02, 'bandpass', 2000, 0.35)
    },
    capture(c, out, t, count) {
      // Hops over each taken disc, then lands.
      const hops = Math.min(3, Math.max(1, count))
      for (let i = 0; i < hops; i++) {
        thud(c, out, t + i * 0.11, 260 + i * 25, 0.07, 0.55)
        hiss(c, out, t + i * 0.11, 0.015, 'bandpass', 2200, 0.3)
      }
      this.move(c, out, t + hops * 0.11, 1)
    },
  },
  // A plastic disc snapped down, and every disc it turns over clicks.
  reversi: {
    move(c, out, t) {
      ping(c, out, t, 1500, 0.03, 0.35, 'triangle')
      hiss(c, out, t, 0.01, 'highpass', 2600, 0.5)
      thud(c, out, t, 330, 0.07, 0.5)
    },
    capture(c, out, t, count) {
      this.move(c, out, t, 1)
      const flips = Math.min(6, Math.max(1, count))
      for (let i = 0; i < flips; i++) tick(c, out, t + 0.11 + i * 0.055, 1700 + i * 70, 0.24, 'triangle')
    },
  },
}

/** Draws one piece sound into any audio context (also used to measure the sounds). */
export function playPieceSound(c: BaseAudioContext, out: AudioNode, game: GameId, capture: boolean, count = 1, delay = 0, placed = 1): void {
  const sounds = PIECE_SOUNDS[game]
  const t = c.currentTime + delay
  if (capture) sounds.capture(c, out, t, count, placed)
  else sounds.move(c, out, t, placed)
}

/** A soft tone (for right and wrong). */
function tone(c: BaseAudioContext, out: AudioNode, freq: number, start: number, length: number, gain: number) {
  const t = c.currentTime + start
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  osc.connect(envelope(c, out, t, gain, length, 0.015))
  osc.start(t)
  osc.stop(t + length + 0.05)
}

/** Piece sounds start this much later, so the sharp first moment is never cut off. */
const LEAD = 0.01

export const sounds = {
  move(game: GameId, placed = 1) {
    const a = audio()
    if (a) playPieceSound(a.c, a.pieces, game, false, 1, LEAD, placed)
  },
  capture(game: GameId, count = 1, placed = 1) {
    const a = audio()
    if (a) playPieceSound(a.c, a.pieces, game, true, count, LEAD, placed)
  },
  click() {
    const a = audio()
    if (!a) return
    ping(a.c, a.out, a.c.currentTime, 1100, 0.025, 0.035)
    hiss(a.c, a.out, a.c.currentTime, 0.02, 'bandpass', 2400, 0.03)
  },
  good() {
    const a = audio()
    if (!a) return
    tone(a.c, a.out, 660, 0, 0.16, 0.09)
    tone(a.c, a.out, 880, 0.11, 0.22, 0.09)
  },
  bad() {
    const a = audio()
    if (!a) return
    tone(a.c, a.out, 330, 0, 0.18, 0.08)
    tone(a.c, a.out, 247, 0.13, 0.25, 0.08)
  },
}

/** "(+6 taş)" in Mangala and Go labels, "(+2)" in Reversi labels: how many pieces were taken or turned over. */
const COUNT = /\(\+(\d+)( taş)?\)/

/** Whether a move label means something was taken or turned over ("♘xe5", "c3×c5", "4. kuyu (+6 taş)", "D4 (+2 taş)", "d3 (+2)"). */
export const isCaptureLabel = (label: string) => /[x×]/.test(label) || COUNT.test(label)

/** How many pieces a move label says were taken or turned over ("D4 (+3 taş)" → 3, "c3×c5×e7" → 2). */
export function capturedCount(label: string): number {
  const stones = COUNT.exec(label)
  if (stones) return Math.max(1, Number(stones[1]))
  return Math.max(1, (label.match(/[x×]/g) ?? []).length)
}

/** Plays the game's own move sound for a move label (`placed`: stones put down one by one, in Mangala). */
export function moveSound(game: GameId, label: string | undefined, placed = 1): void {
  if (label !== undefined && isCaptureLabel(label)) sounds.capture(game, capturedCount(label), placed)
  else sounds.move(game, placed)
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
