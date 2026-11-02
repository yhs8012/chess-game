// 턴 표시·대국 시계·호버 좌표·시점 프리셋·무르기/새 게임
import { useEffect, useState } from 'react'
import type { ChessGame } from '../hooks/useChessGame'
import { hoverStore } from '../hooks/useChessGame'
import { useStore } from '../hooks/store'
import { useSettings } from '../hooks/settings'
import { DIFFICULTY_LABEL } from './NewGameDialog'

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Clocks({ g }: { g: ChessGame }) {
  const [t, setT] = useState(g.readClock())
  useEffect(() => {
    const id = window.setInterval(() => setT(g.readClock()), 250)
    return () => clearInterval(id)
  }, [g.readClock])
  const paused = g.helpOpen && !g.end
  return (
    <div className="clocks" aria-label="대국 시계">
      {(['w', 'b'] as const).map((c) => (
        <div key={c} className={`clock ${g.turn === c && !g.end ? 'clock--active' : ''}`}>
          <span className={`dot dot--${c}`} />
          <span className="clock__label">{c === 'w' ? '백' : '흑'}</span>
          <span className="clock__time">{formatClock(t[c])}</span>
        </div>
      ))}
      {paused && <span className="clock__paused">일시정지</span>}
    </div>
  )
}

/** 지금 상황 한 줄: "백(나) 차례", "체크메이트 — 흑 승리" 등 */
export function turnLine(g: ChessGame): string {
  const { turn, status, aiThinking, end, config } = g
  const name = (c: 'w' | 'b') => {
    const base = c === 'w' ? '백' : '흑'
    if (config.mode !== 'ai') return base
    return c === config.humanColor ? `${base}(나)` : `${base}(AI)`
  }
  if (end?.kind === 'checkmate' || status.isCheckmate) return `체크메이트 — ${name(status.winner!)} 승리`
  if (end?.kind === 'draw' || status.isDraw) return '무승부'
  if (aiThinking) return 'AI가 생각 중…'
  if (status.isCheck) return `${name(turn)} 차례 · 체크!`
  return `${name(turn)} 차례`
}

/** 왼쪽 위 창을 접었을 때 남는 작은 칩: 차례만 보여 주고, 누르면 다시 펼친다 */
export function TurnChip({ g, onOpen }: { g: ChessGame; onOpen: () => void }) {
  const { turn, status, aiThinking } = g
  return (
    <button
      className={`panel turn-chip ${status.isCheck && !status.isCheckmate ? 'turn--check' : ''}`}
      onClick={onOpen}
      aria-expanded={false}
      aria-label="대국 정보 펼치기"
      title="대국 정보 펼치기"
    >
      <span className={`dot dot--${turn}`} />
      <span>{turnLine(g)}</span>
      {aiThinking && <span className="spinner" aria-hidden />}
      <span className="turn-chip__chev" aria-hidden>
        ▸
      </span>
    </button>
  )
}

export function TurnPanel({ g, onNewGame, onCollapse }: { g: ChessGame; onNewGame: () => void; onCollapse: () => void }) {
  const { turn, status, aiThinking, config } = g
  const { difficulty } = useSettings()
  const line = turnLine(g)

  return (
    <section className="panel turn-panel">
      <button className="icon-btn panel-collapse" onClick={onCollapse} aria-expanded aria-label="대국 정보 접기" title="접기">
        ‹
      </button>
      <h1 className="brand">
        Staunton <em>3D</em>
      </h1>
      <button className="match-badge" onClick={onNewGame} title="대국 상대 바꾸기">
        {config.mode === 'ai' ? `vs 컴퓨터 · ${DIFFICULTY_LABEL[difficulty]}` : '2인 대전'}
        <span aria-hidden> ▾</span>
      </button>
      <div className={`turn ${status.isCheck && !status.isCheckmate ? 'turn--check' : ''}`}>
        <span className={`dot dot--${turn}`} />
        <span>{line}</span>
        {aiThinking && <span className="spinner" aria-hidden />}
      </div>
      <Clocks g={g} />
    </section>
  )
}

export function HoverCoordinate() {
  const hover = useStore(hoverStore)
  return (
    <div className="hover-coord" aria-live="polite">
      <span className="hover-coord__label">좌표</span>
      <span className="hover-coord__value">{hover ?? '—'}</span>
    </div>
  )
}

export function Toolbar({ g, onNewGame }: { g: ChessGame; onNewGame: () => void }) {
  return (
    <nav className="toolbar panel" aria-label="시점과 대국">
      <div className="toolbar__group">
        <button className="btn" onClick={() => g.setCameraPreset('white')} title="백 시점">
          <span className="btn__icon">♔</span> 백 시점
        </button>
        <button className="btn" onClick={() => g.setCameraPreset('black')} title="흑 시점">
          <span className="btn__icon">♚</span> 흑 시점
        </button>
        <button className="btn" onClick={() => g.setCameraPreset('top')} title="위에서 내려다보기">
          <span className="btn__icon">⊞</span> 위에서
        </button>
      </div>
      <div className="toolbar__group">
        <button className="btn" onClick={g.undo} disabled={g.game.moves.length === 0}>
          <span className="btn__icon">↶</span> 무르기
        </button>
        <button className="btn btn--primary" onClick={onNewGame}>
          새 게임
        </button>
      </div>
    </nav>
  )
}
