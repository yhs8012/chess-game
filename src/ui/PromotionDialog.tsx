// 프로모션 선택 창: 퀸·룩·비숍·나이트
import { useEffect } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { PIECES, SPECIAL } from './help/rulesText.ko'

const CHOICES: PieceSymbol[] = ['q', 'r', 'b', 'n']
const BLACK_SYMBOL: Record<string, string> = { q: '♛', r: '♜', b: '♝', n: '♞' }

export function PromotionDialog({ color, onChoose }: { color: Color; onChoose: (p: PieceSymbol | null) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChoose(null)
      const k = e.key.toLowerCase() as PieceSymbol
      if (CHOICES.includes(k)) onChoose(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChoose])

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="promo-title">
      <div className="panel modal">
        <h2 id="promo-title">프로모션</h2>
        <p className="muted">{SPECIAL.promotion.text}</p>
        <div className="promo-choices">
          {CHOICES.map((p) => (
            <button key={p} className="promo-choice" onClick={() => onChoose(p)}>
              <span className="promo-choice__symbol">{color === 'w' ? PIECES[p].symbol : BLACK_SYMBOL[p]}</span>
              <span>{PIECES[p].name}</span>
              <kbd>{p.toUpperCase()}</kbd>
            </button>
          ))}
        </div>
        <button className="btn btn--ghost" onClick={() => onChoose(null)}>
          취소
        </button>
      </div>
    </div>
  )
}
