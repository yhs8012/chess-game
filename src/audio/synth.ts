// Web Audio 물리 기반 효과음 (모달 합성 + 서재 잔향).
// - 나무 말·보드: 실제 나무판의 진동 모드(감쇠하는 사인파 묶음) + 접촉 순간의 잡음
// - 차임·종·징: 막대·종의 비정수배 배음
// - 팡파르: 디튠된 톱니파 + 필터 엔벨로프("브라스") + 비브라토
// - 모든 소리는 매번 조금씩 다르게(음높이·세기 흔들림) 나서 기계적으로 반복되지 않는다
// public/sounds/ 에 CC0 파일을 넣고 sounds.json에 등록하면 soundManager가 파일을 우선 쓴다.
import type { PieceSymbol } from 'chess.js'

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

export interface SoundOptions {
  /** 움직인(또는 잡힌) 기물: 무거운 말일수록 낮고 묵직하게 */
  piece?: PieceSymbol
}

interface Bus {
  ctx: BaseAudioContext
  master: GainNode
  dry: GainNode
  /** 짧은 방 잔향 (나무 소리) */
  room: GainNode
  /** 긴 홀 잔향 (차임·종·징·팡파르) */
  hall: GainNode
}

let bus: Bus | null = null
let live: AudioContext | null = null

// 결정적이지 않아도 되는 흔들림
const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount

/**
 * 방의 임펄스 응답: 초기 반사 몇 개 + 고역이 빨리 줄어드는 지수 감쇠 잡음.
 * decay는 진폭 시간 상수(초) — RT60 ≈ decay × 6.9
 */
function roomImpulse(c: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.ceil(c.sampleRate * seconds)
  const ir = c.createBuffer(2, len, c.sampleRate)
  const early = [0.007, 0.011, 0.017, 0.023, 0.031, 0.041]
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate
      // 시간이 갈수록 더 어두워지는(고역 흡수) 잡음
      const k = Math.min(0.95, 0.35 + t * 1.2)
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k)
      d[i] = lp * Math.exp(-t / decay) * 2.2
    }
    for (const e of early) {
      const at = Math.floor((e + (ch ? 0.0013 : 0)) * c.sampleRate)
      if (at < len) d[at] += (ch ? -1 : 1) * 0.55 * Math.exp(-e / 0.05)
    }
  }
  return ir
}

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (live) return live
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  live = new AC()
  bus = createBus(live)
  return live
}

function createBus(ctx: BaseAudioContext): Bus {
  const master = ctx.createGain()
  // 여러 소리가 겹쳐도 넘치지 않게 전체에 여유(-2dB)를 둔다
  const trim = ctx.createGain()
  trim.gain.value = 0.78
  // 큰 소리(체크메이트·팡파르)가 찢어지지 않게 부드럽게 눌러 준다
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.knee.value = 8
  limiter.ratio.value = 6
  limiter.attack.value = 0.003
  limiter.release.value = 0.2
  // 마지막 안전장치: 압축기가 못 잡은 순간 피크를 부드럽게 둥글린다(tanh)
  const clip = ctx.createWaveShaper()
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2)
  }
  clip.curve = curve
  clip.oversample = '2x'
  master.connect(trim)
  trim.connect(limiter)
  limiter.connect(clip)
  clip.connect(ctx.destination)

  const dry = ctx.createGain()
  dry.connect(master)
  const reverb = (seconds: number, decay: number) => {
    const conv = ctx.createConvolver()
    conv.buffer = roomImpulse(ctx, seconds, decay)
    const send = ctx.createGain()
    send.connect(conv)
    conv.connect(master)
    return send
  }
  // 서재: RT60 약 0.7초 / 홀: 약 2초
  return { ctx, master, dry, room: reverb(0.9, 0.1), hall: reverb(2.4, 0.29) }
}

/** 소리 하나를 오프라인으로 렌더링 (점검·테스트용) */
export async function renderSound(name: SoundName, opts: SoundOptions = {}, seconds = 4): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100)
  const b = createBus(ctx)
  recipes[name](b, 0.01, opts)
  return ctx.startRendering()
}

export function setSynthVolume(v: number) {
  if (bus) bus.master.gain.value = v
}

// ── 기본 재료 ──────────────────────────────────────────

interface Out {
  node: AudioNode
  /** 잔향으로 보낼 비율 */
  reverb: number
}

