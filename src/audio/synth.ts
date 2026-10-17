// Web Audio API로 합성한 임시 효과음.
// public/sounds/ 에 CC0 파일을 넣고 sounds.json에 등록하면 soundManager가 파일을 우선 쓴다.

export type SoundName =
  | 'select'
  | 'move'
  | 'capture'
  | 'promotion'
  | 'check'
  | 'checkmate'
  | 'victory'
  | 'draw'
  | 'invalid'

let ctx: AudioContext | null = null
let master: GainNode | null = null

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.connect(ctx.destination)
  }
  return ctx
}

export function setSynthVolume(v: number) {
  if (master) master.gain.value = v
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function env(c: AudioContext, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  g.connect(master!)
  return g
}

function tone(c: AudioContext, t: number, freq: number, type: OscillatorType, peak: number, attack: number, decay: number, endFreq?: number) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + attack + decay)
  o.connect(env(c, t, peak, attack, decay))
  o.start(t)
  o.stop(t + attack + decay + 0.05)
}

function noise(c: AudioContext, t: number, filter: BiquadFilterType, freq: number, q: number, peak: number, decay: number) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, decay + 0.05)
  const f = c.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  src.connect(f)
  f.connect(env(c, t, peak, 0.003, decay))
  src.start(t)
}

/** 나무 두드리는 소리: 짧은 대역 잡음 + 낮은 공명 */
function woodKnock(c: AudioContext, t: number, pitch: number, level: number) {
  noise(c, t, 'bandpass', 1800 * pitch, 3, 0.5 * level, 0.05)
  tone(c, t, 420 * pitch, 'sine', 0.55 * level, 0.002, 0.09, 300 * pitch)
  tone(c, t, 180 * pitch, 'triangle', 0.3 * level, 0.002, 0.12, 140 * pitch)
}

const recipes: Record<SoundName, (c: AudioContext, t: number) => void> = {
  // 가벼운 "틱"
  select: (c, t) => {
    noise(c, t, 'highpass', 4000, 1, 0.25, 0.025)
    tone(c, t, 1600, 'sine', 0.12, 0.001, 0.04)
  },
  // 나무 말 내려놓는 "톡"
  move: (c, t) => woodKnock(c, t, 1, 1),
  // 묵직한 충돌음 "쾅"
  capture: (c, t) => {
    noise(c, t, 'lowpass', 1400, 0.7, 0.9, 0.35)
    tone(c, t, 110, 'sine', 0.9, 0.003, 0.4, 45)
    noise(c, t + 0.02, 'bandpass', 2600, 2, 0.35, 0.12)
    woodKnock(c, t + 0.01, 0.8, 0.8)
  },
  // 상승하는 차임벨
  promotion: (c, t) => {
    ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone(c, t + i * 0.09, f, 'sine', 0.28, 0.005, 0.7)
      tone(c, t + i * 0.09, f * 2, 'sine', 0.06, 0.005, 0.5)
    })
  },
  // 긴장감 있는 경고음
  check: (c, t) => {
    ;[0, 0.18].forEach((dt) => {
      tone(c, t + dt, 880, 'square', 0.09, 0.005, 0.13)
      tone(c, t + dt, 587.33, 'sawtooth', 0.07, 0.005, 0.15)
    })
    tone(c, t, 73.4, 'sine', 0.5, 0.01, 0.6)
  },
  // 웅장한 효과음: 낮은 북 + 단조 화음
  checkmate: (c, t) => {
    tone(c, t, 55, 'sine', 1, 0.005, 1.4, 35)
    noise(c, t, 'lowpass', 600, 0.7, 0.8, 0.9)
    ;[110, 130.81, 164.81, 220].forEach((f) => {
      tone(c, t + 0.05, f, 'sawtooth', 0.09, 0.15, 2.2)
      tone(c, t + 0.05, f * 1.003, 'sawtooth', 0.06, 0.15, 2.2)
    })
  },
  // 승리 팡파르
  victory: (c, t) => {
    const notes: [number, number, number][] = [
      [523.25, 0, 0.18],
      [523.25, 0.2, 0.18],
      [523.25, 0.4, 0.18],
      [659.25, 0.6, 0.5],
      [587.33, 1.1, 0.25],
      [659.25, 1.35, 0.25],
      [783.99, 1.6, 1.2],
    ]
    for (const [f, dt, d] of notes) {
      tone(c, t + dt, f, 'sawtooth', 0.12, 0.02, d)
      tone(c, t + dt, f / 2, 'triangle', 0.12, 0.02, d)
    }
    ;[261.63, 329.63, 392].forEach((f) => tone(c, t + 1.6, f, 'triangle', 0.1, 0.05, 1.6))
  },
  // 차분한 종소리
  draw: (c, t) => {
    ;[392, 293.66].forEach((f, i) => {
      const s = t + i * 0.7
      tone(c, s, f, 'sine', 0.35, 0.005, 2.2)
      tone(c, s, f * 2.76, 'sine', 0.08, 0.005, 1.2)
      tone(c, s, f * 5.4, 'sine', 0.03, 0.005, 0.6)
    })
  },
  // 짧은 "삑"
  invalid: (c, t) => tone(c, t, 220, 'square', 0.12, 0.004, 0.12, 180),
}

export function playSynth(name: SoundName, delaySec = 0) {
  const c = audioContext()
  if (!c || !master) return
  recipes[name](c, c.currentTime + delaySec)
}
