// 문맥형 도움말 패널 (오른쪽에서 슬라이드)
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PieceSymbol } from 'chess.js'
import type { ChessGame } from '../../hooks/useChessGame'
import { helpContext } from './helpContext'
import { PieceCard } from './PieceCard'
import { CHECK_ALERT, HOW_TO, OUTCOMES, PIECE_ORDER, PIECES, SPECIAL } from './rulesText.ko'

export function HelpPanel({ g }: { g: ChessGame }) {
  const { helpOpen, game, selected, config, turn } = g
  const ctx = useMemo(() => helpContext(game, selected), [game, selected])
  const [card, setCard] = useState<PieceSymbol | null>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  // 열릴 때 닫기 버튼에 포커스 (키보드 사용자)
  useEffect(() => {
    if (helpOpen) closeBtn.current?.focus({ preventScroll: true })
  }, [helpOpen])

  // 체크 경고·특수 규칙 안내는 '내 차례'일 때만 (AI 대전에서 AI가 체크당했을 때 제외)
  const mine = config.mode === 'pvp' || turn === config.humanColor
  const sideName = turn === 'w' ? '백' : '흑'

  return (
    <aside className={`help-panel ${helpOpen ? 'help-panel--open' : ''}`} aria-hidden={!helpOpen} aria-label="규칙 도움말">
      <header className="help-panel__head">
        <h2>규칙 도움말</h2>
        <span className="help-panel__paused">대국 시계 멈춤</span>
        <button ref={closeBtn} className="icon-btn" onClick={() => g.setHelpOpen(false)} aria-label="도움말 닫기" tabIndex={helpOpen ? 0 : -1}>
          ✕
        </button>
      </header>

      <div className="help-panel__body">
        {mine && ctx.inCheck && !g.status.isCheckmate && (
          <div className="alert alert--check" role="alert">
            {CHECK_ALERT}
          </div>
        )}

        {ctx.selected ? (
          <section className="help-section">
            <h3>
              선택한 말 · {PIECES[ctx.selected.type].name}{' '}
              <span className="sq">{ctx.selected.square}</span>
            </h3>
            <PieceCard type={ctx.selected.type} expanded />
            <ul className="legend">
              <li>
                <span className="swatch swatch--pattern" /> 원래 움직일 수 있는 패턴 (빈 보드 기준)
              </li>
              <li>
                <span className="swatch swatch--legal" /> 지금 실제로 둘 수 있는 칸
              </li>
              <li className="muted">파란 칸에 마우스를 올리면 못 가는 이유가 보여요.</li>
            </ul>
          </section>
        ) : (
          <section className="help-section">
            <h3>기물</h3>
            <p className="muted small">말을 선택하고 Help를 열면 보드 위에 이동 패턴이 표시돼요.</p>
            <div className="piece-grid">
              {PIECE_ORDER.map((t) => (
                <PieceCard key={t} type={t} expanded={card === t} onClick={() => setCard(card === t ? null : t)} />
              ))}
            </div>
          </section>
        )}

        {mine && (ctx.promotionSoon || ctx.castling.k || ctx.castling.q || ctx.enPassant) && (
          <section className="help-section">
            <h3>지금 {sideName}이 할 수 있는 특수 규칙</h3>
            {ctx.promotionSoon && (
              <div className="callout">
                <strong>{SPECIAL.promotion.title} 가능</strong>
                <p>{SPECIAL.promotion.text}</p>
                <p className="how">{HOW_TO.promotion}</p>
              </div>
            )}
            {(ctx.castling.k || ctx.castling.q) && (
              <div className="callout">
                <strong>
                  {SPECIAL.castling.title} 가능 ·{' '}
                  {[ctx.castling.k && '킹 쪽(O-O)', ctx.castling.q && '퀸 쪽(O-O-O)'].filter(Boolean).join(', ')}
                </strong>
                <p>{SPECIAL.castling.text}</p>
                <p className="how">{HOW_TO.castling}</p>
              </div>
            )}
            {ctx.enPassant && (
              <div className="callout">
                <strong>{SPECIAL.enPassant.title} 가능</strong>
                <p>{SPECIAL.enPassant.text}</p>
                <p className="how">{HOW_TO.enPassant}</p>
              </div>
            )}
          </section>
        )}

        <details className="help-section">
          <summary>특수 규칙</summary>
          {Object.values(SPECIAL).map((s) => (
            <p key={s.title}>
              <strong>{s.title}</strong> — {s.text}
            </p>
          ))}
        </details>

        <details className="help-section">
          <summary>승패와 무승부</summary>
          {OUTCOMES.map((o) => (
            <p key={o.title}>
              <strong>{o.title}</strong> — {o.text}
            </p>
          ))}
        </details>

        <p className="muted small shortcuts">
          단축키: <kbd>H</kbd> 또는 <kbd>?</kbd> 열기·닫기 · <kbd>Esc</kbd> 닫기
        </p>
      </div>
    </aside>
  )
}