/** 소리 하나의 출력: 건조음 + 잔향 송신 */
function voice(b: Bus, level: number, reverb: number, lowpass = 18000, space: 'room' | 'hall' = 'room'): Out {
  const g = b.ctx.createGain()
  g.gain.value = level
  const lp = b.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = lowpass
  lp.Q.value = 0.5
  g.connect(lp)
  lp.connect(b.dry)
  const send = b.ctx.createGain()
  send.gain.value = reverb
  lp.connect(send)
  send.connect(space === 'hall' ? b.hall : b.room)
  return { node: g, reverb }
}

/** 감쇠하는 사인파 하나 (진동 모드). decay는 시간 상수(초) */
function mode(c: BaseAudioContext, out: AudioNode, t: number, freq: number, decay: number, amp: number, attack = 0.0015, glide = 1) {
  const o = c.createOscillator()
  o.frequency.setValueAtTime(freq, t)
  if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * glide, t + decay * 4)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(amp, t + attack)
  g.gain.setTargetAtTime(0, t + attack, decay)
  o.connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + attack + decay * 8 + 0.05)
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()
function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(c)
  if (!buf) {
    buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseCache.set(c, buf)
  }
  return buf
}

/** 필터 거친 잡음 덩어리 (접촉음·긁힘·심벌) */
function noise(
  c: BaseAudioContext,
  out: AudioNode,
  t: number,
  opts: { type: BiquadFilterType; freq: number; q?: number; amp: number; attack?: number; decay: number; sweepTo?: number },
) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  src.playbackRate.value = jitter(0.1)
  const f = c.createBiquadFilter()
  f.type = opts.type
  f.frequency.setValueAtTime(opts.freq, t)
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.decay * 4)
  f.Q.value = opts.q ?? 0.7
  const g = c.createGain()
  const a = opts.attack ?? 0.0008
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(opts.amp, t + a)
  g.gain.setTargetAtTime(0, t + a, opts.decay)
  src.connect(f)
  f.connect(g)
  g.connect(out)
  src.start(t, Math.random() * 1.5)
  src.stop(t + a + opts.decay * 8 + 0.05)
}

// ── 나무 ───────────────────────────────────────────────

/** 기물 무게: 킹·퀸·룩은 낮고 묵직하게, 폰은 가볍고 높게 */
function weightOf(piece?: PieceSymbol): { pitch: number; level: number } {
  switch (piece) {
    case 'k':
    case 'q':
      return { pitch: 0.88, level: 1.15 }
    case 'r':
      return { pitch: 0.93, level: 1.08 }
    case 'p':
      return { pitch: 1.1, level: 0.85 }
    default:
      return { pitch: 1, level: 1 }
  }
}

// 두꺼운 나무 보드가 테이블 위에 놓였을 때의 진동 모드 [Hz, 시간상수 s, 세기]
const BOARD_MODES: [number, number, number][] = [
  [182, 0.03, 0.5],
  [337, 0.026, 0.62],
  [521, 0.022, 0.5],
  [748, 0.018, 0.4],
  [1163, 0.013, 0.3],
  [1642, 0.009, 0.2],
  [2380, 0.006, 0.12],
]
// 단단한 나무 기물 자체의 모드
const PIECE_MODES: [number, number, number][] = [
  [2210, 0.011, 0.32],
  [3720, 0.007, 0.2],
  [5480, 0.005, 0.12],
]

/** 나무 기물을 보드에 내려놓는 "톡" */
function woodKnock(b: Bus, t: number, weight: { pitch: number; level: number }, opts: { level?: number; boardGain?: number } = {}) {
  const c = b.ctx
  const level = (opts.level ?? 1) * weight.level * jitter(0.1)
  // 밑면 펠트가 고역을 살짝 죽인다
  const out = voice(b, level, 0.22, 7000 * weight.pitch)
  const p = weight.pitch * jitter(0.035)
  const boardGain = opts.boardGain ?? 1
  // 접촉 순간
  noise(c, out.node, t, { type: 'bandpass', freq: 2600 * p, q: 0.8, amp: 0.55, decay: 0.0035 })
  noise(c, out.node, t, { type: 'lowpass', freq: 900, amp: 0.35, decay: 0.008 })
  for (const [f, d, a] of BOARD_MODES) mode(c, out.node, t, f * p * jitter(0.02), d * jitter(0.15), a * boardGain * jitter(0.2))
  for (const [f, d, a] of PIECE_MODES) mode(c, out.node, t, f * p * jitter(0.03), d, a * jitter(0.25))
  // 테이블까지 전해지는 낮은 울림
  mode(c, out.node, t, 92 * p, 0.04, 0.35 * boardGain)
}

