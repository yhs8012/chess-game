// Howler 래퍼: 음소거·볼륨 관리, 엔진 이벤트 → 효과음 연결.
// public/sounds/sounds.json 에 { "move": "move.mp3", ... } 처럼 등록된 파일은 Howler로 재생하고,
// 등록되지 않은 소리는 synth.ts의 합성음으로 재생한다.
import { Howl, Howler } from 'howler'
import type { EventBus, GameEvent } from '../engine/events'
import { T } from '../effects/timing'
import { settingsStore } from '../hooks/settings'
import { audioContext, playSynth, setSynthVolume } from './synth'
import type { SoundName } from './synth'
import { initVoice, speak } from './voice'

const files = new Map<SoundName, Howl>()
const pending: number[] = []

function effectiveVolume() {
  const s = settingsStore.get()
  return s.muted ? 0 : s.volume
}

function applyVolume() {
  const v = effectiveVolume()
  Howler.volume(v)
  setSynthVolume(v)
}

async function loadManifest() {
  try {
    const base = `${import.meta.env.BASE_URL}sounds/`
    const res = await fetch(`${base}sounds.json`)
    if (!res.ok) return
    const manifest = (await res.json()) as Partial<Record<SoundName, string>>
    for (const [name, file] of Object.entries(manifest) as [SoundName, string][]) {
      if (!file) continue
      const howl = new Howl({
        src: [`${base}${file}`],
        preload: true,
        onloaderror: () => files.delete(name),
      })
      files.set(name, howl)
    }
  } catch {
    /* 매니페스트가 없으면 합성음만 쓴다 */
  }
}

export function play(name: SoundName) {
  if (effectiveVolume() <= 0) return
  const howl = files.get(name)
  if (howl && howl.state() === 'loaded') howl.play()
  else playSynth(name)
}

function at(sec: number, fn: () => void) {
  pending.push(window.setTimeout(fn, sec * 1000))
}

/** 예약된 소리 취소 (무르기·새 게임) */
export function cancelScheduledSounds() {
  pending.splice(0).forEach(clearTimeout)
  try {
    speechSynthesis?.cancel()
  } catch {
    /* 무시 */
  }
}

function say(text: string, delay: number) {
  at(delay, () => {
    const v = effectiveVolume()
    if (v > 0) speak(text, v)
  })
}

/** 엔진 이벤트에 효과음을 연결한다. 해제 함수를 돌려준다. */
export function bindSounds(bus: EventBus<GameEvent>): () => void {
  let batch: GameEvent[] = []
  let flushQueued = false

  // 한 수에서 나온 이벤트를 모아서 판단한다 (잡기면 '톡' 대신 '쾅' 등)
  const flush = () => {
    flushQueued = false
    const events = batch
    batch = []
    const has = (t: GameEvent['type']) => events.some((e) => e.type === t)

    for (const e of events) {
      if (e.type === 'select') play('select')
      if (e.type === 'invalid') play('invalid')
    }
    if (has('capture')) at(T.move, () => play('capture'))
    else if (has('move')) at(T.move, () => play('move'))
    if (has('castle')) at(T.castleRookDelay + T.move, () => play('move'))
    if (has('promotion')) at(T.move + 0.1, () => play('promotion'))

    if (has('checkmate')) {
      at(T.move, () => play('checkmate'))
      say('Checkmate!', T.move + T.mateVoice)
      at(T.move + T.mateVictory, () => play('victory'))
    } else {
      if (has('check')) {
        at(T.move + 0.05, () => play('check'))
        if (settingsStore.get().checkVoice) say('Check!', T.move + 0.25)
      }
      if (has('draw')) at(T.move + 0.15, () => play('draw'))
    }
  }

  return bus.subscribe((e) => {
    batch.push(e)
    if (!flushQueued) {
      flushQueued = true
      queueMicrotask(flush)
    }
  })
}

let started = false

/** 앱 시작 시 한 번: 설정 반영, 매니페스트 로딩, 첫 클릭 후 오디오 활성화 */
export function initAudio() {
  if (started) return
  started = true
  applyVolume()
  settingsStore.subscribe(applyVolume)
  initVoice()
  loadManifest()
  const unlock = () => {
    const c = audioContext()
    c?.resume()
    applyVolume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}
