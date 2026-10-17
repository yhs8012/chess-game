// 브라우저 TTS로 "Checkmate!" / "Check!" 외치기 (Web Speech API)
// 미지원 브라우저에서는 조용히 생략한다.

let voice: SpeechSynthesisVoice | null = null
let ready = false

// 남성·깊은 음색으로 알려진 이름 우선
const DEEP = /(male|david|daniel|alex|fred|guy|mark|george|james|tom|aaron|arthur|google uk english male)/i

function pickVoice() {
  const all = speechSynthesis.getVoices()
  if (all.length === 0) return
  const en = all.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en-us'))
  const pool = en.length ? en : all.filter((v) => v.lang.toLowerCase().startsWith('en'))
  voice = pool.find((v) => DEEP.test(v.name)) ?? pool.find((v) => v.default) ?? pool[0] ?? null
  ready = true
}

export function initVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  pickVoice()
  // 목록 로딩이 비동기인 브라우저 대비
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

export function speak(text: string, volume: number) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (volume <= 0) return
    if (!ready) pickVoice()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.85
    u.pitch = 0.8
    u.volume = Math.min(1, volume)
    if (voice) u.voice = voice
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  } catch {
    /* 조용히 생략 */
  }
}