/** 기물끼리 부딪히는 "딱" (잡기) */
function woodClack(b: Bus, t: number, level: number) {
  const c = b.ctx
  const out = voice(b, level * jitter(0.1), 0.25)
  noise(c, out.node, t, { type: 'highpass', freq: 3500, amp: 0.6, decay: 0.004 })
  noise(c, out.node, t, { type: 'bandpass', freq: 1800, q: 1.2, amp: 0.4, decay: 0.01 })
  const p = jitter(0.04)
  for (const [f, d, a] of [
    [2950, 0.018, 0.55],
    [4380, 0.012, 0.35],
    [6150, 0.008, 0.22],
    [1540, 0.02, 0.25],
  ] as const)
    mode(c, out.node, t, f * p, d, a)
}

// ── 막대·종·징 ─────────────────────────────────────────

/** 실로폰·첼레스타 같은 금속 막대 (자유 막대 배음비 1 : 2.756 : 5.404) */
function bar(b: Bus, t: number, f: number, level: number, decay = 1.1, reverb = 0.45) {
  const c = b.ctx
  const out = voice(b, level, reverb, 18000, 'hall')
  mode(c, out.node, t, f, decay, 0.5, 0.002)
  mode(c, out.node, t, f * 2.756, decay * 0.35, 0.18, 0.002)
  mode(c, out.node, t, f * 5.404, decay * 0.12, 0.08, 0.002)
  mode(c, out.node, t, f * 1.003, decay * 0.9, 0.12, 0.002) // 살짝 맥놀이
  noise(c, out.node, t, { type: 'highpass', freq: 6000, amp: 0.08, decay: 0.006 })
}

/** 마림바 (공명관이 있는 나무 막대: 1 : 4 : 10) */
function marimba(b: Bus, t: number, f: number, level: number) {
  const c = b.ctx
  const out = voice(b, level, 0.35, 18000, 'hall')
  mode(c, out.node, t, f, 0.45, 0.55, 0.003)
  mode(c, out.node, t, f * 3.93, 0.09, 0.2, 0.002)
  mode(c, out.node, t, f * 9.2, 0.03, 0.08, 0.001)
  noise(c, out.node, t, { type: 'bandpass', freq: f * 6, q: 1, amp: 0.1, decay: 0.008 })
}

/** 팀파니 (막 진동 모드 1 : 1.5 : 1.98 : 2.44) */
function timpani(b: Bus, t: number, f: number, level: number) {
  const c = b.ctx
  const out = voice(b, level, 0.4, 5000, 'hall')
  noise(c, out.node, t, { type: 'lowpass', freq: 1200, amp: 0.5, decay: 0.03 })
  for (const [r, d, a] of [
    [1, 0.7, 0.7],
    [1.5, 0.45, 0.35],
    [1.98, 0.35, 0.25],
    [2.44, 0.25, 0.15],
  ] as const)
    mode(c, out.node, t, f * r, d, a, 0.004, 0.985)
}

/** 교회 종 (hum 0.5, prime 1, tierce 1.2, quint 1.5, nominal 2, ...) */
function bell(b: Bus, t: number, f: number, level: number) {
  const c = b.ctx
  const out = voice(b, level, 0.6, 18000, 'hall')
  for (const [r, d, a] of [
    [0.5, 2.6, 0.35],
    [1, 1.9, 0.45],
    [1.2, 1.4, 0.25],
    [1.5, 1.1, 0.18],
    [2, 1.2, 0.3],
    [2.5, 0.6, 0.1],
    [3, 0.5, 0.08],
    [4.2, 0.3, 0.05],
  ] as const) {
    mode(c, out.node, t, f * r, d, a, 0.002)
    mode(c, out.node, t, f * r * 1.0025, d, a * 0.35, 0.002) // 종의 맥놀이
  }
  noise(c, out.node, t, { type: 'bandpass', freq: f * 5, q: 2, amp: 0.12, decay: 0.01 })
}

