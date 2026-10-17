// 기보 패널 (SAN). 수를 누르면 보드에서 출발·도착 칸이 깜빡인다.
import { useEffect, useRef, useState } from 'react'
import type { ChessGame } from '../hooks/useChessGame'

export function MoveHistory({ g }: { g: ChessGame }) {
  const moves = g.game.moves
  const list = useRef<HTMLOListElement>(null)
  const [open, setOpen] = useState(() => window.innerWidth > 720)

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [moves.length])

  const rows: { n: number; w?: number; b?: number }[] = []
  moves.forEach((m, i) => {
    if (m.color === 'w' || rows.length === 0) rows.push({ n: rows.length + 1 })
    rows[rows.length - 1][m.color] = i
  })

  return (
    <section className={`panel history ${open ? '' : 'history--closed'}`}>
      <button className="history__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <h2>기보</h2>
        <span>{moves.length > 0 ? `${Math.ceil(moves.length / 2)}수` : ''}</span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ol className="history__list" ref={list}>
          {rows.length === 0 && <li className="history__empty">아직 둔 수가 없어요</li>}
          {rows.map((r) => (
            <li key={r.n} className="history__row">
              <span className="history__num">{r.n}.</span>
              {(['w', 'b'] as const).map((c) => {
                const i = r[c]
                if (i === undefined) return <span key={c} className="history__san" />
                return (
                  <button
                    key={c}
                    className={`history__san ${i === moves.length - 1 ? 'history__san--last' : ''}`}
                    onClick={() => g.flashMove(i)}
                    title={`${moves[i].from} → ${moves[i].to}`}
                  >
                    {moves[i].san}
                  </button>
                )
              })}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
