// 턴 표시·대국 시계·호버 좌표·시점 프리셋·무르기/새 게임
import { useEffect, useState } from 'react'
import type { ChessGame } from '../hooks/useChessGame'
import { hoverStore } from '../hooks/useChessGame'
import { useStore } from '../hooks/store'

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

export function TurnPanel({ g }: { g: ChessGame }) {
  const { turn, status, aiThinking, end, config } = g
  const name = (c: 'w' | 'b') => {
    const base = c === 'w' ? '백' : '흑'
    if (config.mode !== 'ai') return base
    return c === config.humanColor ? `${base}(나)` : `${base}(AI)`
  }
  let line: string
  if (end?.kind === 'checkmate' || status.isCheckmate) line = `체크메이트 — ${name(status.winner!)} 승리`
  else if (end?.kind === 'draw' || status.isDraw) line = '무승부'
  else if (aiThinking) line = 'AI가 생각 중…'
  else if (status.isCheck) line = `${name(turn)} 차례 · 체크!`
  else line = `${name(turn)} 차례`

  return (
    <section className="panel turn-panel">
      <h1 className="brand">
        Staunton <em>3D</em>
      </h1>
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

export function Toolbar({ g }: { g: ChessGame }) {
  return (
    <nav className="toolbar panel" aria-label="시점과 대국">
      <div className="toolbar__group">
        <button className="btn" onClick={() => g.setCameraPreset('white')} title="백 시점">
          ♔ 백 시점
        </button>
        <button className="btn" onClick={() => g.setCameraPreset('black')} title="흑 시점">
          ♚ 흑 시점
        </button>
        <button className="btn" onClick={() => g.setCameraPreset('top')} title="위에서 내려다보기">
          ⊞ 위에서
        </button>
      </div>
      <div className="toolbar__group">
        <button className="btn" onClick={g.undo} disabled={g.game.moves.length === 0}>
          ↶ 무르기
        </button>
        <button className="btn btn--primary" onClick={g.newGame}>
          새 게임
        </button>
      </div>
    </nav>
  )
}
