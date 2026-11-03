// 잘못된 수를 두려 했을 때 보드 위에 잠깐 뜨는 안내 ("왜 안 되는지")
import { useEffect, useState } from 'react'
import type { ChessGame } from '../hooks/useChessGame'

const SHOW_MS = 4500

export function MoveNotice({ g }: { g: ChessGame }) {
  const { notice, dismissNotice } = g
  // 마우스를 올리거나 포커스가 있는 동안에는 읽을 수 있게 닫지 않는다
  const [hold, setHold] = useState(false)
  useEffect(() => {
    if (!notice || hold) return
    const t = window.setTimeout(dismissNotice, SHOW_MS)
    return () => clearTimeout(t)
  }, [notice, hold, dismissNotice])
  if (!notice) return null
  return (
    <div
      key={notice.nonce}
      className="move-notice panel"
      role="status"
      aria-live="polite"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <span className="move-notice__icon" aria-hidden>
        !
      </span>
      <span className="move-notice__text">{notice.text}</span>
      <button className="move-notice__help" onClick={() => g.setHelpOpen(true)}>
        규칙 보기
      </button>
      <button className="icon-btn move-notice__close" onClick={dismissNotice} aria-label="안내 닫기">
        ✕
      </button>
    </div>
  )
}