/** 징·탐탐: 촘촘한 비정수 배음이 천천히 피어올랐다 사라진다 */
function gong(b: Bus, t: number, f: number, level: number) {
  const c = b.ctx
  const out = voice(b, level, 0.7, 18000, 'hall')
  noise(c, out.node, t, { type: 'lowpass', freq: 400, amp: 0.6, decay: 0.05 })
  const ratios = [1, 1.47, 1.89, 2.34, 2.76, 3.31, 3.89, 4.53, 5.2, 6.1, 7.3]
  ratios.forEach((r, i) => {
    const bloom = 0.02 + i * 0.06 // 높은 배음일수록 늦게 피어난다
    mode(c, out.node, t, f * r * jitter(0.01), 2.8 - i * 0.18, 0.28 / (1 + i * 0.25), bloom, 0.995)
  })
  noise(c, out.node, t + 0.05, { type: 'bandpass', freq: 3000, q: 0.5, amp: 0.05, attack: 0.4, decay: 0.9 })
}

/** 브라스 음 하나: 디튠 톱니파 3개 → 필터가 확 열렸다 닫히는 "블랫" + 늦게 들어오는 비브라토 */
function brass(b: Bus, t: number, f: number, dur: number, level: number, reverb = 0.45) {
  const c = b.ctx
  const out = voice(b, 1, reverb, 18000, 'hall')
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(f * 1.5, t)
  filter.frequency.exponentialRampToValueAtTime(f * 7, t + 0.05)
  filter.frequency.exponentialRampToValueAtTime(f * 4, t + 0.25)
  const amp = c.createGain()
  amp.gain.setValueAtTime(0, t)
  amp.gain.linearRampToValueAtTime(level, t + 0.035)
  amp.gain.linearRampToValueAtTime(level * 0.75, t + 0.15)
  amp.gain.setValueAtTime(level * 0.75, t + dur)
  amp.gain.setTargetAtTime(0, t + dur, 0.08)
  filter.connect(amp)
  amp.connect(out.node)
  const vib = c.createOscillator()
  vib.frequency.value = 5.3
  const vibDepth = c.createGain()
  vibDepth.gain.setValueAtTime(0, t)
  vibDepth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(dur, 0.35))
  vib.connect(vibDepth)
  for (const detune of [-7, 0, 6]) {
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f * 0.985, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04) // 아래에서 미끄러져 들어오는 어택
    o.detune.value = detune
    vibDepth.connect(o.frequency)
    o.connect(filter)
    o.start(t)
    o.stop(t + dur + 0.6)
  }
  vib.start(t)
  vib.stop(t + dur + 0.6)
}

/** 현악 패드 (천천히 부푸는 화음) */
function strings(b: Bus, t: number, freqs: number[], dur: number, level: number) {
  const c = b.ctx
  const out = voice(b, 1, 0.6, 2400, 'hall')
  for (const f of freqs) {
    for (const d of [-9, 9]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = d
      const g = c.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(level / freqs.length, t + 0.5)
      g.gain.setValueAtTime(level / freqs.length, t + dur)
      g.gain.setTargetAtTime(0, t + dur, 0.5)
      o.connect(g)
      g.connect(out.node)
      o.start(t)
      o.stop(t + dur + 3)
    }
  }
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12) // MIDI → Hz

// ── 이벤트별 소리 ──────────────────────────────────────

