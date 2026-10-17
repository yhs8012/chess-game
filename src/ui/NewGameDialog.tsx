// 새 게임 창: 대국 상대(2인 / 컴퓨터)·난이도·내 색을 고르고 시작한다
import { useEffect, useState } from 'react'
import type { Color } from 'chess.js'
import type { Difficulty } from '../engine/ai'
import { settingsStore, updateSettings } from '../hooks/settings'
import type { Mode } from '../hooks/settings'

type ColorChoice = Color | 'random'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '쉬움', normal: '보통', hard: '어려움' }

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: '아무 수나 둬요. 규칙을 익히기 좋아요',
  normal: '2수 앞을 내다봐요. 공짜 말은 놓치지 않아요',
  hard: '3수 앞을 내다봐요. 실수하면 바로 응징해요',
}

export function NewGameDialog({ onStart, onClose, first }: { onStart: () => void; onClose: () => void; first: boolean }) {
  const s = settingsStore.get()
  // 처음 실행이면 컴퓨터 대전을 먼저 권한다
  const [mode, setMode] = useState<Mode>(first ? 'ai' : s.mode)
  const [difficulty, setDifficulty] = useState<Difficulty>(s.difficulty)
  const [color, setColor] = useState<ColorChoice>(s.humanColor)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const start = () => {
    const humanColor: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color
    updateSettings({ mode, difficulty, humanColor })
    onStart()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="newgame-title" onClick={onClose}>
      <div className="panel modal newgame" onClick={(e) => e.stopPropagation()}>
        <h2 id="newgame-title">{first ? '어떻게 둘까요?' : '새 게임'}</h2>

        <div className="newgame__modes">
          <button className={`mode-card ${mode === 'ai' ? 'on' : ''}`} onClick={() => setMode('ai')} aria-pressed={mode === 'ai'}>
            <span className="mode-card__icon">♚</span>
            <span className="mode-card__title">컴퓨터와 대전</span>
            <span className="mode-card__text">나 vs 컴퓨터</span>
          </button>
          <button className={`mode-card ${mode === 'pvp' ? 'on' : ''}`} onClick={() => setMode('pvp')} aria-pressed={mode === 'pvp'}>
            <span className="mode-card__icon">♔♚</span>
            <span className="mode-card__title">2인 대전</span>
            <span className="mode-card__text">한 화면에서 번갈아</span>
          </button>
        </div>

        {mode === 'ai' && (
          <>
            <fieldset className="field">
              <legend>난이도</legend>
              <div className="seg">
                {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                  <button key={d} className={difficulty === d ? 'on' : ''} onClick={() => setDifficulty(d)}>
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
              <p className="muted small newgame__hint">{DIFFICULTY_HINT[difficulty]}</p>
            </fieldset>
            <fieldset className="field">
              <legend>내 색</legend>
              <div className="seg">
                <button className={color === 'w' ? 'on' : ''} onClick={() => setColor('w')}>
                  ♔ 백 (먼저 둠)
                </button>
                <button className={color === 'b' ? 'on' : ''} onClick={() => setColor('b')}>
                  ♚ 흑
                </button>
                <button className={color === 'random' ? 'on' : ''} onClick={() => setColor('random')}>
                  무작위
                </button>
              </div>
            </fieldset>
          </>
        )}

        <div className="result__actions">
          <button className="btn btn--primary" onClick={start} autoFocus>
            시작하기
          </button>
          {!first && (
            <button className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
