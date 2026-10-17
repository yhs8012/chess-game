// 기물 카드 + 5×5 미니 보드 데모 (SVG, 가벼움)
import type { PieceSymbol } from 'chess.js'
import { PIECES } from './rulesText.ko'

const CELL = 20
const c = (i: number) => i * CELL + CELL / 2

interface Demo {
  at: [number, number]
  /** 이동 가능(●) */
  moves: [number, number][]
  /** 잡기(붉은 테두리) + 상대 말 표시 */
  captures?: [number, number][]
  /** 첫 수만 가능 */
  first?: [number, number][]
  /** 직선 화살표 방향 */
  rays?: [number, number][]
  /** 유령 말이 따라 움직이는 경로 (칸 좌표) */
  path: [number, number][]
}

const ALL8: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
]
const ring = (dirs: [number, number][], [x, y]: [number, number], k = 1) =>
  dirs.map(([dx, dy]) => [x + dx * k, y + dy * k] as [number, number])
const rayCells = (dirs: [number, number][], [x, y]: [number, number]) =>
  dirs.flatMap(([dx, dy]) => [1, 2].map((k) => [x + dx * k, y + dy * k] as [number, number]))

const ORTHO: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIAG: [number, number][] = [[1, 1], [-1, 1], [1, -1], [-1, -1]]

const DEMOS: Record<PieceSymbol, Demo> = {
  k: { at: [2, 2], moves: ring(ALL8, [2, 2]), path: [[2, 2], [3, 1], [2, 2], [1, 2], [2, 2]] },
  q: { at: [2, 2], moves: rayCells([...ORTHO, ...DIAG], [2, 2]), rays: [...ORTHO, ...DIAG], path: [[2, 2], [4, 0], [2, 2], [0, 2], [2, 2]] },
  r: { at: [2, 2], moves: rayCells(ORTHO, [2, 2]), rays: ORTHO, path: [[2, 2], [2, 0], [2, 2], [4, 2], [2, 2]] },
  b: { at: [2, 2], moves: rayCells(DIAG, [2, 2]), rays: DIAG, path: [[2, 2], [0, 0], [2, 2], [4, 4], [2, 2]] },
  n: {
    at: [2, 2],
    moves: [[3, 0], [4, 1], [4, 3], [3, 4], [1, 4], [0, 3], [0, 1], [1, 0]],
    // L자: 위로 두 칸 → 오른쪽 한 칸
    path: [[2, 2], [2, 0], [3, 0], [3, 0], [2, 2]],
  },
  p: {
    at: [2, 4],
    moves: [[2, 3]],
    first: [[2, 2]],
    captures: [[1, 3], [3, 3]],
    path: [[2, 4], [2, 3], [2, 2], [2, 2], [2, 4]],
  },
}

function MiniBoard({ type }: { type: PieceSymbol }) {
  const d = DEMOS[type]
  const inside = ([x, y]: [number, number]) => x >= 0 && x < 5 && y >= 0 && y < 5
  const motion = d.path.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${c(x) - c(d.at[0])},${c(y) - c(d.at[1])}`).join(' ')
  const id = `arrow-${type}`
  return (
    <svg className="mini-board" viewBox="0 0 100 100" role="img" aria-label={`${PIECES[type].name} 이동 데모`}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--legal-ink)" />
        </marker>
      </defs>
      {Array.from({ length: 25 }, (_, i) => {
        const x = i % 5
        const y = Math.floor(i / 5)
        return <rect key={i} x={x * CELL} y={y * CELL} width={CELL} height={CELL} className={(x + y) % 2 ? 'mb-dark' : 'mb-light'} />
      })}
      {d.rays?.map(([dx, dy]) => (
        <line
          key={`${dx},${dy}`}
          x1={c(d.at[0]) + dx * 7}
          y1={c(d.at[1]) + dy * 7}
          x2={c(d.at[0]) + dx * 2 * CELL + dx * 6}
          y2={c(d.at[1]) + dy * 2 * CELL + dy * 6}
          className="mb-ray"
          markerEnd={`url(#${id})`}
        />
      ))}
      {type === 'n' && (
        <polyline
          points={`${c(2)},${c(2)} ${c(2)},${c(0)} ${c(3)},${c(0)}`}
          className="mb-ray mb-ray--dash"
          markerEnd={`url(#${id})`}
        />
      )}
      {d.moves.filter(inside).map(([x, y]) => (
        <circle key={`m${x}${y}`} cx={c(x)} cy={c(y)} r={3.4} className="mb-move" />
      ))}
      {d.first?.map(([x, y]) => (
        <g key={`f${x}${y}`}>
          <circle cx={c(x)} cy={c(y)} r={3.4} className="mb-move mb-move--first" />
          <text x={c(x)} y={c(y) - 5} className="mb-note">
            처음
          </text>
        </g>
      ))}
      {d.captures?.map(([x, y]) => (
        <g key={`c${x}${y}`}>
          <rect x={x * CELL + 1.5} y={y * CELL + 1.5} width={CELL - 3} height={CELL - 3} className="mb-capture" />
          <text x={c(x)} y={c(y) + 4.5} className="mb-enemy">
            ♟
          </text>
        </g>
      ))}
      <text x={c(d.at[0])} y={c(d.at[1]) + 5.5} className="mb-piece mb-piece--home">
        {PIECES[type].symbol}
      </text>
      <g>
        <text x={c(d.at[0])} y={c(d.at[1]) + 5.5} className="mb-piece mb-piece--ghost">
          {PIECES[type].symbol}
        </text>
        <animateMotion dur="3.2s" repeatCount="indefinite" path={motion} calcMode="spline"
          keyTimes={d.path.map((_, i) => (i / (d.path.length - 1)).toFixed(3)).join(';')}
          keySplines={d.path.slice(1).map(() => '0.4 0 0.2 1').join(';')} />
      </g>
    </svg>
  )
}

export function PieceCard({
  type,
  expanded,
  onClick,
}: {
  type: PieceSymbol
  expanded?: boolean
  onClick?: () => void
}) {
  const info = PIECES[type]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`piece-card ${expanded ? 'piece-card--expanded' : ''}`} onClick={onClick} aria-expanded={onClick ? expanded : undefined}>
      <div className="piece-card__head">
        <span className="piece-card__symbol">{info.symbol}</span>
        <span className="piece-card__name">{info.name}</span>
      </div>
      {expanded && (
        <>
          <MiniBoard type={type} />
          <p className="piece-card__text">{info.text}</p>
        </>
      )}
    </Tag>
  )
}
