// 우상단: 음소거·볼륨 + 설정(좌표 라벨, 효과 줄이기, 시점 자동 전환, 음성, 대국 모드)
import { useEffect, useRef, useState } from 'react'
import type { ChessGame } from '../hooks/useChessGame'
import { updateSettings, useSettings } from '../hooks/settings'
import type { Settings as SettingsT } from '../hooks/settings'

function Toggle({ label, hint, k }: { label: string; hint?: string; k: keyof SettingsT }) {
  const s = useSettings()
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!s[k]} onChange={(e) => updateSettings({ [k]: e.target.checked } as Partial<SettingsT>)} />
      <span className="toggle__track" aria-hidden />
      <span className="toggle__text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

export function Settings({ g }: { g: ChessGame }) {
  const s = useSettings()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const matchChanged = s.mode !== g.config.mode || (s.mode === 'ai' && s.humanColor !== g.config.humanColor)

  return (
    <div className="settings" ref={box}>
      <div className="panel sound">
        <button
          className="icon-btn"
          onClick={() => updateSettings({ muted: !s.muted })}
          aria-label={s.muted ? '소리 켜기' : '음소거'}
          title={s.muted ? '소리 켜기' : '음소거'}
        >
          {s.muted || s.volume === 0 ? '🔇' : s.volume < 0.4 ? '🔈' : '🔊'}
        </button>
        <input
          className="volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.muted ? 0 : s.volume}
          onChange={(e) => updateSettings({ volume: Number(e.target.value), muted: false })}
          aria-label="볼륨"
        />
        <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="설정" title="설정">
          ⚙
        </button>
      </div>

      {open && (
        <div className="panel settings__menu">
          <h2>설정</h2>

          <fieldset className="field">
            <legend>대국 모드</legend>
            <div className="seg">
              <button className={s.mode === 'pvp' ? 'on' : ''} onClick={() => updateSettings({ mode: 'pvp' })}>
                2인 (같은 화면)
              </button>
              <button className={s.mode === 'ai' ? 'on' : ''} onClick={() => updateSettings({ mode: 'ai' })}>
                컴퓨터와
              </button>
            </div>
          </fieldset>

          {s.mode === 'ai' && (
            <>
              <fieldset className="field">
                <legend>난이도</legend>
                <div className="seg">
                  {(
                    [
                      ['easy', '쉬움'],
                      ['normal', '보통'],
                      ['hard', '어려움'],
                    ] as const
                  ).map(([d, label]) => (
                    <button key={d} className={s.difficulty === d ? 'on' : ''} onClick={() => updateSettings({ difficulty: d })}>
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>내 색</legend>
                <div className="seg">
                  <button className={s.humanColor === 'w' ? 'on' : ''} onClick={() => updateSettings({ humanColor: 'w' })}>
                    ♔ 백 (선공)
                  </button>
                  <button className={s.humanColor === 'b' ? 'on' : ''} onClick={() => updateSettings({ humanColor: 'b' })}>
                    ♚ 흑
                  </button>
                </div>
              </fieldset>
            </>
          )}

          {matchChanged && (
            <button
              className="btn btn--primary btn--block"
              onClick={() => {
                g.newGame()
                setOpen(false)
              }}
            >
              이 설정으로 새 게임
            </button>
          )}

          <div className="settings__toggles">
            <Toggle k="showLabels" label="좌표 라벨" hint="보드 테두리의 a–h, 1–8" />
            <Toggle k="reduceEffects" label="효과 줄이기" hint="흔들림·플래시 끄기" />
            {s.mode === 'pvp' && <Toggle k="autoRotate" label="턴마다 시점 전환" hint="같은 화면 대전용" />}
            <Toggle k="checkVoice" label={'"Check!" 음성'} hint="체크메이트 음성은 항상 재생" />
          </div>
        </div>
      )}
    </div>
  )
}
