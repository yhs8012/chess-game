// 결과 패널: 승자·수 개수·대국 시간·다시하기
import { useEffect, useState } from 'react'
import type { ChessGame } from '../hooks/useChessGame'
import { DRAW_REASON_TEXT } from './help/rulesText.ko'
import { formatClock } from './HUD'

export function ResultPanel({ g, onNewGame }: { g: ChessGame; onNewGame: () => void }) {
  const [hidden, setHidden] = useState(false)
  const end = g.end
  // 새 대국이 시작되면 '보드 보기'로 숨긴 상태를 되돌린다
  useEffect(() => {
    if (!end) setHidden(false)
  }, [end])
  if (!end || end.stage !== 'result') return null
  if (hidden) {
    return (
      <button className="btn btn--primary result-reopen" onClick={() => setHidden(false)}>
        결과 보기
      </button>
    )
  }
  const clock = g.readClock()
  const plies = g.game.moves.length
  const { config } = g

  let title: string
  let sub: string
  if (end.kind === 'checkmate') {
    const side = end.winner === 'w' ? '백' : '흑'
    if (config.mode === 'ai') title = end.winner === config.humanColor ? '승리했어요!' : 'AI가 이겼어요'
    else title = `${side} 승리!`
    sub = `체크메이트 · ${side} 승`
  } else {
    title = '무승부'
    sub = DRAW_REASON_TEXT[end.reason]
  }

  return (
    <div className="modal-backdrop modal-backdrop--soft" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={`panel modal result ${end.kind === 'checkmate' ? 'result--win' : ''}`}>
        <p className="result__eyebrow">{sub}</p>
        <h2 id="result-title" className="result__title">
          {title}
        </h2>
        <dl className="result__stats">
          <div>
            <dt>수</dt>
            <dd>{Math.ceil(plies / 2)}수</dd>
          </div>
          <div>
            <dt>대국 시간</dt>
            <dd>{formatClock(clock.w + clock.b)}</dd>
          </div>
          <div>
            <dt>백 / 흑</dt>
            <dd>
              {formatClock(clock.w)} / {formatClock(clock.b)}
            </dd>
          </div>
        </dl>
        <div className="result__actions">
          <button className="btn btn--primary" onClick={g.newGame}>
            다시하기
          </button>
          <button className="btn" onClick={onNewGame}>
            상대 바꾸기
          </button>
          <button className="btn btn--ghost" onClick={() => setHidden(true)}>
            보드 보기
          </button>
        </div>
      </div>
    </div>
  )
}