const recipes: Record<SoundName, (b: Bus, t: number, o: SoundOptions) => void> = {
  // 가벼운 "틱": 손끝에 들리는 말
  select: (b, t, o) => {
    const w = weightOf(o.piece)
    const out = voice(b, 0.9 * w.level, 0.12)
    noise(b.ctx, out.node, t, { type: 'bandpass', freq: 3800, q: 1, amp: 0.4, decay: 0.003 })
    for (const [f, d, a] of PIECE_MODES) mode(b.ctx, out.node, t, f * w.pitch * 1.15, d * 0.8, a)
    mode(b.ctx, out.node, t, 520 * w.pitch, 0.012, 0.15)
  },
  // 나무 말 내려놓는 "톡"
  move: (b, t, o) => woodKnock(b, t, weightOf(o.piece)),
  // 묵직한 "쾅": 기물끼리 부딪힘 → 보드에 세게 내려놓음 + 테이블 울림
  capture: (b, t, o) => {
    woodClack(b, t, 0.62)
    const w = weightOf(o.piece)
    woodKnock(b, t + 0.018, { pitch: w.pitch * 0.92, level: w.level * 1.1 }, { boardGain: 1.4 })
    const out = voice(b, 0.8, 0.35, 900)
    mode(b.ctx, out.node, t + 0.02, 62, 0.09, 0.8)
    noise(b.ctx, out.node, t + 0.02, { type: 'lowpass', freq: 300, amp: 0.5, decay: 0.05 })
  },
  // 상승하는 차임벨 (첼레스타)
  promotion: (b, t) => {
    ;[84, 88, 91, 96, 100].forEach((n, i) => bar(b, t + i * 0.085, NOTE(n), 0.32, 1.3))
    bar(b, t + 0.5, NOTE(103), 0.22, 1.8, 0.6)
  },
  // 긴장감: 팀파니 + 반음 부딪히는 마림바
  check: (b, t) => {
    timpani(b, t, NOTE(38), 0.85)
    marimba(b, t + 0.02, NOTE(62), 0.5)
    marimba(b, t + 0.14, NOTE(63), 0.55)
    marimba(b, t + 0.26, NOTE(62), 0.4)
  },
  // 웅장한 효과음: 징 + 팀파니 + 낮은 현악 단조 화음
  checkmate: (b, t) => {
    gong(b, t, 72, 0.9)
    timpani(b, t, NOTE(38), 1)
    timpani(b, t + 0.42, NOTE(38), 0.8)
    strings(b, t + 0.05, [NOTE(38), NOTE(45), NOTE(50), NOTE(53)], 2.2, 0.32)
    brass(b, t + 0.45, NOTE(50), 1.6, 0.16, 0.6)
    brass(b, t + 0.45, NOTE(57), 1.6, 0.12, 0.6)
  },
  // 승리 팡파르 (C장조)
  victory: (b, t) => {
    const seq: [number, number, number][] = [
      [72, 0, 0.16],
      [72, 0.19, 0.16],
      [72, 0.38, 0.16],
      [76, 0.57, 0.5],
      [74, 1.1, 0.22],
      [76, 1.34, 0.22],
    ]
    for (const [n, dt, d] of seq) {
      brass(b, t + dt, NOTE(n), d, 0.19)
      brass(b, t + dt, NOTE(n - 12), d, 0.1)
    }
    // 마지막 화음
    for (const n of [60, 64, 67, 72, 79]) brass(b, t + 1.6, NOTE(n), 1.3, 0.11, 0.6)
    timpani(b, t + 1.6, NOTE(36), 0.9)
    timpani(b, t + 0.57, NOTE(43), 0.6)
    const cym = voice(b, 0.35, 0.6, 18000, 'hall')
    noise(b.ctx, cym.node, t + 1.6, { type: 'highpass', freq: 5500, amp: 0.5, decay: 0.9 })
  },
  // 차분한 종소리 두 번
  draw: (b, t) => {
    bell(b, t, NOTE(67), 0.42)
    bell(b, t + 0.85, NOTE(62), 0.38)
  },
  // 잘못된 수: 제자리에서 흔들리는 말의 "토독" + 짧고 둔한 "삑"
  invalid: (b, t, o) => {
    const w = weightOf(o.piece)
    woodKnock(b, t, { pitch: w.pitch * 1.2, level: 0.35 }, { boardGain: 0.5 })
    woodKnock(b, t + 0.09, { pitch: w.pitch * 1.25, level: 0.28 }, { boardGain: 0.5 })
    const out = voice(b, 0.18, 0.1, 1800)
    const o2 = b.ctx.createOscillator()
    o2.type = 'triangle'
    o2.frequency.setValueAtTime(330, t)
    o2.frequency.exponentialRampToValueAtTime(240, t + 0.12)
    const g = b.ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.6, t + 0.005)
    g.gain.setTargetAtTime(0, t + 0.06, 0.03)
    o2.connect(g)
    g.connect(out.node)
    o2.start(t)
    o2.stop(t + 0.3)
  },
}

export function playSynth(name: SoundName, opts: SoundOptions = {}, delaySec = 0) {
  const c = audioContext()
  if (!c || !bus) return
  recipes[name](bus, c.currentTime + 0.005 + delaySec, opts)
}

const recipeNames = Object.keys(recipes) as SoundName[]
export { recipeNames as SOUND_NAMES }
