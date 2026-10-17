// 우하단 황동 ? 버튼 + 단축키(H, ?, Esc) + 첫 실행 말풍선
import { useEffect, useState } from 'react'
import { loadFlag, saveFlag } from '../../hooks/store'

const SEEN_KEY = 'chess3d.helpHintSeen'

export function HelpButton({ open, setOpen }: { open: boolean; setOpen: (v: boolean | ((o: boolean) => boolean)) => void }) {
  const [hint, setHint] = useState(() => !loadFlag(SEEN_KEY))

  // 말풍선은 처음 실행 때 한 번만: 보여주는 순간 기록한다
  useEffect(() => {
    if (hint) saveFlag(SEEN_KEY)
  }, [])

  const dismissHint = () => setHint(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'h' || e.key === 'H' || e.key === '?' || e.key === 'ㅗ') {
        e.preventDefault()
        dismissHint()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="help-button-wrap">
      {hint && !open && (
        <div className="help-hint" role="status">
          규칙이 궁금하면 눌러보세요!
          <button className="help-hint__close" onClick={dismissHint} aria-label="안내 닫기">
            ✕
          </button>
        </div>
      )}
      <button
        className={`help-button ${open ? 'help-button--open' : ''}`}
        onClick={() => {
          dismissHint()
          setOpen((o) => !o)
        }}
        aria-label="규칙 도움말 (H)"
        aria-expanded={open}
        title="규칙 도움말 (H)"
      >
        ?
      </button>
    </div>
  )
}
